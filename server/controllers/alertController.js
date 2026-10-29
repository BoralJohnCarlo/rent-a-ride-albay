import asyncHandler from "../utils/asyncHandler.js";
import handleValidation from "../utils/handleValidation.js";
import { successResponse } from "../utils/response.js";

import {
    getAlerts,
    getActiveAlerts,
    getAlertById,
    markAlertRead,
    resolveAlertManually,
} from "../services/alertService.js";

export const listAlerts = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const alerts = await getAlerts(req.user, req.query);

    return successResponse(
        res,
        "Alerts retrieved successfully.",
        alerts
    );
});

export const listActiveAlerts = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const alerts = await getActiveAlerts(req.user, req.query);

    return successResponse(
        res,
        "Active alerts retrieved successfully.",
        alerts
    );
});

export const getAlert = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const alert = await getAlertById(req.user, req.params.id);

    return successResponse(
        res,
        "Alert retrieved successfully.",
        alert
    );
});

export const readAlert = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const alert = await markAlertRead(req.user, req.params.id);

    return successResponse(
        res,
        "Alert marked as read.",
        alert
    );
});

export const resolveAlert = asyncHandler(async (req, res) => {
    if (!handleValidation(req, res)) {
        return;
    }

    const alert = await resolveAlertManually(req.user, req.params.id);

    return successResponse(
        res,
        "Alert resolved successfully.",
        alert
    );
});
