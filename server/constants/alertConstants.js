import { TRACKER_PROTOCOL } from "./telemetryConstants.js";

export const ALERT_TYPE = {
    GPS_OFFLINE: "GPS_OFFLINE",
    GPS_LOST: "GPS_LOST",
    LOW_BATTERY: "LOW_BATTERY",
    IGNITION_ON: "IGNITION_ON",
};

export const ALERT_TYPE_VALUES = Object.values(ALERT_TYPE);

export const ALERT_SEVERITY = {
    INFO: "info",
    WARNING: "warning",
    CRITICAL: "critical",
};

export const ALERT_SEVERITY_VALUES = Object.values(ALERT_SEVERITY);

export const ALERT_STATUS = {
    ACTIVE: "active",
    RESOLVED: "resolved",
};

export const ALERT_STATUS_VALUES = Object.values(ALERT_STATUS);

/*
 * Single configurable threshold, referenced everywhere a "is the battery
 * low" decision is made (alertService.js) - never hard-coded a second time.
 */
export const LOW_BATTERY_THRESHOLD_PERCENT = 20;

/*
 * Mirrors the frontend's GPS_STALE_THRESHOLD_MS (client/src/constants/
 * gpsConstants.js) - both sides intentionally use the same 60s value so the
 * backend's GPS_OFFLINE alert and the frontend's "Offline" status badge
 * agree on what "stale" means. They can't literally share a JS module across
 * the client/server boundary, so the value is mirrored here instead.
 *
 * This is the single place the backend's offline threshold is defined
 * (compared against Tracker.lastSeenAt = communication activity, never GPS
 * fix). 60s suits the simulator (5s default interval). It is PROVISIONAL for
 * real hardware: parked/ACC-OFF devices commonly report far less often, so
 * the final value must be tuned once a physical tracker's heartbeat/report
 * intervals are measured - change it here and in the client mirror together.
 */
export const GPS_STALE_THRESHOLD_MS = 60 * 1000;

/*
 * Per-protocol overrides of GPS_STALE_THRESHOLD_MS, mirrored in the client
 * (gpsConstants.js / trackerConstants.js). AIKA: measured 2026-10-01, a
 * parked AK-61220 goes several minutes between reports while still online,
 * and AIKA only reports contact age in whole minutes (`ofl`), so 60s would
 * flag it offline almost permanently.
 */
export const GPS_STALE_THRESHOLD_MS_BY_PROTOCOL = {
    [TRACKER_PROTOCOL.AIKA_CLOUD]: 10 * 60 * 1000,
};

export const getGpsStaleThresholdMs = (protocol) =>
    GPS_STALE_THRESHOLD_MS_BY_PROTOCOL[protocol] ?? GPS_STALE_THRESHOLD_MS;

// The smallest threshold in use - the offline sweep's DB pre-filter.
export const MIN_GPS_STALE_THRESHOLD_MS = Math.min(
    GPS_STALE_THRESHOLD_MS,
    ...Object.values(GPS_STALE_THRESHOLD_MS_BY_PROTOCOL)
);

/*
 * Severity + display copy per alert type, defined once here rather than
 * scattered across the service/controller/frontend. `buildMessage(context)`
 * lets a couple of types (LOW_BATTERY, GPS_OFFLINE) include the relevant
 * number/timestamp without storing full telemetry documents on the alert.
 */
export const ALERT_DEFINITIONS = {
    [ALERT_TYPE.GPS_OFFLINE]: {
        severity: ALERT_SEVERITY.CRITICAL,
        title: "Vehicle Offline",
        buildMessage: () =>
            "The tracker has stopped communicating and is now considered offline.",
    },

    [ALERT_TYPE.GPS_LOST]: {
        severity: ALERT_SEVERITY.WARNING,
        title: "GPS Signal Lost",
        buildMessage: () =>
            "The tracker is communicating but currently has no GPS fix.",
    },

    [ALERT_TYPE.LOW_BATTERY]: {
        severity: ALERT_SEVERITY.WARNING,
        title: "Low Tracker Battery",
        buildMessage: (context) =>
            `Tracker battery is at ${context?.batteryLevel ?? "an unknown level"}%, below the ${LOW_BATTERY_THRESHOLD_PERCENT}% threshold.`,
    },

    [ALERT_TYPE.IGNITION_ON]: {
        severity: ALERT_SEVERITY.INFO,
        title: "Ignition Turned On",
        buildMessage: () => "The vehicle's ignition was turned on.",
    },
};
