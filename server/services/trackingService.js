import Telemetry from "../models/Telemetry.js";
import Tracker from "../models/Tracker.js";
import VehicleTrackingState from "../models/VehicleTrackingState.js";
import Vehicle from "../models/Vehicle.js";
import createError from "../utils/createError.js";
import { VEHICLE_STATUS } from "../constants/vehicleConstants.js";
import { isVehicleTrackable } from "./trackerService.js";
import {
    evaluateTelemetryAlerts,
    evaluateCommunicationAlerts,
} from "./alertService.js";
import { isTimestampTooFarInFuture } from "./telemetryNormalizationService.js";
import {
    buildRealtimePayload,
    buildHeartbeatPayload,
    broadcastVehicleTelemetry,
    broadcastVehicleHeartbeat,
} from "../sockets/broadcastTelemetry.js";
import {
    broadcastNewAlert,
    broadcastResolvedAlert,
} from "../sockets/broadcastAlerts.js";
import {
    TRACKER_STATUS,
    TELEMETRY_SOURCE_BY_PROTOCOL,
    TELEMETRY_MAX_FUTURE_SKEW_MS,
    TELEMETRY_HISTORY_DEFAULT_RANGE_MS,
    TELEMETRY_HISTORY_MAX_RANGE_MS,
    TELEMETRY_HISTORY_MAX_POINTS,
    TELEMETRY_HISTORY_QUERY_LIMIT,
} from "../constants/telemetryConstants.js";

const DUPLICATE_KEY_ERROR_CODE = 11000;

/*
 * The source label is a property of how the tracker talks to us, so it's
 * derived from the authenticated tracker's protocol - a request body can
 * never choose it.
 */
export const resolveTelemetrySource = (tracker) => {
    const source = TELEMETRY_SOURCE_BY_PROTOCOL[tracker.protocol];

    if (!source) {
        throw createError(
            "This tracker's protocol does not support telemetry ingestion.",
            403
        );
    }

    return source;
};

/*
 * Communication activity only moves forward ($max), so concurrent or
 * delayed writes can never move lastSeenAt backwards. This is server
 * receipt time: any authenticated packet - including an older buffered
 * reading - proves the tracker is communicating right now.
 */
const touchLastSeen = (trackerId, receivedAt) =>
    Tracker.updateOne(
        { _id: trackerId },
        { $max: { lastSeenAt: receivedAt } }
    );

// Best-effort, like telemetry alerts: alerting must never fail a write
// that already succeeded.
const runCommunicationAlerts = async (tracker) => {
    try {
        const { created, resolved } =
            await evaluateCommunicationAlerts(tracker);

        created.forEach(broadcastNewAlert);
        resolved.forEach(broadcastResolvedAlert);
    } catch (error) {
        console.error("GPS communication alert evaluation failed:", error);
    }
};

/*
 * Advances the vehicle's latest snapshot only when this reading is strictly
 * newer (by device timestamp `recordedAt`, never server arrival time) than
 * the stored one. Done as one atomic conditional upsert: if a snapshot with
 * an equal-or-newer recordedAt exists, the filter misses, the upsert tries
 * to insert, and the unique `vehicle` index rejects it - so on equal
 * timestamps the snapshot already stored wins, deterministically.
 *
 * Returns the updated snapshot, or null when the reading was not newer.
 */
const advanceTrackingState = async (tracker, normalizedTelemetry, source, receivedAt) => {
    try {
        return await VehicleTrackingState.findOneAndUpdate(
            {
                vehicle: tracker.vehicle,
                recordedAt: { $lt: normalizedTelemetry.recordedAt },
            },
            {
                $set: {
                    tracker: tracker._id,
                    latitude: normalizedTelemetry.latitude,
                    longitude: normalizedTelemetry.longitude,
                    speed: normalizedTelemetry.speed,
                    heading: normalizedTelemetry.heading,
                    ignition: normalizedTelemetry.ignition,
                    batteryLevel: normalizedTelemetry.batteryLevel,
                    gpsFix: normalizedTelemetry.gpsFix,
                    recordedAt: normalizedTelemetry.recordedAt,
                    receivedAt,
                    source,
                },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
            }
        );
    } catch (error) {
        if (error?.code === DUPLICATE_KEY_ERROR_CODE) {
            return null;
        }

        throw error;
    }
};

/*
 * Communication without a GPS position (a protocol heartbeat/keep-alive).
 * Updates Tracker.lastSeenAt only - never invents a position, never writes
 * Telemetry or VehicleTrackingState. No HTTP endpoint calls this yet; it is
 * the entry point future protocol adapters call for heartbeat packets, and
 * ingestTelemetry reuses its pieces.
 */
export const recordHeartbeat = async (tracker, receivedAt = new Date()) => {
    if (tracker.status === TRACKER_STATUS.INACTIVE) {
        throw createError("Tracker is inactive.", 403);
    }

    await touchLastSeen(tracker._id, receivedAt);

    if (tracker.vehicle) {
        broadcastVehicleHeartbeat(
            String(tracker.vehicle),
            buildHeartbeatPayload({
                vehicleId: tracker.vehicle,
                trackerId: tracker._id,
                lastSeenAt: receivedAt,
            })
        );

        await runCommunicationAlerts(tracker);
    }

    return { lastSeenAt: receivedAt };
};

export const ingestTelemetry = async (tracker, normalizedTelemetry) => {
    const source = resolveTelemetrySource(tracker);

    // The HTTP validator already enforces this; repeated here so every
    // ingestion path (protocol adapters included) applies the same rule.
    if (isTimestampTooFarInFuture(normalizedTelemetry.recordedAt)) {
        throw createError(
            `recordedAt cannot be more than ${TELEMETRY_MAX_FUTURE_SKEW_MS / (60 * 1000)} minutes in the future.`,
            400
        );
    }

    const receivedAt = new Date();

    // An unassigned tracker is still communicating - record that, but its
    // reading belongs to no vehicle, so no Telemetry/state/alerts.
    if (!tracker.vehicle) {
        await recordHeartbeat(tracker, receivedAt);

        throw createError(
            "Tracker is not assigned to a vehicle. Communication was recorded, but telemetry was not stored.",
            409
        );
    }

    // Assignment already checks this at that moment, but ingest continues
    // afterward - so a tracker whose vehicle was archived (or removed) can
    // never write Telemetry/VehicleTrackingState for it.
    if (!(await isVehicleTrackable(tracker.vehicle))) {
        await touchLastSeen(tracker._id, receivedAt);

        throw createError(
            "Tracker's assigned vehicle is archived or no longer exists. Telemetry was not stored.",
            409
        );
    }

    // History is append-only: a valid older (out-of-order) reading is still
    // real history and is kept.
    const telemetry = await Telemetry.create({
        tracker: tracker._id,
        vehicle: tracker.vehicle,
        ...normalizedTelemetry,
        source,
        receivedAt,
    });

    const trackingState = await advanceTrackingState(
        tracker,
        normalizedTelemetry,
        source,
        receivedAt
    );

    await touchLastSeen(tracker._id, receivedAt);

    if (trackingState) {
        // Broadcast only after the write succeeded, and only for a reading
        // that became the vehicle's current position - an older reading
        // must never move the live marker backwards.
        broadcastVehicleTelemetry(
            String(tracker.vehicle),
            buildRealtimePayload(telemetry)
        );

        // Best-effort: must never fail an otherwise successful ingest.
        try {
            const { created, resolved } = await evaluateTelemetryAlerts(
                tracker,
                normalizedTelemetry
            );

            created.forEach(broadcastNewAlert);
            resolved.forEach(broadcastResolvedAlert);
        } catch (error) {
            console.error("GPS alert evaluation failed:", error);
        }
    } else {
        // Not a new position, but still proof of communication.
        broadcastVehicleHeartbeat(
            String(tracker.vehicle),
            buildHeartbeatPayload({
                vehicleId: tracker.vehicle,
                trackerId: tracker._id,
                lastSeenAt: receivedAt,
            })
        );
    }

    await runCommunicationAlerts(tracker);

    return {
        telemetry: telemetry.toObject(),
        trackingState: trackingState ? trackingState.toObject() : null,
        stateAdvanced: Boolean(trackingState),
    };
};

export const getCurrentVehicleState = async (vehicleId) => {
    const state = await VehicleTrackingState.findOne({
        vehicle: vehicleId,
    }).lean();

    if (!state) {
        throw createError(
            "No tracking state found for this vehicle.",
            404
        );
    }

    return state;
};

/*
 * Evenly downsamples a chronologically-sorted array to at most `maxPoints`,
 * always keeping the true first and last point so a route's actual
 * endpoints are never lost to sampling.
 */
const sampleEvenly = (points, maxPoints) => {
    if (points.length <= maxPoints) {
        return points;
    }

    const stride = points.length / maxPoints;
    const sampled = [];

    for (let i = 0; i < maxPoints; i += 1) {
        sampled.push(points[Math.floor(i * stride)]);
    }

    sampled[sampled.length - 1] = points[points.length - 1];

    return sampled;
};

/*
 * `earliestStart` (optional) is a hard floor on how far back the caller may
 * look - set for partners (TELEMETRY_OPERATOR_HISTORY_WINDOW_MS), omitted
 * for admins. A range reaching past it is refused rather than silently
 * clipped, so the caller always gets exactly the range they asked for.
 */
export const getVehicleTelemetryHistory = async (
    vehicleId,
    { start, end, earliestStart = null } = {}
) => {
    const endDate = end ? new Date(end) : new Date();
    const startDate = start
        ? new Date(start)
        : new Date(
              endDate.getTime() - TELEMETRY_HISTORY_DEFAULT_RANGE_MS
          );

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw createError("Invalid start or end date.", 400);
    }

    if (startDate >= endDate) {
        throw createError("start must be before end.", 400);
    }

    if (
        endDate.getTime() - startDate.getTime() >
        TELEMETRY_HISTORY_MAX_RANGE_MS
    ) {
        throw createError(
            `Date range cannot exceed ${TELEMETRY_HISTORY_MAX_RANGE_MS / (60 * 60 * 1000)} hours.`,
            400
        );
    }

    if (earliestStart && startDate < earliestStart) {
        throw createError(
            `Route history is only available for the last ${Math.round(
                (Date.now() - earliestStart.getTime()) / (24 * 60 * 60 * 1000)
            )} days.`,
            400
        );
    }

    const rawPoints = await Telemetry.find({
        vehicle: vehicleId,
        recordedAt: { $gte: startDate, $lte: endDate },
    })
        .select(
            "latitude longitude speed heading ignition batteryLevel gpsFix recordedAt receivedAt -_id"
        )
        .sort({ recordedAt: 1 })
        .limit(TELEMETRY_HISTORY_QUERY_LIMIT)
        .lean();

    const points = sampleEvenly(rawPoints, TELEMETRY_HISTORY_MAX_POINTS);

    return {
        vehicleId,
        start: startDate,
        end: endDate,
        totalPoints: rawPoints.length,
        returnedPoints: points.length,
        sampled: points.length < rawPoints.length,
        points,
    };
};

/*
 * A partner's own fleet for the partner Live Tracking page, in one round
 * trip: each non-archived vehicle they own, its assigned tracker's
 * communication summary and its last known position.
 *
 * Allowlisted on purpose - never tracker credentials (deviceKey), IMEI/SIM
 * or any booking/renter data. A rented vehicle is only ever "Rented"
 * (vehicle.status); who is driving it is not part of this payload.
 */
export const getOperatorFleetTracking = async (operatorId) => {
    const vehicles = await Vehicle.find({
        operator: operatorId,
        status: { $ne: VEHICLE_STATUS.ARCHIVED },
    })
        .select("brand model vehicleCode plateNumber status")
        .sort({ brand: 1, model: 1 })
        .lean();

    const vehicleIds = vehicles.map((vehicle) => vehicle._id);

    const [trackers, states] = await Promise.all([
        Tracker.find({ vehicle: { $in: vehicleIds } })
            .select("vehicle status protocol lastSeenAt")
            .lean(),
        VehicleTrackingState.find({ vehicle: { $in: vehicleIds } })
            .select(
                "vehicle tracker latitude longitude speed heading ignition batteryLevel gpsFix recordedAt receivedAt source"
            )
            .lean(),
    ]);

    const trackerByVehicle = new Map(
        trackers.map((tracker) => [String(tracker.vehicle), tracker])
    );
    const stateByVehicle = new Map(
        states.map((state) => [String(state.vehicle), state])
    );

    return vehicles.map((vehicle) => {
        const tracker = trackerByVehicle.get(String(vehicle._id));

        return {
            vehicle,
            tracker: tracker
                ? {
                      _id: tracker._id,
                      status: tracker.status,
                      protocol: tracker.protocol,
                      lastSeenAt: tracker.lastSeenAt,
                  }
                : null,
            trackingState: stateByVehicle.get(String(vehicle._id)) || null,
        };
    });
};
