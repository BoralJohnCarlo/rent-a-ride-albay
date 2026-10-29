import { getIO } from "./index.js";
import { vehicleRoom } from "./rooms.js";

export const GPS_TELEMETRY_EVENT = "gps:telemetry";
export const GPS_HEARTBEAT_EVENT = "gps:heartbeat";

/*
 * Reshapes the already-normalized/persisted telemetry document into the
 * stable realtime payload - no re-validation or re-derivation, and never
 * includes tracker credentials.
 */
export const buildRealtimePayload = (telemetry) => ({
    vehicleId: String(telemetry.vehicle),
    trackerId: String(telemetry.tracker),
    latitude: telemetry.latitude,
    longitude: telemetry.longitude,
    speed: telemetry.speed,
    heading: telemetry.heading,
    ignition: telemetry.ignition,
    batteryLevel: telemetry.batteryLevel,
    gpsFix: telemetry.gpsFix,
    recordedAt: telemetry.recordedAt,
    receivedAt: telemetry.receivedAt,
    source: telemetry.source,
});

/*
 * Communication-only update (no position): lets the UI know the tracker is
 * still talking even when no new, newer GPS reading arrived.
 */
export const buildHeartbeatPayload = ({ vehicleId, trackerId, lastSeenAt }) => ({
    vehicleId: String(vehicleId),
    trackerId: String(trackerId),
    lastSeenAt,
});

/*
 * No-ops if Socket.IO hasn't been initialized (e.g. a script that imports
 * trackingService directly without booting server.js) - ingestion must
 * never fail because nobody is listening.
 */
export const broadcastVehicleTelemetry = (vehicleId, payload) => {
    const io = getIO();

    if (!io) {
        return;
    }

    io.to(vehicleRoom(vehicleId)).emit(GPS_TELEMETRY_EVENT, payload);
};

export const broadcastVehicleHeartbeat = (vehicleId, payload) => {
    const io = getIO();

    if (!io) {
        return;
    }

    io.to(vehicleRoom(vehicleId)).emit(GPS_HEARTBEAT_EVENT, payload);
};
