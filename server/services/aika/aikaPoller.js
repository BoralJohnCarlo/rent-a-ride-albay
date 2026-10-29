/*
 * AIKA cloud adapter: polls AIKA's GetTracking for the AK-61220 and feeds
 * the result into the existing pipeline - trackingService.ingestTelemetry
 * for a new position, trackingService.recordHeartbeat for "still online,
 * no new position". It never writes Telemetry/VehicleTrackingState itself.
 *
 * Disabled unless AIKA_ENABLED=true. Poll interval: AIKA_POLL_INTERVAL_SECONDS
 * (default 30, minimum 15). Credentials: see aikaClient.js.
 *
 * Field mapping, verified against the real device on 2026-10-01 (every AIKA
 * value arrives as a string):
 *   lat / lng      -> latitude / longitude
 *   positionTime   -> recordedAt, "YYYY-MM-DD HH:mm:ss" in UTC (verified:
 *                     a fix stamped 03:30:44 was served at 03:31:15 UTC, and
 *                     the TimeZones parameter has no effect)
 *   speed          -> speed, ASSUMED km/h. Not yet compared against a
 *                     speedometer - the only moving sample (11.11, on foot)
 *                     was GPS noise after re-acquiring a fix.
 *   course         -> heading (degrees)
 *   isGPS          -> gpsFix: "1" true, "0" false, else unknown
 *   battery        -> batteryLevel; "-1" (what this wired unit reports) and
 *                     anything outside 0-100 mean "not reported" -> null
 *   status         -> ignition: "ACC ON" true, "ACC OFF" false, else null.
 *                     e.g. "2-ACC OFF,Dismiss,Power Connected". ACC ON has
 *                     not been observed yet (ignition line not wired).
 *   ofl            -> minutes since the device last contacted AIKA (went 0
 *                     on each report, counted up while silent). This - not
 *                     the age of positionTime - is the online signal: a
 *                     parked device stays online for minutes without a new
 *                     fix.
 */
import Telemetry from "../../models/Telemetry.js";
import Tracker from "../../models/Tracker.js";
import {
    ingestTelemetry,
    recordHeartbeat,
} from "../trackingService.js";
import {
    createAikaClient,
    getMissingAikaEnv,
} from "./aikaClient.js";
import {
    TRACKER_STATUS,
    TRACKER_PROTOCOL,
} from "../../constants/telemetryConstants.js";
import { getGpsStaleThresholdMs } from "../../constants/alertConstants.js";

const DEFAULT_POLL_INTERVAL_SECONDS = 30;
const MIN_POLL_INTERVAL_SECONDS = 15;
const MAX_BACKOFF_MS = 5 * 60 * 1000;

// Contact older than the offline threshold isn't "online" - the cron
// offline sweep takes over from there.
export const AIKA_ONLINE_MAX_MS = getGpsStaleThresholdMs(
    TRACKER_PROTOCOL.AIKA_CLOUD
);

const POSITION_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

// "" and non-numeric values are unknown (Number("") would be 0).
const toNumberOrNull = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    const text = String(value).trim();

    if (text === "") {
        return null;
    }

    const number = Number(text);

    return Number.isFinite(number) ? number : null;
};

export const parseAikaPositionTime = (value) => {
    const match = POSITION_TIME_PATTERN.exec(String(value ?? "").trim());

    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second] = match.map(Number);
    const date = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second)
    );

    return Number.isNaN(date.getTime()) ? null : date;
};

export const parseAikaIgnition = (status) => {
    const text = String(status ?? "").toUpperCase();
    const isOn = /\bACC ON\b/.test(text);
    const isOff = /\bACC OFF\b/.test(text);

    if (isOn === isOff) {
        return null; // neither, or contradictory
    }

    return isOn;
};

const parseGpsFix = (isGPS) => {
    if (isGPS === "1" || isGPS === 1) return true;
    if (isGPS === "0" || isGPS === 0) return false;
    return null;
};

const parseBattery = (battery) => {
    const value = toNumberOrNull(battery);

    return value === null || value < 0 || value > 100 ? null : value;
};

const parseHeading = (course) => {
    const value = toNumberOrNull(course);

    return value === null || value < 0 || value > 360 ? null : value;
};

const parseSpeed = (speed) => {
    const value = toNumberOrNull(speed);

    return value === null || value < 0 ? null : value;
};

/*
 * GetTracking reply -> the canonical normalized telemetry shape
 * (normalizeTelemetryPayload's output). Returns null when the reply has no
 * usable position, rather than inventing one.
 */
export const mapAikaTracking = (tracking) => {
    if (!tracking) {
        return null;
    }

    const latitude = toNumberOrNull(tracking.lat);
    const longitude = toNumberOrNull(tracking.lng);
    const recordedAt = parseAikaPositionTime(tracking.positionTime);

    if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180 ||
        (latitude === 0 && longitude === 0) ||
        !recordedAt
    ) {
        return null;
    }

    return {
        latitude,
        longitude,
        speed: parseSpeed(tracking.speed),
        heading: parseHeading(tracking.course),
        ignition: parseAikaIgnition(tracking.status),
        batteryLevel: parseBattery(tracking.battery),
        gpsFix: parseGpsFix(tracking.isGPS),
        recordedAt,
    };
};

/*
 * When the device last contacted AIKA, from `ofl` (whole minutes), or null
 * when AIKA didn't say or the contact is too old to count as online.
 */
export const resolveAikaLastContact = (tracking, now = new Date()) => {
    const offlineMinutes = toNumberOrNull(tracking?.ofl);

    if (offlineMinutes === null || offlineMinutes < 0) {
        return null;
    }

    const offlineMs = offlineMinutes * 60 * 1000;

    if (offlineMs >= AIKA_ONLINE_MAX_MS) {
        return null;
    }

    return new Date(now.getTime() - offlineMs);
};

const findLatestRecordedAt = async (trackerId) => {
    const latest = await Telemetry.findOne({ tracker: trackerId })
        .sort({ recordedAt: -1 })
        .select("recordedAt")
        .lean();

    return latest?.recordedAt ?? null;
};

/*
 * One poll cycle. Returns { action, ... } describing what happened:
 *   ingested   - new positionTime, sent through ingestTelemetry
 *   heartbeat  - same position, but AIKA says the device is online
 *   offline    - same position and no recent contact - nothing written
 *                (the offline sweep raises GPS_OFFLINE from lastSeenAt)
 *   skipped    - no tracker record / disabled / unassigned / rejected
 */
export const pollAikaOnce = async ({ client, now = () => new Date() }) => {
    const sessionInfo = await client.ensureSession();
    const tracking = await client.getTracking();
    const polledAt = now();

    // The serial AIKA reports for the logged-in device (9176761220) is the
    // Device ID the admin registers on the Trackers page.
    const tracker = await Tracker.findOne({
        imei: sessionInfo.serial,
        protocol: TRACKER_PROTOCOL.AIKA_CLOUD,
    });

    if (!tracker) {
        return { action: "skipped", reason: "no-tracker", serial: sessionInfo.serial };
    }

    if (tracker.status === TRACKER_STATUS.INACTIVE) {
        return { action: "skipped", reason: "tracker-disabled" };
    }

    const lastContact = resolveAikaLastContact(tracking, polledAt);
    const reading = mapAikaTracking(tracking);

    // An unassigned tracker's position belongs to no vehicle - record that
    // it's communicating, nothing else (ingestTelemetry would 409).
    if (!tracker.vehicle) {
        if (lastContact) {
            await recordHeartbeat(tracker, lastContact);
        }

        return { action: "skipped", reason: "unassigned", online: Boolean(lastContact) };
    }

    if (reading) {
        const latestRecordedAt = await findLatestRecordedAt(tracker._id);

        // AIKA keeps returning the last fix until there's a new one - only
        // a strictly newer positionTime becomes history.
        if (!latestRecordedAt || reading.recordedAt > latestRecordedAt) {
            try {
                const result = await ingestTelemetry(tracker, reading);

                return {
                    action: "ingested",
                    recordedAt: reading.recordedAt,
                    stateAdvanced: result.stateAdvanced,
                };
            } catch (error) {
                if (error.statusCode >= 400 && error.statusCode < 500) {
                    return { action: "skipped", reason: error.message };
                }

                throw error;
            }
        }
    }

    if (lastContact) {
        await recordHeartbeat(tracker, lastContact);

        return { action: "heartbeat", lastContact };
    }

    return { action: "offline" };
};

const resolvePollIntervalMs = () => {
    const seconds =
        Number(process.env.AIKA_POLL_INTERVAL_SECONDS) ||
        DEFAULT_POLL_INTERVAL_SECONDS;

    return Math.max(seconds, MIN_POLL_INTERVAL_SECONDS) * 1000;
};

let pollTimer = null;

/*
 * Starts the polling loop (one cycle at a time, never overlapping). Repeated
 * failures back off exponentially up to MAX_BACKOFF_MS so an AIKA outage or
 * bad password doesn't hammer their login endpoint. Only state changes are
 * logged, not every cycle. Returns whether it started.
 */
export const startAikaPoller = () => {
    if (process.env.AIKA_ENABLED !== "true" || pollTimer) {
        return false;
    }

    const missing = getMissingAikaEnv();

    if (missing.length > 0) {
        console.error(
            `AIKA poller not started - missing env: ${missing.join(", ")}`
        );
        return false;
    }

    const client = createAikaClient();
    const intervalMs = resolvePollIntervalMs();
    let consecutiveFailures = 0;
    let lastLogKey = null;

    const logOnChange = (key, message, log = console.log) => {
        if (key !== lastLogKey) {
            lastLogKey = key;
            log(message);
        }
    };

    const runCycle = async () => {
        try {
            const outcome = await pollAikaOnce({ client });
            consecutiveFailures = 0;

            logOnChange(
                `${outcome.action}:${outcome.reason || ""}`,
                `AIKA poller: ${outcome.action}${outcome.reason ? ` (${outcome.reason})` : ""}`
            );
        } catch (error) {
            consecutiveFailures += 1;

            logOnChange(
                `error:${error.message}`,
                `AIKA poller failed: ${error.message}`,
                console.error
            );
        }

        const delay = Math.min(
            intervalMs * 2 ** Math.min(consecutiveFailures, 5),
            Math.max(intervalMs, MAX_BACKOFF_MS)
        );

        pollTimer = setTimeout(runCycle, delay);
        pollTimer.unref?.();
    };

    console.log(`AIKA poller started (every ${intervalMs / 1000}s).`);

    pollTimer = setTimeout(runCycle, intervalMs);
    pollTimer.unref?.();

    return true;
};
