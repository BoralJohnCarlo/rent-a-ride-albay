import mongoose from "mongoose";

const schema = new mongoose.Schema({
    notification: { type: mongoose.Schema.Types.ObjectId, ref: "Notification", required: true },
    subscription: { type: mongoose.Schema.Types.ObjectId, ref: "PushSubscription", required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sessionHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: () => new Date(0) },
    claimToken: String,
    expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, bufferCommands: false });

schema.index({ notification: 1, subscription: 1 }, { unique: true });
schema.index({ nextAttemptAt: 1, leaseUntil: 1 });
export default mongoose.model("PushDelivery", schema);
