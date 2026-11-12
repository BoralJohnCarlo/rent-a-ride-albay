import Alert from "../models/Alert.js";
import Tracker from "../models/Tracker.js";
import Vehicle from "../models/Vehicle.js";
import VehicleTrackingState from "../models/VehicleTrackingState.js";
import { broadcastResolvedAlert } from "../sockets/broadcastAlerts.js";
import createError from "../utils/createError.js";
import {
    ALERT_TYPE,
    ALERT_STATUS,
    ALERT_DEFINITIONS,
    LOW_BATTERY_THRESHOLD_PERCENT,
    MIN_GPS_STALE_THRESHOLD_MS,
    getGpsStaleThresholdMs,
} from "../constants/alertConstants.js";
import { TRACKER_STATUS } from "../constants/telemetryConstants.js";
import { VEHICLE_STATUS } from "../constants/vehicleConstants.js";

const DUPLICATE_KEY_ERROR_CODE = 11000;

const findActiveAlert = (vehicleId, type) =>
    Alert.findOne({
        vehicle: vehicleId,
        type,
        status: ALERT_STATUS.ACTIVE,
    });

/*
 * Returns the created alert, or null when a concurrent evaluation already
 * created the same ACTIVE vehicle+type alert - the partial unique index on
 * Alert (see models/Alert.js) turns that race into a duplicate-key error
 * instead of a second row.
 */
const createAlert = async ({ vehicle, tracker, type, context = {}, alertSession = null }) => {
    const definition = ALERT_DEFINITIONS[type];

    try {
        return await Alert.create({
            vehicle,
            tracker,
            type,
            severity: definition.severity,
            title: definition.title,
            message: definition.buildMessage(context),
            context,
            alertSession,
        });
    } catch (error) {
        if (error?.code === DUPLICATE_KEY_ERROR_CODE) {
            return null;
        }

        throw error;
    }
};

const resolveAlertDoc = (alertDoc) => Alert.findOneAndUpdate(
    { _id: alertDoc._id, status: ALERT_STATUS.ACTIVE },
    { $set: { status: ALERT_STATUS.RESOLVED, resolvedAt: new Date() } },
    { returnDocument: "after" }
);

/*
 * Generic condition evaluator shared by every alert type. Alert documents
 * hold the lifecycle history; the latest tracker/snapshot supplies the
 * current condition. Reconciliation below handles changes during awaits.
 *
 *   condition true  + no active alert  -> create one
 *   condition true  + active alert     -> no-op (still true, no duplicate)
 *   condition false + active alert     -> resolve it
 *   condition false + no active alert  -> no-op (nothing to resolve)
 *   condition null (unknown)           -> no-op (neither create nor resolve)
 *
 * `conditionMet: null` is for readings where the device didn't report the
 * relevant value - "unknown" must never be read as "recovered".
 */
// Read the authoritative condition after the alert lookup and again after
// mutation. If state changed during a database await, reconcile before
// returning events. This also works across multiple server processes.
const evaluateCondition = async ({ vehicle, tracker, type, conditionMet, context, readCurrent }) => {
    if (conditionMet === null) return {};
    let created, resolved;
    for (;;) {
        const existing = await findActiveAlert(vehicle, type);
        // A request from a replaced tracker must not resolve its successor's alert.
        if (existing?.tracker && String(existing.tracker) !== String(tracker)) return { created, resolved };
        const current = readCurrent ? await readCurrent() : { conditionMet, context };
        if (current.conditionMet === null) return { created, resolved };
        // An active condition after enable/assignment belongs to the new session.
        // Retire the previous row before creating its successor (unique index).
        if (current.conditionMet && existing &&
            (existing.alertSession ?? null) !== (current.alertSession ?? null)) {
            const result = await resolveAlertDoc(existing);
            if (result) resolved = result;
            continue;
        }
        if (current.conditionMet && !existing) {
            created = await createAlert({ vehicle, tracker, type, context: current.context, alertSession: current.alertSession });
        } else if (!current.conditionMet && existing) {
            const result = await resolveAlertDoc(existing);
            if (result) {
                resolved = result;
                if (String(created?._id) === String(result._id)) created = null;
            }
        }
        const latest = readCurrent ? await readCurrent() : current;
        if (JSON.stringify(latest) === JSON.stringify(current)) {
            // Another evaluator may already have resolved the row we created.
            if (created && !(await Alert.exists({ _id: created._id, status: ALERT_STATUS.ACTIVE }))) created = null;
            return { created, resolved };
        }
    }
};

const readTelemetryCondition = (tracker, field, predicate) => async () => {
    const assigned = await Tracker.findOne({ _id: tracker._id, vehicle: tracker.vehicle, status: TRACKER_STATUS.ACTIVE }).select("alertSession").lean();
    const trackable = assigned && await Vehicle.exists({ _id: tracker.vehicle, status: { $ne: VEHICLE_STATUS.ARCHIVED } });
    if (!trackable) return { conditionMet: false, context: {} };
    const state = await VehicleTrackingState.findOne({ vehicle: tracker.vehicle, tracker: tracker._id }).lean();
    return {
        conditionMet: whenKnown(state?.[field], predicate),
        alertSession: assigned.alertSession ?? null,
        context: field === "batteryLevel" ? { batteryLevel: state?.batteryLevel } : {},
    };
};

const readCommunicationCondition = (tracker, allowCreate) => async () => {
    const current = await Tracker.findOne({ _id: tracker._id, vehicle: tracker.vehicle, status: TRACKER_STATUS.ACTIVE }).lean();
    const trackable = current && await Vehicle.exists({ _id: tracker.vehicle, status: { $ne: VEHICLE_STATUS.ARCHIVED } });
    if (!trackable || !current.lastSeenAt) return { conditionMet: false, context: {} };
    const offline = Date.now() - new Date(current.lastSeenAt).getTime() > getGpsStaleThresholdMs(current.protocol);
    return { conditionMet: offline ? (allowCreate ? true : null) : false,
        alertSession: current.alertSession ?? null,
        context: offline ? { lastSeenAt: current.lastSeenAt } : {} };
};

// null when the device didn't report the value, otherwise the predicate.
const whenKnown = (value, predicate) =>
    value === null || value === undefined ? null : predicate(value);

const collectResults = (results) => ({
    created: results.filter((r) => r.created).map((r) => r.created),
    resolved: results.filter((r) => r.resolved).map((r) => r.resolved),
});

/*
 * Called from trackingService.ingestTelemetry for a reading that advanced
 * the vehicle's latest state. The reading identifies which fields were
 * reported; their values are reread from the persisted snapshot so a slow
 * older evaluation cannot flip the current alert state. GPS_OFFLINE is
 * a communication concern, handled by evaluateCommunicationAlerts below.
 */
export const evaluateTelemetryAlerts = async (tracker, normalizedTelemetry) => {
    const vehicle = tracker.vehicle;
    const trackerId = tracker._id;
    const { gpsFix, batteryLevel, ignition } = normalizedTelemetry;
    const results = [];

    results.push(
        await evaluateCondition({
            vehicle,
            tracker: trackerId,
            type: ALERT_TYPE.GPS_LOST,
            conditionMet: whenKnown(gpsFix, (value) => value === false),
            context: {},
            readCurrent: readTelemetryCondition(tracker, "gpsFix", value => value === false),
        })
    );

    results.push(
        await evaluateCondition({
            vehicle,
            tracker: trackerId,
            type: ALERT_TYPE.LOW_BATTERY,
            conditionMet: whenKnown(
                batteryLevel,
                (value) => value < LOW_BATTERY_THRESHOLD_PERCENT
            ),
            context: { batteryLevel },
            readCurrent: readTelemetryCondition(tracker, "batteryLevel", value => value < LOW_BATTERY_THRESHOLD_PERCENT),
        })
    );

    results.push(
        await evaluateCondition({
            vehicle,
            tracker: trackerId,
            type: ALERT_TYPE.IGNITION_ON,
            conditionMet: whenKnown(ignition, (value) => value === true),
            context: {},
            readCurrent: readTelemetryCondition(tracker, "ignition", value => value === true),
        })
    );

    return collectResults(results);
};

/*
 * Any authenticated communication from an assigned tracker (a telemetry
 * reading of any age, or a heartbeat) proves it is online again, so it
 * resolves GPS_OFFLINE. GPS_OFFLINE is only ever *created* by the cron sweep
 * below, since communication can't observe its own absence. GPS fix absence
 * is GPS_LOST, never GPS_OFFLINE.
 */
export const evaluateCommunicationAlerts = async (tracker) => {
    if (!tracker.vehicle) {
        return { created: [], resolved: [] };
    }

    const result = await evaluateCondition({
        vehicle: tracker.vehicle,
        tracker: tracker._id,
        type: ALERT_TYPE.GPS_OFFLINE,
        conditionMet: false,
        context: {},
        readCurrent: readCommunicationCondition(tracker, false),
    });

    return collectResults([result]);
};

/*
 * Resolves ACTIVE alerts for the supplied tracker/vehicle relationship.
 * When both IDs are supplied, both must match. A single ID still supports
 * tracker-wide cleanup or vehicle-wide cleanup on archival.
 * Used when a tracker is unassigned, reassigned, disabled, or its
 * vehicle archived, so no alert is left active for a relationship that no
 * longer exists. Each alert is resolved with a conditional update, so an
 * alert resolved concurrently elsewhere is simply skipped. History is kept
 * (alerts are resolved, never deleted).
 */
export const resolveActiveAlertsForTracker = async ({
    trackerId = null,
    vehicleId = null,
    alertSession = undefined,
}) => {
    const scope = {};

    if (trackerId) {
        scope.tracker = trackerId;
    }

    if (vehicleId) {
        scope.vehicle = vehicleId;
    }

    if (Object.keys(scope).length === 0) {
        return [];
    }

    // Null also matches legacy alerts that predate session tracking.
    if (alertSession !== undefined) scope.alertSession = alertSession;

    const activeAlerts = await Alert.find({
        status: ALERT_STATUS.ACTIVE,
        ...scope,
    })
        .select("_id")
        .lean();

    const resolved = [];

    for (const { _id } of activeAlerts) {
        const alert = await Alert.findOneAndUpdate(
            { _id, status: ALERT_STATUS.ACTIVE },
            {
                status: ALERT_STATUS.RESOLVED,
                resolvedAt: new Date(),
            },
            { new: true }
        );

        if (alert) {
            resolved.push(alert);
        }
    }

    return resolved;
};

/*
 * Scheduled sweep (see server/cron/index.js) - the only way GPS_OFFLINE
 * alerts are created. Uses Tracker.lastSeenAt, i.e. communication activity
 * (telemetry or heartbeat), never GPS fix state.
 *
 * Only ACTIVE trackers are considered (enabled + assigned) - disabled and
 * unassigned trackers never raise vehicle offline alerts - and vehicles that
 * have been archived are skipped. A tracker that has never communicated is
 * "Waiting", not "Offline", matching the frontend's own GPS status model.
 *
 * The threshold is per protocol (getGpsStaleThresholdMs): 60s for the
 * simulator, longer for AIKA, whose parked devices report far less often.
 */
export const detectOfflineTrackers = async () => {
    const now = Date.now();

    // Pre-filter by the smallest threshold, then apply each tracker's own
    // protocol threshold (see getGpsStaleThresholdMs).
    const candidates = (
        await Tracker.find({
            status: TRACKER_STATUS.ACTIVE,
            vehicle: { $ne: null },
            lastSeenAt: {
                $ne: null,
                $lt: new Date(now - MIN_GPS_STALE_THRESHOLD_MS),
            },
        })
            .select("_id vehicle lastSeenAt protocol")
            .lean()
    ).filter(
        (tracker) =>
            new Date(tracker.lastSeenAt).getTime() <
            now - getGpsStaleThresholdMs(tracker.protocol)
    );

    if (candidates.length === 0) {
        return [];
    }

    const trackableVehicleIds = new Set(
        (
            await Vehicle.find({
                _id: { $in: candidates.map((tracker) => tracker.vehicle) },
                status: { $ne: VEHICLE_STATUS.ARCHIVED },
            }).distinct("_id")
        ).map(String)
    );

    const staleTrackers = candidates.filter((tracker) =>
        trackableVehicleIds.has(String(tracker.vehicle))
    );

    const created = [];

    for (const tracker of staleTrackers) {
        const { created: newAlert, resolved } = await evaluateCondition({
            vehicle: tracker.vehicle,
            tracker: tracker._id,
            type: ALERT_TYPE.GPS_OFFLINE,
            conditionMet: true,
            context: { lastSeenAt: tracker.lastSeenAt },
            readCurrent: readCommunicationCondition(tracker, true),
        });

        if (newAlert) {
            created.push(newAlert);
        }
        // The sweep can compensate for a heartbeat racing its alert insert.
        if (resolved) broadcastResolvedAlert(resolved);
    }

    return created;
};

const buildVehicleScope = async (user) => {
    if (user.role === "admin") {
        return null; // no restriction
    }

    if (user.role === "operator") {
        const vehicles = await Vehicle.find({ operator: user._id })
            .select("_id")
            .lean();

        return vehicles.map((v) => v._id);
    }

    return []; // no vehicles - matches customers never seeing fleet alerts
};

const buildListQuery = async (user, { status, type, vehicle, start, end }) => {
    const query = {};

    const scope = await buildVehicleScope(user);

    if (scope !== null) {
        query.vehicle = { $in: scope };
    }

    if (vehicle) {
        // Intersect with the caller's own filter rather than trusting it
        // outright - an operator passing another operator's vehicle id
        // must still see nothing.
        if (scope !== null && !scope.some((id) => String(id) === vehicle)) {
            query.vehicle = { $in: [] };
        } else {
            query.vehicle = vehicle;
        }
    }

    if (status) {
        query.status = status;
    }

    if (type) {
        query.type = type;
    }

    if (start || end) {
        query.triggeredAt = {};

        if (start) {
            query.triggeredAt.$gte = new Date(start);
        }

        if (end) {
            query.triggeredAt.$lte = new Date(end);
        }
    }

    return query;
};

export const getAlerts = async (user, filters = {}) => {
    const query = await buildListQuery(user, filters);

    return Alert.find(query).sort({ triggeredAt: -1 }).lean();
};

export const getActiveAlerts = async (user, filters = {}) => {
    const query = await buildListQuery(user, {
        ...filters,
        status: ALERT_STATUS.ACTIVE,
    });

    return Alert.find(query).sort({ triggeredAt: -1 }).lean();
};

const findAuthorizedAlert = async (user, alertId) => {
    const alert = await Alert.findById(alertId);

    if (!alert) {
        throw createError("Alert not found.", 404);
    }

    const scope = await buildVehicleScope(user);

    if (
        scope !== null &&
        !scope.some((id) => String(id) === String(alert.vehicle))
    ) {
        // Deliberately the same 404 as "doesn't exist" - an unauthorized
        // caller should not learn that an alert exists for a vehicle they
        // don't own.
        throw createError("Alert not found.", 404);
    }

    return alert;
};

export const getAlertById = async (user, alertId) => {
    const alert = await findAuthorizedAlert(user, alertId);

    return alert.toObject();
};

export const markAlertRead = async (user, alertId) => {
    const alert = await findAuthorizedAlert(user, alertId);

    alert.isRead = true;
    await alert.save();

    return alert.toObject();
};

export const resolveAlertManually = async (user, alertId) => {
    // Also enforced on the route - kept here so no other caller can let a
    // partner resolve an alert.
    if (user?.role !== "admin") {
        throw createError("Only admins can resolve alerts.", 403);
    }

    const alert = await findAuthorizedAlert(user, alertId);

    if (alert.status === ALERT_STATUS.RESOLVED) {
        throw createError("Alert is already resolved.", 409);
    }

    const resolved = await resolveAlertDoc(alert);
    if (!resolved) throw createError("Alert is already resolved.", 409);
    return resolved.toObject();
};
