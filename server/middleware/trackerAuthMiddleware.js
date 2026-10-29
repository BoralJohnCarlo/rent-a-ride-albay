import Tracker from "../models/Tracker.js";
import { errorResponse } from "../utils/response.js";
import {
    TRACKER_STATUS,
    HTTP_INGEST_PROTOCOLS,
} from "../constants/telemetryConstants.js";

/*
 * Authenticates an HTTP tracker (today: the simulator) by IMEI + deviceKey,
 * completely independent of the operator/driver/admin JWT session handled
 * by authMiddleware.js. A real-protocol tracker never comes through here -
 * its adapter will authenticate it however that protocol does, and
 * trackingService only ever receives an already-authenticated `tracker`.
 *
 * Unknown device and wrong key deliberately share one 401 message so the
 * endpoint can't be used to discover which Device IDs exist. The key is
 * never logged or echoed.
 */
export const authenticateTracker = async (req, res, next) => {
    try {
        const imei = req.headers["x-tracker-imei"];
        const deviceKey = req.headers["x-tracker-key"];

        if (!imei || !deviceKey) {
            return errorResponse(
                res,
                "Tracker credentials are required.",
                401
            );
        }

        const tracker = await Tracker.findOne({ imei: String(imei) }).select(
            "+deviceKey"
        );

        const isValid = tracker
            ? await tracker.compareDeviceKey(String(deviceKey))
            : false;

        if (!isValid) {
            return errorResponse(
                res,
                "Invalid tracker credentials.",
                401
            );
        }

        if (!HTTP_INGEST_PROTOCOLS.includes(tracker.protocol)) {
            return errorResponse(
                res,
                "This tracker does not accept HTTP telemetry.",
                403
            );
        }

        if (tracker.status === TRACKER_STATUS.INACTIVE) {
            return errorResponse(
                res,
                "Tracker is inactive.",
                403
            );
        }

        req.tracker = tracker;

        next();
    } catch (error) {
        next(error);
    }
};
