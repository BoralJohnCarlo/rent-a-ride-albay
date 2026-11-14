import mongoose from "mongoose";
const schema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, required: true },
    incident: { type: mongoose.Schema.Types.ObjectId, ref: "BoundaryIncident", default: null },
    rental: { type: mongoose.Schema.Types.ObjectId, ref: "Rental", default: null },
    payload: mongoose.Schema.Types.Mixed,
    kind: { type: String, enum: ["near", "outside", "eligible", "returned", "approved", "waived", "trip_approved", "trip_revoked"] },
    delivered: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ delivered: 1, createdAt: 1 });
export default mongoose.model("BoundaryNotice", schema);
