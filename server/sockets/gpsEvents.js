import mongoose from "mongoose";
import User from "../models/User.js";

import { vehicleRoom } from "./rooms.js";
import { canAccessVehicle } from "../services/vehicleAccessService.js";

const respond = (ack, result) => {
    if (typeof ack === "function") {
        ack(result);
    }
};

/*
 * Per-connection GPS room subscription events. The server always
 * constructs the room name itself from a validated vehicle ID - a client
 * can never join an arbitrary room name directly.
 */
export const registerGpsEvents = (socket) => {
    const pendingSubscriptions = new Map();
    socket.on("disconnect", () => pendingSubscriptions.clear());
    socket.on("gps:subscribe", async (payload, ack) => {
        const vehicleId = payload?.vehicleId;

        if (!vehicleId || !mongoose.isValidObjectId(vehicleId)) {
            return respond(ack, {
                success: false,
                message: "A valid vehicleId is required.",
            });
        }

        const request = {};
        pendingSubscriptions.set(vehicleId, request);
        let authorized;
        try {
            // A connected socket's user document is a handshake snapshot.
            // Never authorize a new GPS room using a role that was revoked.
            const currentUser = await User.findById(socket.user._id);
            if (!currentUser || currentUser.isSuspended || currentUser.role !== socket.user.role) {
                pendingSubscriptions.delete(vehicleId);
                respond(ack, { success: false, message: "Your account permissions changed. Please reconnect." });
                socket.disconnect(true);
                return;
            }
            authorized = await canAccessVehicle(currentUser, vehicleId);
        } catch {
            if (pendingSubscriptions.get(vehicleId) === request) pendingSubscriptions.delete(vehicleId);
            return respond(ack, { success: false, message: "Unable to authorize GPS subscription." });
        }

        // An unsubscribe/new subscribe can arrive while ownership is being
        // checked. Never join later on behalf of that superseded request.
        if (pendingSubscriptions.get(vehicleId) !== request) {
            return respond(ack, { success: false, message: "GPS subscription was cancelled." });
        }
        pendingSubscriptions.delete(vehicleId);

        if (!authorized) {
            return respond(ack, {
                success: false,
                message: "You are not authorized to track this vehicle.",
            });
        }

        socket.join(vehicleRoom(vehicleId));

        return respond(ack, { success: true, vehicleId });
    });

    socket.on("gps:unsubscribe", (payload, ack) => {
        const vehicleId = payload?.vehicleId;

        if (!vehicleId || !mongoose.isValidObjectId(vehicleId)) {
            return respond(ack, {
                success: false,
                message: "A valid vehicleId is required.",
            });
        }

        pendingSubscriptions.delete(vehicleId);
        socket.leave(vehicleRoom(vehicleId));

        return respond(ack, { success: true, vehicleId });
    });
};
