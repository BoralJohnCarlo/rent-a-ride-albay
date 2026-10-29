import mongoose from "mongoose";

import { TELEMETRY_SOURCE_VALUES } from "../constants/telemetryConstants.js";

/*
 * Append-only historical telemetry log. High write frequency, kept separate
 * from VehicleTrackingState (which only ever holds the latest snapshot per
 * vehicle for fast reads). No TTL/cleanup yet - retention policy is
 * intentionally undefined until a later milestone.
 */
const telemetrySchema = new mongoose.Schema(
    {
        tracker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tracker",
            required: true,
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
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

        recordedAt: {
            type: Date,
            required: true,
        },

        receivedAt: {
            type: Date,
            default: Date.now,
        },

        // Derived from the tracker's protocol by trackingService - never
        // defaulted, so a pipeline that forgets to set it fails loudly.
        source: {
            type: String,
            enum: TELEMETRY_SOURCE_VALUES,
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

telemetrySchema.index({ vehicle: 1, recordedAt: -1 });
telemetrySchema.index({ tracker: 1, recordedAt: -1 });

const Telemetry = mongoose.model("Telemetry", telemetrySchema);

export default Telemetry;
