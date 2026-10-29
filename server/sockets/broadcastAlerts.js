import { getIO } from "./index.js";
import { vehicleRoom, ADMIN_ROOM } from "./rooms.js";

export const ALERT_NEW_EVENT = "alerts:new";
export const ALERT_RESOLVED_EVENT = "alerts:resolved";

/*
 * Reshapes an already-persisted Alert document into the stable realtime
 * payload - never includes deviceKey/credentials, mirrors the shape
 * returned by the REST endpoints (buildRealtimePayload in
 * broadcastTelemetry.js is the equivalent for gps:telemetry).
 */
const buildAlertPayload = (alert) => ({
    _id: String(alert._id),
    vehicle: String(alert.vehicle),
    tracker: alert.tracker ? String(alert.tracker) : null,
    type: alert.type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    status: alert.status,
    isRead: alert.isRead,
    context: alert.context || {},
    triggeredAt: alert.triggeredAt,
    resolvedAt: alert.resolvedAt,
});

/*
 * Targets the union of the vehicle's own room (so an operator subscribed to
 * that vehicle on the GPS page sees it) and the admin room (so admins see
 * every fleet alert regardless of subscription). Socket.IO delivers once per
 * socket even when it belongs to both rooms - no double delivery.
 */
const broadcastAlertEvent = (event, alert) => {
    const io = getIO();

    if (!io) {
        return;
    }

    io.to(vehicleRoom(String(alert.vehicle)))
        .to(ADMIN_ROOM)
        .emit(event, buildAlertPayload(alert));
};

export const broadcastNewAlert = (alert) =>
    broadcastAlertEvent(ALERT_NEW_EVENT, alert);

export const broadcastResolvedAlert = (alert) =>
    broadcastAlertEvent(ALERT_RESOLVED_EVENT, alert);
