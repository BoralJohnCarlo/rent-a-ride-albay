import mongoose from "mongoose";

import {
    ALERT_TYPE_VALUES,
    ALERT_SEVERITY_VALUES,
    ALERT_STATUS,
    ALERT_STATUS_VALUES,
} from "../constants/alertConstants.js";

/*
 * Represents an actual condition/event derived from the normalized
 * telemetry/tracking layer (never a raw AIKA/GT06 concept, never one row
 * per telemetry packet) - see alertService.js for the create-once/
 * resolve-on-recovery lifecycle. Historical Telemetry remains the source of
 * telemetry history; `context` only ever holds a handful of small values
 * relevant to this specific alert, never a full telemetry document.
 */
const alertSchema = new mongoose.Schema(
    {
        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
        },

        tracker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Tracker",
            default: null,
        },

        type: {
            type: String,
            enum: ALERT_TYPE_VALUES,
            required: true,
        },

        severity: {
            type: String,
            enum: ALERT_SEVERITY_VALUES,
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
        },

        message: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: ALERT_STATUS_VALUES,
            default: ALERT_STATUS.ACTIVE,
        },

        isRead: {
            type: Boolean,
            default: false,
        },

        // Small, alert-specific values only (e.g. batteryLevel, lastSeenAt) -
        // never a copy of the triggering Telemetry document.
        context: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
        },

        triggeredAt: {
            type: Date,
            default: Date.now,
        },

        resolvedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

alertSchema.index({ vehicle: 1, triggeredAt: -1 });
alertSchema.index({ status: 1, triggeredAt: -1 });
alertSchema.index({ type: 1, triggeredAt: -1 });

// Database-level guarantee of at most one ACTIVE alert per vehicle+type, so
// concurrent evaluations can never create duplicates (alertService handles
// the resulting duplicate-key error). Resolved alerts are unconstrained.
alertSchema.index(
    { vehicle: 1, type: 1 },
    {
        unique: true,
        partialFilterExpression: { status: ALERT_STATUS.ACTIVE },
    }
);

const Alert = mongoose.model("Alert", alertSchema);

export default Alert;
