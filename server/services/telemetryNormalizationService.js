import { TELEMETRY_MAX_FUTURE_SKEW_MS } from "../constants/telemetryConstants.js";

const toNullableNumber = (value) =>
    value === undefined || value === null ? null : Number(value);

// express-validator's isBoolean() also accepts "true"/"false"/"1"/"0", so
// those string forms are mapped explicitly (Boolean("false") would be true).
const toNullableBoolean = (value) => {
    if (value === undefined || value === null) {
        return null;
    }

    return value === true || value === "true" || value === 1 || value === "1";
};

/*
 * True when a device timestamp is further ahead of server time than normal
 * clock drift allows. Shared by the HTTP validator and trackingService, so
 * every ingestion path (HTTP today, protocol adapters later) applies the
 * same rule. Future timestamps are rejected, never silently rewritten.
 */
export const isTimestampTooFarInFuture = (timestamp, now = Date.now()) =>
    new Date(timestamp).getTime() - now > TELEMETRY_MAX_FUTURE_SKEW_MS;

/*
 * Converts an already-validated raw ingestion payload into the canonical
 * telemetry shape shared by Telemetry and VehicleTrackingState. This is the
 * seam a future protocol adapter is expected to also produce output for, so
 * trackingService never needs to know which pipeline a reading came from.
 *
 * Unknown values stay null rather than being guessed - in particular a
 * missing gpsFix means "unknown", not "no fix".
 */
export const normalizeTelemetryPayload = (rawPayload) => {
    return {
        latitude: Number(rawPayload.latitude),
        longitude: Number(rawPayload.longitude),
        speed: toNullableNumber(rawPayload.speed),
        heading: toNullableNumber(rawPayload.heading),
        ignition: toNullableBoolean(rawPayload.ignition),
        batteryLevel: toNullableNumber(rawPayload.batteryLevel),
        gpsFix: toNullableBoolean(rawPayload.gpsFix),

        recordedAt: rawPayload.recordedAt
            ? new Date(rawPayload.recordedAt)
            : new Date(),
    };
};
