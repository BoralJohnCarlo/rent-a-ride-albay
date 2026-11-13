import mongoose from "mongoose";
const { Schema } = mongoose;
const schema = new Schema({
    vehicle: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    tracker: { type: Schema.Types.ObjectId, ref: "Tracker", required: true },
    rental: { type: Schema.Types.ObjectId, ref: "Rental", default: null },
    customer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
    stage: { type: String, enum: ["near", "outside", "returned", "cancelled"], default: "near" },
    review: { type: String, enum: ["none", "eligible", "approved", "waived"], default: "none" },
    policy: Schema.Types.Mixed,
    boundaryVersion: String,
    outsideAt: Date, resolvedAt: Date,
    latitude: Number, longitude: Number, lastFixAt: Date,
    evidenceMinutes: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    penaltyCancelledAt: Date,
    reason: String, reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });
schema.index({ vehicle: 1 }, { unique: true, partialFilterExpression: { active: true } });
schema.index({ rental: 1, createdAt: -1 });
export default mongoose.model("BoundaryIncident", schema);
