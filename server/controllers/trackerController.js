import asyncHandler from "../utils/asyncHandler.js";
import handleValidation from "../utils/handleValidation.js";
import { successResponse } from "../utils/response.js";

import {
    getAllTrackers,
    getTrackerById,
    createTracker,
    assignTrackerToVehicle,
    unassignTracker,
    disableTracker,
    enableTracker,
    updateTracker,
    regenerateDeviceKey,
} from "../services/trackerService.js";

export const listTrackers = asyncHandler(async (req, res) => {
    const trackers = await getAllTrackers();

    return successResponse(
        res,
        "Trackers retrieved successfully.",
        trackers
    );
});

export const getTracker = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await getTrackerById(req.params.id);

    return successResponse(
        res,
        "Tracker retrieved successfully.",
        tracker
    );
});

export const registerTracker = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await createTracker(req.body, req.user._id);

    return successResponse(
        res,
        tracker.deviceKey
            ? "Tracker registered successfully. Store the deviceKey now - it will not be shown again."
            : "Tracker registered successfully.",
        tracker,
        201
    );
});

export const assignTracker = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await assignTrackerToVehicle(
        req.params.id,
        req.body.vehicle,
        req.user._id
    );

    return successResponse(
        res,
        "Tracker assigned to vehicle successfully.",
        tracker
    );
});

export const unassignTrackerHandler = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await unassignTracker(req.params.id, req.user._id);

    return successResponse(
        res,
        "Tracker unassigned successfully.",
        tracker
    );
});

export const disableTrackerHandler = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await disableTracker(req.params.id, req.user._id);

    return successResponse(
        res,
        "Tracker disabled successfully.",
        tracker
    );
});

export const enableTrackerHandler = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await enableTracker(req.params.id, req.user._id);

    return successResponse(
        res,
        "Tracker enabled successfully.",
        tracker
    );
});

export const updateTrackerHandler = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await updateTracker(
        req.params.id,
        req.body,
        req.user._id
    );

    return successResponse(
        res,
        "Tracker updated successfully.",
        tracker
    );
});

export const regenerateDeviceKeyHandler = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const tracker = await regenerateDeviceKey(req.params.id, req.user._id);

    return successResponse(
        res,
        "Device key regenerated. Store the deviceKey now - it will not be shown again. The previous key no longer works.",
        tracker
    );
});
