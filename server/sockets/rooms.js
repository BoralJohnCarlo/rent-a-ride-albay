// Single source of truth for room naming - the server always constructs
// this from a validated vehicle ID; clients never supply a raw room name.
export const vehicleRoom = (vehicleId) => `vehicle:${vehicleId}`;

/*
 * Admins auto-join this room on connect (see sockets/index.js) so fleet-wide
 * events (currently: alerts:new/alerts:resolved) reach them regardless of
 * which vehicle room(s) they happen to be subscribed to. Not client-joinable
 * - there is no client-emitted event that leads here.
 */
export const ADMIN_ROOM = "role:admin";

/*
 * Every authenticated socket auto-joins its own user room on connect, so
 * per-user events (currently: support chat) reach all of that user's open
 * tabs. Like ADMIN_ROOM, never client-joinable.
 */
export const userRoom = (userId) => `user:${userId}`;
