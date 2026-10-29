import mongoose from "mongoose";

import {
    AVAILABILITY_REQUEST_STATUS,
    AVAILABILITY_REQUEST_STATUS_VALUES,
    AVAILABILITY_REQUEST_REASON_VALUES,
} from "../constants/vehicleAvailabilityRequestConstants.js";

const dateRangeSchema = new mongoose.Schema(
    {
        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
        },
    },
    { _id: false }
);

const vehicleAvailabilityRequestSchema = new mongoose.Schema(
    {
        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
            index: true,
        },

        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        dateRanges: {
            type: [dateRangeSchema],
            validate: {
                validator: (ranges) =>
                    Array.isArray(ranges) && ranges.length > 0,
                message:
                    "At least one date range is required.",
            },
        },

        reason: {
            type: String,
            enum: AVAILABILITY_REQUEST_REASON_VALUES,
            required: true,
        },

        /*
         * Free-text detail. Required by the validator when reason is
         * "Others" (the reason itself, since there's no preset to fall back
         * on) — optional extra context otherwise.
         */
        reasonDetails: {
            type: String,
            default: "",
            trim: true,
        },

        status: {
            type: String,
            enum: AVAILABILITY_REQUEST_STATUS_VALUES,
            default: AVAILABILITY_REQUEST_STATUS.PENDING,
            index: true,
        },

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

        reviewRemarks: {
            type: String,
            default: "",
            trim: true,
        },

        rejectionReason: {
            type: String,
            default: "",
            trim: true,
        },

        cancelledAt: {
            type: Date,
            default: null,
        },

        audit: {
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            },

            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
        },
    },
    {
        timestamps: true,
    }
);

vehicleAvailabilityRequestSchema.index({
    vehicle: 1,
    status: 1,
});

const VehicleAvailabilityRequest = mongoose.model(
    "VehicleAvailabilityRequest",
    vehicleAvailabilityRequestSchema
);

export default VehicleAvailabilityRequest;
