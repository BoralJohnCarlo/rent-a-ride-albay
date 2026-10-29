export const TRACKER_STATUS = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    UNASSIGNED: "unassigned",
};

export const TRACKER_STATUS_VALUES = Object.values(TRACKER_STATUS);

/*
 * How a tracker talks to the backend. Real hardware protocols are added here
 * only once a device's protocol has actually been confirmed and an adapter
 * for it implemented.
 *
 * AIKA_CLOUD: the device keeps reporting to the AIKA platform and the
 * backend polls AIKA's app API for it (services/aika/aikaPoller.js). It
 * never calls our API itself, so it is neither HTTP-ingest nor deviceKey.
 */
export const TRACKER_PROTOCOL = {
    HTTP_SIMULATOR: "http_simulator",
    AIKA_CLOUD: "aika_cloud",
};

export const TRACKER_PROTOCOL_VALUES = Object.values(TRACKER_PROTOCOL);

// Protocols allowed through POST /api/telemetry/ingest (tracker-key auth).
export const HTTP_INGEST_PROTOCOLS = [TRACKER_PROTOCOL.HTTP_SIMULATOR];

// Protocols whose trackers authenticate with an issued HTTP deviceKey.
export const DEVICE_KEY_PROTOCOLS = [TRACKER_PROTOCOL.HTTP_SIMULATOR];

export const TELEMETRY_SOURCE = {
    MOCK: "mock",
    AIKA: "aika",
};

export const TELEMETRY_SOURCE_VALUES = Object.values(TELEMETRY_SOURCE);

/*
 * The telemetry source is always derived server-side from the authenticated
 * tracker's protocol - never taken from a request body.
 */
export const TELEMETRY_SOURCE_BY_PROTOCOL = {
    [TRACKER_PROTOCOL.HTTP_SIMULATOR]: TELEMETRY_SOURCE.MOCK,
    [TRACKER_PROTOCOL.AIKA_CLOUD]: TELEMETRY_SOURCE.AIKA,
};

/*
 * How far ahead of server time a device timestamp may be before the reading
 * is rejected - tolerates ordinary device/server clock drift, never silently
 * rewritten.
 */
export const TELEMETRY_MAX_FUTURE_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/*
 * History query bounds - configurable constants rather than magic numbers,
 * so a single query can't pull an unbounded number of Telemetry documents.
 */
export const TELEMETRY_HISTORY_DEFAULT_RANGE_MS = 60 * 60 * 1000; // 1 hour
export const TELEMETRY_HISTORY_MAX_RANGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const TELEMETRY_HISTORY_MAX_POINTS = 2000; // returned to the client
export const TELEMETRY_HISTORY_QUERY_LIMIT = 20000; // hard safety cap on the raw DB fetch

/*
 * How far back a partner (operator) may look at their own vehicles' route
 * history. While a vehicle is rented its route is effectively the renter's
 * movements, so partners get a short window; admins keep full history
 * (still subject to the per-query MAX_RANGE above). Mirrored on the client
 * as GPS_OPERATOR_HISTORY_WINDOW_MS - change both together.
 */
export const TELEMETRY_OPERATOR_HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const TRACKER_NOTES_MAX_LENGTH = 500;

/*
 * POST /api/telemetry/ingest rate limits. Failed credential attempts are
 * capped per IP; authenticated traffic is capped per tracker, generously
 * above the simulator's fastest sensible interval (1 reading/second).
 */
export const INGEST_FAILED_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const INGEST_FAILED_AUTH_MAX = 20;
export const INGEST_DEVICE_WINDOW_MS = 60 * 1000;
export const INGEST_DEVICE_MAX = 120;
