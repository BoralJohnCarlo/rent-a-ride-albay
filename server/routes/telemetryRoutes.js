import express from "express";
import rateLimit from "express-rate-limit";

import {
    ingestTelemetryHandler,
    getCurrentVehicleStateHandler,
    getVehicleTelemetryHistoryHandler,
    getMyFleetTrackingHandler,
} from "../controllers/telemetryController.js";

import {
    ingestTelemetryValidator,
    vehicleIdParamValidator,
    vehicleHistoryValidator,
} from "../validators/telemetryValidator.js";

import { authenticateTracker } from "../middleware/trackerAuthMiddleware.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import {
    INGEST_FAILED_AUTH_WINDOW_MS,
    INGEST_FAILED_AUTH_MAX,
    INGEST_DEVICE_WINDOW_MS,
    INGEST_DEVICE_MAX,
} from "../constants/telemetryConstants.js";

const router = express.Router();

/*
 * Runs BEFORE authenticateTracker and counts only rejected credentials
 * (401), per IP - stops brute-forcing Device ID/key pairs (and the bcrypt
 * work each attempt costs). 403s (valid key, but tracker disabled or not an
 * HTTP protocol) are not credential guesses, so a disabled device retrying
 * can't lock out its IP.
 */
const ingestFailedAuthRateLimiter = rateLimit({
    windowMs: INGEST_FAILED_AUTH_WINDOW_MS,
    max: INGEST_FAILED_AUTH_MAX,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
    message: {
        success: false,
        message: "Too many failed tracker authentication attempts. Please try again later.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/*
 * Runs AFTER authenticateTracker, keyed by the authenticated tracker rather
 * than IP, so several simulators on one machine each get their own budget.
 */
const ingestDeviceRateLimiter = rateLimit({
    windowMs: INGEST_DEVICE_WINDOW_MS,
    max: INGEST_DEVICE_MAX,
    keyGenerator: (req) => `tracker:${req.tracker._id}`,
    message: {
        success: false,
        message: "Tracker is sending telemetry too frequently.",
        data: null,
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Tracker-authenticated ingestion - NOT operator/driver/admin authenticated.
// HTTP-protocol trackers only (see trackerAuthMiddleware.js).
router.post(
    "/ingest",
    ingestFailedAuthRateLimiter,
    authenticateTracker,
    ingestDeviceRateLimiter,
    ingestTelemetryValidator,
    ingestTelemetryHandler
);

// Partner's own fleet with tracker summaries + last known positions.
router.get(
    "/fleet/mine",
    protect,
    authorize("operator"),
    getMyFleetTrackingHandler
);

// Operators are allowed through here; the controller then 404s any vehicle
// they don't own (services/vehicleAccessService.js) and caps how far back
// their history may reach.
router.get(
    "/vehicles/:vehicleId/current",
    protect,
    authorize("admin", "operator"),
    vehicleIdParamValidator,
    getCurrentVehicleStateHandler
);

router.get(
    "/vehicles/:vehicleId/history",
    protect,
    authorize("admin", "operator"),
    vehicleHistoryValidator,
    getVehicleTelemetryHistoryHandler
);

export default router;
