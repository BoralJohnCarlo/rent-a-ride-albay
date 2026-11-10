import mongoose from "mongoose";

const schema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: String, auth: String },
    sessionHash: { type: String, required: true, index: true },
    issuedAt: Number,
    enabledAt: { type: Date, default: Date.now },
    credentialVersion: Number,
    expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true, bufferCommands: false });

export default mongoose.model("PushSubscription", schema);
