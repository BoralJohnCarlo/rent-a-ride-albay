import mongoose from "mongoose";
const schema = new mongoose.Schema({
    vehicle: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    tracker: mongoose.Schema.Types.ObjectId,
    alertSession: { type: String, default: null },
    rental: mongoose.Schema.Types.ObjectId,
    state: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
}, { timestamps: true });
export default mongoose.model("BoundaryState", schema);
