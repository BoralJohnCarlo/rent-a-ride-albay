import crypto from "node:crypto";

import Tracker from "../models/Tracker.js";
import Vehicle from "../models/Vehicle.js";
import createError from "../utils/createError.js";
import { resolveActiveAlertsForTracker } from "./alertService.js";
import { broadcastResolvedAlert } from "../sockets/broadcastAlerts.js";
import {
    TRACKER_STATUS,
    TRACKER_PROTOCOL,
    DEVICE_KEY_PROTOCOLS,
} from "../constants/telemetryConstants.js";
import { VEHICLE_STATUS } from "../constants/vehicleConstants.js";

const generateDeviceKey = () => crypto.randomBytes(24).toString("hex");

const issuesDeviceKey = (protocol) => DEVICE_KEY_PROTOCOLS.includes(protocol);

/*
 * Status is derived, never chosen freely: a disabled (INACTIVE) tracker
 * stays INACTIVE whatever its assignment; an enabled one is ACTIVE when
 * assigned and UNASSIGNED when not.
 */
const deriveEnabledStatus = (vehicleId) =>
    vehicleId ? TRACKER_STATUS.ACTIVE : TRACKER_STATUS.UNASSIGNED;

const statusAfterAssignmentChange = (tracker, vehicleId) =>
    tracker.status === TRACKER_STATUS.INACTIVE
        ? TRACKER_STATUS.INACTIVE
        : deriveEnabledStatus(vehicleId);

// deviceKey is select:false, but strip it defensively from every response
// built from a document that may have selected it.
const toSafeTracker = (tracker) => {
    const result = tracker.toObject();
    delete result.deviceKey;

    return result;
};

const findTrackerOrThrow = async (trackerId, { withDeviceKey = false } = {}) => {
    const query = Tracker.findById(trackerId);

    if (withDeviceKey) {
        query.select("+deviceKey");
    }

    const tracker = await query;

    if (!tracker) {
        throw createError("Tracker not found.", 404);
    }

    return tracker;
};

const resolveAndBroadcastAlerts = async (scope) => {
    const resolved = await resolveActiveAlertsForTracker(scope);
    resolved.forEach(broadcastResolvedAlert);

    return resolved;
};

// A vehicle that can receive tracking: exists and isn't archived.
export const isVehicleTrackable = async (vehicleId) =>
    Boolean(
        await Vehicle.exists({
            _id: vehicleId,
            status: { $ne: VEHICLE_STATUS.ARCHIVED },
        })
    );

const ensureVehicleAssignable = async (vehicleId) => {
    const vehicle = await Vehicle.findById(vehicleId)
        .select("_id status")
        .lean();

    if (!vehicle) {
        throw createError("Vehicle not found.", 404);
    }

    if (vehicle.status === VEHICLE_STATUS.ARCHIVED) {
        throw createError(
            "Archived vehicles cannot be assigned a tracker.",
            409
        );
    }
};

const ensureVehicleUnassigned = async (
    vehicleId,
    excludeTrackerId = null
) => {
    const query = { vehicle: vehicleId };

    if (excludeTrackerId) {
        query._id = { $ne: excludeTrackerId };
    }

    const existing = await Tracker.findOne(query)
        .select("_id")
        .lean();

    if (existing) {
        throw createError(
            "This vehicle already has an assigned tracker.",
            409
        );
    }
};

// Non-lean reads so schema defaults (e.g. `protocol` on trackers created
// before it existed) are applied to the response.
export const getAllTrackers = async () => {
    const trackers = await Tracker.find().sort({ createdAt: -1 });

    return trackers.map(toSafeTracker);
};

export const getTrackerById = async (trackerId) => {
    const tracker = await findTrackerOrThrow(trackerId);

    return toSafeTracker(tracker);
};

export const createTracker = async (trackerData, adminId) => {
    const protocol = trackerData.protocol || TRACKER_PROTOCOL.HTTP_SIMULATOR;

    if (trackerData.vehicle) {
        await ensureVehicleAssignable(trackerData.vehicle);
        await ensureVehicleUnassigned(trackerData.vehicle);
    }

    // Only HTTP-authenticated protocols get a deviceKey - a real-protocol
    // tracker authenticates however its (not yet implemented) protocol does.
    const deviceKey = issuesDeviceKey(protocol) ? generateDeviceKey() : null;

    const tracker = await Tracker.create({
        imei: trackerData.imei,
        protocol,
        model: trackerData.model || "",
        simNumber: trackerData.simNumber || "",
        notes: trackerData.notes || "",
        vehicle: trackerData.vehicle || null,
        deviceKey,
        status: deriveEnabledStatus(trackerData.vehicle),
        audit: {
            createdBy: adminId,
            updatedBy: adminId,
        },
    });

    const result = toSafeTracker(tracker);

    // The plaintext key is returned exactly once, here.
    return deviceKey ? { ...result, deviceKey } : result;
};

/*
 * Assigns or reassigns. On reassignment the previous vehicle's active
 * alerts are resolved; its Telemetry history and last VehicleTrackingState
 * are left untouched. New telemetry is stamped with the new vehicle at
 * ingest time, so nothing old is rewritten.
 */
export const assignTrackerToVehicle = async (
    trackerId,
    vehicleId,
    adminId
) => {
    const tracker = await findTrackerOrThrow(trackerId);

    await ensureVehicleAssignable(vehicleId);
    await ensureVehicleUnassigned(vehicleId, tracker._id);

    const previousVehicleId = tracker.vehicle;

    tracker.vehicle = vehicleId;
    tracker.status = statusAfterAssignmentChange(tracker, vehicleId);
    tracker.audit.updatedBy = adminId;

    await tracker.save();

    if (previousVehicleId && String(previousVehicleId) !== String(vehicleId)) {
        await resolveAndBroadcastAlerts({
            trackerId: tracker._id,
            vehicleId: previousVehicleId,
        });
    }

    return toSafeTracker(tracker);
};

export const unassignTracker = async (trackerId, adminId) => {
    const tracker = await findTrackerOrThrow(trackerId);

    if (!tracker.vehicle) {
        throw createError("Tracker is not assigned to a vehicle.", 409);
    }

    const previousVehicleId = tracker.vehicle;

    tracker.vehicle = null;
    tracker.status = statusAfterAssignmentChange(tracker, null);
    tracker.audit.updatedBy = adminId;

    await tracker.save();

    await resolveAndBroadcastAlerts({
        trackerId: tracker._id,
        vehicleId: previousVehicleId,
    });

    return toSafeTracker(tracker);
};

/*
 * Disabling keeps the record, its assignment, history and deviceKey - it
 * only stops ingestion (trackerAuthMiddleware rejects INACTIVE) and offline
 * detection (the sweep only considers ACTIVE trackers).
 */
export const disableTracker = async (trackerId, adminId) => {
    const tracker = await findTrackerOrThrow(trackerId);

    if (tracker.status === TRACKER_STATUS.INACTIVE) {
        throw createError("Tracker is already disabled.", 409);
    }

    tracker.status = TRACKER_STATUS.INACTIVE;
    tracker.audit.updatedBy = adminId;

    await tracker.save();

    await resolveAndBroadcastAlerts({
        trackerId: tracker._id,
        vehicleId: tracker.vehicle,
    });

    return toSafeTracker(tracker);
};

/*
 * Re-enables to whichever status the assignment supports. An assignment
 * that became invalid while disabled (vehicle archived/removed) is cleared
 * rather than re-activated.
 */
export const enableTracker = async (trackerId, adminId) => {
    const tracker = await findTrackerOrThrow(trackerId);

    if (tracker.status !== TRACKER_STATUS.INACTIVE) {
        throw createError("Tracker is already enabled.", 409);
    }

    if (tracker.vehicle && !(await isVehicleTrackable(tracker.vehicle))) {
        tracker.vehicle = null;
    }

    tracker.status = deriveEnabledStatus(tracker.vehicle);
    tracker.audit.updatedBy = adminId;

    await tracker.save();

    return toSafeTracker(tracker);
};

// Descriptive fields only - identity (imei), protocol and status each have
// their own controlled flow.
export const updateTracker = async (trackerId, trackerData, adminId) => {
    const tracker = await findTrackerOrThrow(trackerId);

    ["model", "simNumber", "notes"].forEach((field) => {
        if (trackerData[field] !== undefined) {
            tracker[field] = trackerData[field];
        }
    });

    tracker.audit.updatedBy = adminId;

    await tracker.save();

    return toSafeTracker(tracker);
};

/*
 * Replaces the deviceKey; only the bcrypt hash is stored (Tracker pre-save
 * hook), so the old key stops authenticating as soon as this saves. The new
 * plaintext is returned exactly once and never logged.
 */
export const regenerateDeviceKey = async (trackerId, adminId) => {
    const tracker = await findTrackerOrThrow(trackerId, {
        withDeviceKey: true,
    });

    if (!issuesDeviceKey(tracker.protocol)) {
        throw createError(
            "This tracker's protocol does not use an HTTP device key.",
            409
        );
    }

    const deviceKey = generateDeviceKey();

    tracker.deviceKey = deviceKey;
    tracker.audit.updatedBy = adminId;

    await tracker.save();

    return { ...toSafeTracker(tracker), deviceKey };
};

/*
 * Called when a vehicle is archived: unassigns whatever tracker it has (so
 * GPS data can never land on a retired vehicle) and resolves the vehicle's
 * active GPS alerts. Telemetry history is kept.
 */
export const releaseTrackersForVehicle = async (vehicleId, adminId = null) => {
    const trackers = await Tracker.find({ vehicle: vehicleId });

    for (const tracker of trackers) {
        tracker.vehicle = null;
        tracker.status = statusAfterAssignmentChange(tracker, null);
        tracker.audit.updatedBy = adminId;

        await tracker.save();
    }

    await resolveAndBroadcastAlerts({ vehicleId });

    return trackers.length;
};
