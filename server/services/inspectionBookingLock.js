import { Schema, model } from "mongoose";
import { randomUUID } from "node:crypto";
import createError from "../utils/createError.js";

// A database lease serializes capacity-changing operations across server processes.
const Lock = model("InspectionBookingLock", new Schema({
    _id: String, owner: String, expiresAt: Date,
}));
export const withInspectionBookingLock = async (action) => {
    const owner = randomUUID();
    const deadline = Date.now() + 10000;
    while (true) {
        try {
            const acquired = await Lock.findOneAndUpdate(
                { _id: "inspection", expiresAt: { $lte: new Date() } },
                { $set: { owner, expiresAt: new Date(Date.now() + 120000) } },
                { upsert: true, returnDocument: "after" }
            );
            if (acquired?.owner === owner) break;
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
        if (Date.now() >= deadline) throw createError("Appointments are being updated. Please try again.", 409);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    const renewal = setInterval(() => {
        Lock.updateOne({ _id: "inspection", owner }, { $set: { expiresAt: new Date(Date.now() + 120000) } }).catch(error => console.error("Inspection lease renewal failed:", error.message));
    }, 10000);
    renewal.unref();
    try { return await action(); }
    finally {
        clearInterval(renewal);
        await Lock.deleteOne({ _id: "inspection", owner }).catch(error => console.error("Inspection lease release failed:", error.message));
    }
};
