import mongoose from "mongoose";

const guardSchema = new mongoose.Schema(
    { _id: String, revision: { type: Number, default: 0 } },
    { versionKey: false }
);
const BookingCreationGuard = mongoose.model("BookingCreationGuard", guardSchema);

// A write to each shared resource makes concurrent transactions conflict and
// retry against a fresh snapshot. An in-process mutex cannot protect multiple
// server instances. Guards have no expiry: MongoDB releases locks on abort.
export const withBookingCreationTransaction = async (resourceKeys, create) => {
    const keys = [...new Set(resourceKeys)].sort();

    // Create guards outside the transaction so first-time requests cannot race
    // to upsert the same guard inside their transactions.
    for (const key of keys) {
        try {
            await BookingCreationGuard.updateOne(
                { _id: key },
                { $setOnInsert: { revision: 0 } },
                { upsert: true }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;
        }
    }

    const session = await mongoose.startSession();
    try {
        return await session.withTransaction(async () => {
            // Keep transaction operations sequential (including resource reads).
            for (const key of keys) {
                await BookingCreationGuard.updateOne(
                    { _id: key },
                    { $inc: { revision: 1 } },
                    { session }
                );
            }
            return create(session);
        }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
    } finally {
        await session.endSession();
    }
};
