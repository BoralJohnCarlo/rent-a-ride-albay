import mongoose from "mongoose";

import { TELEMETRY_SOURCE_VALUES } from "../constants/telemetryConstants.js";

/*
 * One document per vehicle holding only the latest known telemetry
 * snapshot, upserted on every ingest. Kept separate from the high-frequency
 * Telemetry history collection so "where is this vehicle right now" is a
 * single indexed lookup instead of a sort+limit over history.
 */
const vehicleTrackingStateSchema = new mongoose.Schema(
    {
        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
            unique: true,
        },

        tracker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tracker",
            default: null,
        },

        latitude: {
            type: Number,
            required: true,
        },

        longitude: {
            type: Number,
            required: true,
        },

        speed: {
            type: Number,
            default: null,
        },

        heading: {
            type: Number,
            default: null,
        },

        ignition: {
            type: Boolean,
            default: null,
        },

        batteryLevel: {
            type: Number,
            default: null,
        },

        // true = fix, false = explicitly no fix, null = device didn't say.
        gpsFix: {
            type: Boolean,
            default: null,
        },

        // Device timestamp of this snapshot - the chronology key. The state
        // only ever advances to a strictly newer recordedAt (trackingService).
        recordedAt: {
            type: Date,
            required: true,
        },

        receivedAt: {
            type: Date,
            default: Date.now,
        },

        source: {
            type: String,
            enum: TELEMETRY_SOURCE_VALUES,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

const VehicleTrackingState = mongoose.model(
    "VehicleTrackingState",
    vehicleTrackingStateSchema
);

export default VehicleTrackingState;
