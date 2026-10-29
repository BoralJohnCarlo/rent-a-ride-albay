import {
    GPS_STALE_THRESHOLD_MS,
    AIKA_STALE_THRESHOLD_MS,
} from "./gpsConstants";

// Mirrors the backend's TRACKER_STATUS enum (server/constants/telemetryConstants.js).
// This is tracker-management state, distinct from GPS live status
// (see gpsConstants.js's GPS_STATUS) - never confuse the two. It is never
// chosen directly: the backend derives it from assign/unassign/enable/disable.
export const TRACKER_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    UNASSIGNED: "unassigned",
};

export const TRACKER_STATUS_VALUES = Object.values(TRACKER_STATUS);

// Mirrors the backend's TRACKER_PROTOCOL. AIKA_CLOUD trackers are polled
// from the AIKA platform by the backend - they have no device key.
export const TRACKER_PROTOCOL = {
    HTTP_SIMULATOR: "http_simulator",
    AIKA_CLOUD: "aika_cloud",
};

export const TRACKER_PROTOCOL_LABELS = {
    [TRACKER_PROTOCOL.HTTP_SIMULATOR]: "Simulator (HTTP)",
    [TRACKER_PROTOCOL.AIKA_CLOUD]: "AIKA Cloud (real device)",
};

export const TRACKER_PROTOCOL_OPTIONS = Object.values(TRACKER_PROTOCOL).map(
    (value) => ({ value, label: TRACKER_PROTOCOL_LABELS[value] })
);

// Only protocols whose trackers authenticate with an HTTP device key.
export const DEVICE_KEY_PROTOCOLS = [TRACKER_PROTOCOL.HTTP_SIMULATOR];

// Mirrors the backend's TELEMETRY_SOURCE - the label shown wherever GPS data
// is displayed, so simulated data is never mistaken for a real device's.
export const TELEMETRY_SOURCE = {
    MOCK: "mock",
    AIKA: "aika",
};

export const TELEMETRY_SOURCE_LABELS = {
    [TELEMETRY_SOURCE.MOCK]: "Simulated",
    [TELEMETRY_SOURCE.AIKA]: "AIKA",
};

// Trackers created before `protocol` existed are simulator trackers.
export const getTrackerProtocol = (tracker) =>
    tracker?.protocol || TRACKER_PROTOCOL.HTTP_SIMULATOR;

export const isSimulatedSource = (source) => source === TELEMETRY_SOURCE.MOCK;

/*
 * Communication (is the tracker talking to us?) - based only on
 * Tracker.lastSeenAt, separate from GPS position/fix status. Uses the same
 * per-protocol stale threshold as the GPS status and the backend's offline
 * sweep.
 */
const STALE_THRESHOLD_MS_BY_PROTOCOL = {
    [TRACKER_PROTOCOL.AIKA_CLOUD]: AIKA_STALE_THRESHOLD_MS,
};

export const TRACKER_COMMUNICATION = {
    ONLINE: "online",
    OFFLINE: "offline",
    NEVER: "never",
};

export const TRACKER_COMMUNICATION_LABELS = {
    [TRACKER_COMMUNICATION.ONLINE]: "Communicating",
    [TRACKER_COMMUNICATION.OFFLINE]: "Offline",
    [TRACKER_COMMUNICATION.NEVER]: "Never",
};

export const TRACKER_COMMUNICATION_BADGE_VARIANT = {
    [TRACKER_COMMUNICATION.ONLINE]: "success",
    [TRACKER_COMMUNICATION.OFFLINE]: "secondary",
    [TRACKER_COMMUNICATION.NEVER]: "default",
};

export const getTrackerCommunicationStatus = (
    lastSeenAt,
    now = Date.now(),
    protocol = TRACKER_PROTOCOL.HTTP_SIMULATOR
) => {
    if (!lastSeenAt) {
        return TRACKER_COMMUNICATION.NEVER;
    }

    const lastSeen = new Date(lastSeenAt).getTime();
    const threshold =
        STALE_THRESHOLD_MS_BY_PROTOCOL[protocol] ?? GPS_STALE_THRESHOLD_MS;

    return Number.isNaN(lastSeen) || now - lastSeen > threshold
        ? TRACKER_COMMUNICATION.OFFLINE
        : TRACKER_COMMUNICATION.ONLINE;
};
