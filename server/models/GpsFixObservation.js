import mongoose from "mongoose";

// A heartbeat can report loss of GPS without providing a position. Keep that
// observation separate from position telemetry; never manufacture coordinates.
const schema = new mongoose.Schema({
    vehicle: { type: mongoose.Schema.Types.ObjectId, required: true },
    tracker: { type: mongoose.Schema.Types.ObjectId, required: true },
    observedAt: { type: Date, required: true },
}, { versionKey: false });
schema.index({ vehicle: 1, tracker: 1, observedAt: 1 }, { unique: true });
schema.index({ vehicle: 1, observedAt: 1 });
export default mongoose.model("GpsFixObservation", schema);
