import asyncHandler from "../utils/asyncHandler.js";
import handleValidation from "../utils/handleValidation.js";
import { successResponse } from "../utils/response.js";
import createError from "../utils/createError.js";

import { normalizeTelemetryPayload } from "../services/telemetryNormalizationService.js";
import {
    ingestTelemetry,
    getCurrentVehicleState,
    getVehicleTelemetryHistory,
    getOperatorFleetTracking,
} from "../services/trackingService.js";
import { canAccessVehicle } from "../services/vehicleAccessService.js";
import { TELEMETRY_OPERATOR_HISTORY_WINDOW_MS } from "../constants/telemetryConstants.js";

/*
 * Same 404 whether the vehicle doesn't exist or belongs to someone else -
 * a partner must not be able to probe which vehicle IDs exist.
 */
const assertVehicleAccess = async (user, vehicleId) => {
    if (!(await canAccessVehicle(user, vehicleId))) {
        throw createError("Vehicle not found.", 404);
    }
};

export const ingestTelemetryHandler = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const normalizedTelemetry = normalizeTelemetryPayload(req.body);

    // Source is derived from req.tracker's protocol inside trackingService -
    // never from the request body.
    const result = await ingestTelemetry(req.tracker, normalizedTelemetry);

    return successResponse(
        res,
        result.stateAdvanced
            ? "Telemetry ingested successfully."
            : "Telemetry stored as history. It is not newer than the vehicle's current position.",
        result,
        201
    );
});

export const getCurrentVehicleStateHandler = asyncHandler(
    async (req, res) => {
        if (!handleValidation(req, res)) {
            return;
        }

        await assertVehicleAccess(req.user, req.params.vehicleId);

        const state = await getCurrentVehicleState(
            req.params.vehicleId
        );

        return successResponse(
            res,
            "Current vehicle tracking state retrieved successfully.",
            state
        );
    }
);

export const getVehicleTelemetryHistoryHandler = asyncHandler(
    async (req, res) => {
        if (!handleValidation(req, res)) {
            return;
        }

        await assertVehicleAccess(req.user, req.params.vehicleId);

        const history = await getVehicleTelemetryHistory(
            req.params.vehicleId,
            {
                start: req.query.start,
                end: req.query.end,
                earliestStart:
                    req.user.role === "admin"
                        ? null
                        : new Date(
                              Date.now() -
                                  TELEMETRY_OPERATOR_HISTORY_WINDOW_MS
                          ),
            }
        );

        return successResponse(
            res,
            "Vehicle telemetry history retrieved successfully.",
            history
        );
    }
);

// Partner Live Tracking page - always scoped to req.user, never a
// client-supplied operator id.
export const getMyFleetTrackingHandler = asyncHandler(async (req, res) => {
    const fleet = await getOperatorFleetTracking(req.user._id);

    return successResponse(
        res,
        "Fleet tracking retrieved successfully.",
        fleet
    );
});
