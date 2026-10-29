import { haversineDistanceMeters } from "../utils/geo";

/*
 * If a tracker hasn't communicated in this long, the UI treats it as
 * offline/stale - a single defined threshold rather than scattering magic
 * numbers across the GPS components. Mirrors the backend's
 * GPS_STALE_THRESHOLD_MS (server/constants/alertConstants.js); provisional
 * for real hardware until its report/heartbeat intervals are measured.
 */
export const GPS_STALE_THRESHOLD_MS = 60 * 1000;

/*
 * AIKA cloud trackers report far less often while parked, so they get a
 * longer threshold. Mirrors GPS_STALE_THRESHOLD_MS_BY_PROTOCOL in
 * server/constants/alertConstants.js - change both together.
 */
export const AIKA_STALE_THRESHOLD_MS = 10 * 60 * 1000;

// Keyed by telemetry `source` (TELEMETRY_SOURCE in trackerConstants.js).
const GPS_STALE_THRESHOLD_MS_BY_SOURCE = {
    aika: AIKA_STALE_THRESHOLD_MS,
};

export const getGpsStaleThresholdMs = (source) =>
    GPS_STALE_THRESHOLD_MS_BY_SOURCE[source] ?? GPS_STALE_THRESHOLD_MS;

// Live vs. historical route view on the GPS page.
export const GPS_MODE = {
    LIVE: "live",
    HISTORY: "history",
};

/*
 * If consecutive historical points are more than this far apart in time,
 * the tracker was likely offline in between - break the route line rather
 * than drawing a misleading straight segment across the gap.
 */
export const GPS_ROUTE_GAP_THRESHOLD_MS = 5 * 60 * 1000;

// Default history window shown when the admin first switches to History
// mode, before choosing their own start/end.
export const GPS_HISTORY_DEFAULT_RANGE_MS = 60 * 60 * 1000;

// Mirrors the backend's TELEMETRY_HISTORY_MAX_RANGE_MS - used here only to
// pre-validate/communicate the limit client-side before calling the API;
// the backend remains the source of truth for enforcement.
export const GPS_HISTORY_MAX_RANGE_MS = 24 * 60 * 60 * 1000;

// How far back partners may load their own vehicles' route history. Mirrors
// TELEMETRY_OPERATOR_HISTORY_WINDOW_MS (server/constants/telemetryConstants.js)
// - change both together; the backend enforces it.
export const GPS_OPERATOR_HISTORY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const GPS_OPERATOR_HISTORY_WINDOW_DAYS =
    GPS_OPERATOR_HISTORY_WINDOW_MS / (24 * 60 * 60 * 1000);

/*
 * Which vehicles the GPS tracking list shows: those out with a renter
 * (picked up, so the vehicle is Rented) - the ones worth watching live - or
 * the whole fleet.
 */
export const GPS_LIST_SCOPE = {
    ON_THE_ROAD: "on-the-road",
    ALL: "all",
};

export const GPS_STATUS = {
    NO_TRACKER: "no-tracker",
    WAITING: "waiting",
    LIVE: "live",
    GPS_LOST: "gps-lost",
    OFFLINE: "offline",
};

export const GPS_STATUS_LABELS = {
    [GPS_STATUS.NO_TRACKER]: "No Tracker",
    [GPS_STATUS.WAITING]: "Waiting for GPS",
    [GPS_STATUS.LIVE]: "Live",
    [GPS_STATUS.GPS_LOST]: "GPS Lost",
    [GPS_STATUS.OFFLINE]: "Offline",
};

export const GPS_STATUS_BADGE_VARIANT = {
    [GPS_STATUS.NO_TRACKER]: "default",
    [GPS_STATUS.WAITING]: "info",
    [GPS_STATUS.LIVE]: "success",
    [GPS_STATUS.GPS_LOST]: "warning",
    [GPS_STATUS.OFFLINE]: "secondary",
};

// Map marker / legend colours - hex, since Leaflet divIcons are static HTML
// that Tailwind classes can't theme.
export const GPS_STATUS_COLORS = {
    [GPS_STATUS.NO_TRACKER]: "#6b7280",
    [GPS_STATUS.WAITING]: "#3b82f6",
    [GPS_STATUS.LIVE]: "#16a34a",
    [GPS_STATUS.GPS_LOST]: "#d97706",
    [GPS_STATUS.OFFLINE]: "#6b7280",
};

// Route-history colours (HistoryRoute lines/markers + GPSMap's legend).
export const GPS_ROUTE_COLORS = {
    start: "#059669",
    end: "#e11d48",
    route: "#2563eb",
    played: "#7c3aed",
};

const toTime = (value) => (value ? new Date(value).getTime() : NaN);

/*
 * Derives a display-only status from existing telemetry/tracking data plus
 * the tracker-assignment relationship (Milestone 7) - no new database
 * field. `now` is injectable so callers can drive re-evaluation with a
 * ticking clock without needing new network data. `hasTracker` distinguishes
 * "no tracker assigned" from "tracker assigned, never reported yet" -
 * callers must derive it from the existing tracker list (see GPS.jsx),
 * never guess/fake it.
 *
 * Two separate questions, never conflated:
 *  - Communication (Offline?): the latest of the last position's receivedAt
 *    and `lastSeenAt` (Tracker.lastSeenAt / heartbeats) - a tracker can be
 *    talking to us without sending a newer position.
 *  - GPS fix (GPS Lost?): only an explicit gpsFix === false. null/undefined
 *    means the device didn't say, which is not the same as "lost".
 */
export const getVehicleGpsStatus = (
    telemetry,
    now = Date.now(),
    hasTracker = false,
    lastSeenAt = null
) => {
    if (
        !telemetry ||
        telemetry.latitude === null ||
        telemetry.latitude === undefined ||
        telemetry.longitude === null ||
        telemetry.longitude === undefined
    ) {
        return hasTracker ? GPS_STATUS.WAITING : GPS_STATUS.NO_TRACKER;
    }

    const lastCommunication = Math.max(
        ...[toTime(telemetry.receivedAt), toTime(lastSeenAt)].filter(
            (time) => !Number.isNaN(time)
        ),
        -Infinity
    );

    const isStale =
        !Number.isFinite(lastCommunication) ||
        now - lastCommunication > getGpsStaleThresholdMs(telemetry.source);

    if (isStale) {
        return GPS_STATUS.OFFLINE;
    }

    if (telemetry.gpsFix === false) {
        return GPS_STATUS.GPS_LOST;
    }

    return GPS_STATUS.LIVE;
};

const pad = (n) => String(n).padStart(2, "0");

export const toDatetimeLocalValue = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

// Matches the backend's own default range (TELEMETRY_HISTORY_DEFAULT_RANGE_MS).
export const defaultHistoryRange = () => {
    const end = new Date();
    const start = new Date(end.getTime() - GPS_HISTORY_DEFAULT_RANGE_MS);

    return {
        start: toDatetimeLocalValue(start),
        end: toDatetimeLocalValue(end),
    };
};

// Historical points only ever come from the backend's Telemetry collection
// (see api/telemetryApi.js) - never invented client-side. Points without a
// GPS fix or valid coordinates are excluded rather than interpolated.
export const filterValidRoutePoints = (points) =>
    (points || []).filter(
        (point) =>
            point &&
            point.gpsFix === true &&
            point.latitude !== null &&
            point.latitude !== undefined &&
            point.longitude !== null &&
            point.longitude !== undefined
    );

/*
 * Splits valid route points into segments, starting a new segment whenever
 * the gap between consecutive points exceeds GPS_ROUTE_GAP_THRESHOLD_MS -
 * so a long tracker outage never renders as a single continuous line.
 */
export const buildRouteSegments = (points) => {
    const validPoints = filterValidRoutePoints(points);

    if (validPoints.length === 0) {
        return [];
    }

    const segments = [[validPoints[0]]];

    for (let i = 1; i < validPoints.length; i += 1) {
        const previous = validPoints[i - 1];
        const current = validPoints[i];

        const gapMs =
            new Date(current.recordedAt).getTime() -
            new Date(previous.recordedAt).getTime();

        if (gapMs > GPS_ROUTE_GAP_THRESHOLD_MS) {
            segments.push([current]);
        } else {
            segments[segments.length - 1].push(current);
        }
    }

    return segments;
};

/*
 * Simple, transparent summary stats - distance sums only consecutive
 * points within the same gap-free segment (never across an outage), and
 * max speed is just the highest reported value, never interpolated.
 */
export const computeRouteSummary = (points) => {
    const validPoints = filterValidRoutePoints(points);

    if (validPoints.length === 0) {
        return {
            pointCount: 0,
            startTime: null,
            endTime: null,
            durationMs: 0,
            distanceKm: 0,
            maxSpeedKmh: null,
        };
    }

    const segments = buildRouteSegments(points);
    let distanceMeters = 0;

    segments.forEach((segment) => {
        for (let i = 1; i < segment.length; i += 1) {
            distanceMeters += haversineDistanceMeters(
                segment[i - 1],
                segment[i]
            );
        }
    });

    const speeds = validPoints
        .map((point) => point.speed)
        .filter((speed) => typeof speed === "number");

    const startTime = validPoints[0].recordedAt;
    const endTime = validPoints[validPoints.length - 1].recordedAt;

    return {
        pointCount: validPoints.length,
        startTime,
        endTime,
        durationMs:
            new Date(endTime).getTime() - new Date(startTime).getTime(),
        distanceKm: distanceMeters / 1000,
        maxSpeedKmh: speeds.length ? Math.max(...speeds) : null,
    };
};
