import { GPS_HISTORY_MAX_RANGE_MS, toDatetimeLocalValue } from "../constants/gpsConstants.js";

const validId = value => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

export const boundaryHistoryLink = (incident, now = Date.now()) => {
    const vehicle = incident.vehicle?._id ?? incident.vehicle;
    const crossing = new Date(incident.outsideAt || incident.createdAt).getTime();
    if (!validId(vehicle) || !Number.isFinite(crossing) || crossing > now) return null;
    const start = crossing - 5 * 60000;
    const observedEnd = new Date(incident.resolvedAt || incident.lastFixAt || incident.outsideAt || incident.createdAt).getTime();
    const end = Math.min(now, start + GPS_HISTORY_MAX_RANGE_MS,
        Math.max(crossing + 5 * 60000, Number.isFinite(observedEnd) ? observedEnd + 5 * 60000 : crossing));
    return `/admin/gps?${new URLSearchParams({ vehicle, mode: "history", start: new Date(start).toISOString(), end: new Date(end).toISOString() })}`;
};

// URL dates are untrusted. Ignore invalid/oversized ranges and retain the
// existing GPS defaults; the telemetry API still enforces permissions and limits.
export const readBoundaryHistoryLink = params => {
    const vehicle = params.get("vehicle");
    if (params.get("mode") !== "history" || !validId(vehicle) || !params.get("start") || !params.get("end")) return null;
    const start = new Date(params.get("start")), end = new Date(params.get("end"));
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end || end - start > GPS_HISTORY_MAX_RANGE_MS) return null;
    return { vehicle, range: { start: toDatetimeLocalValue(start), end: toDatetimeLocalValue(end) } };
};
