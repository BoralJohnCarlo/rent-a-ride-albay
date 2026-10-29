import mongoose from "mongoose";

import Vehicle from "../models/Vehicle.js";

/*
 * Single ownership rule for vehicle-scoped GPS data, shared by the Socket.IO
 * room subscriptions (sockets/gpsEvents.js) and the telemetry REST endpoints
 * - so the live map and its REST seed/history can never disagree about who
 * may see a vehicle.
 *
 * Authorization is separate from authentication: always re-check against
 * the authenticated user (never a client-supplied role) and the database.
 */
export const canAccessVehicle = async (user, vehicleId) => {
    if (!user || !mongoose.isValidObjectId(vehicleId)) {
        return false;
    }

    if (user.role === "admin") {
        return true;
    }

    if (user.role === "operator") {
        const vehicle = await Vehicle.findOne({
            _id: vehicleId,
            operator: user._id,
        })
            .select("_id")
            .lean();

        return Boolean(vehicle);
    }

    /*
     * Customers never see fleet tracking - a renter's own trip is not
     * exposed through these endpoints. Deliberately false, not an
     * oversight.
     */
    return false;
};
