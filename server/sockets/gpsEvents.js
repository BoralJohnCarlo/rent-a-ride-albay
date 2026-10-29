import mongoose from "mongoose";

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
    socket.on("gps:subscribe", async (payload, ack) => {
        const vehicleId = payload?.vehicleId;

        if (!vehicleId || !mongoose.isValidObjectId(vehicleId)) {
            return respond(ack, {
                success: false,
                message: "A valid vehicleId is required.",
            });
        }

        const authorized = await canAccessVehicle(
            socket.user,
            vehicleId
        );

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

        socket.leave(vehicleRoom(vehicleId));

        return respond(ack, { success: true, vehicleId });
    });
};
