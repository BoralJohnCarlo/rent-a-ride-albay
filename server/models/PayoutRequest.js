import mongoose from "mongoose";

import {
    PAYOUT_STATUS,
    PAYOUT_STATUS_VALUES,
    PAYOUT_METHOD,
    PAYOUT_METHOD_VALUES,
} from "../constants/payoutConstants.js";

const payoutItemSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },
        rental: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rental",
            default: null,
        },
        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
        },
        // What the payout was worked out from: the booking total less any
        // refund for a vehicle-performance issue (see refundDeduction).
        bookingAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        // Approved refunds for a vehicle-performance issue on this booking,
        // taken off the operator's side before commission. Refunds for any
        // other reason are absorbed by the platform and never appear here.
        refundDeduction: {
            type: Number,
            default: 0,
            min: 0,
        },
        platformCommission: {
            type: Number,
            required: true,
            min: 0,
        },
        operatorEarnings: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    { _id: true }
);

const bankAccountSchema = new mongoose.Schema(
    {
        bankName: {
            type: String,
            required: true,
            trim: true,
        },
        accountNumber: {
            type: String,
            required: true,
            trim: true,
        },
        accountName: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false }
);

const gcashAccountSchema = new mongoose.Schema(
    {
        gcashNumber: {
            type: String,
            required: true,
            trim: true,
        },
        accountName: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false }
);

const payoutRequestSchema = new mongoose.Schema(
    {
        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        payoutCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        payoutMethod: {
            type: String,
            enum: PAYOUT_METHOD_VALUES,
            required: true,
        },
        bankAccount: {
            type: bankAccountSchema,
            default: null,
        },
        gcashAccount: {
            type: gcashAccountSchema,
            default: null,
        },
        items: {
            type: [payoutItemSchema],
            default: [],
        },
        subtotalAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        totalCommission: {
            type: Number,
            required: true,
            min: 0,
        },
        payoutAmount: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            default: "PHP",
            trim: true,
        },
        status: {
            type: String,
            enum: PAYOUT_STATUS_VALUES,
            default: PAYOUT_STATUS.PENDING,
            index: true,
        },
        requestedAt: {
            type: Date,
            default: Date.now,
        },
        scheduledReleaseAt: {
            type: Date,
            default: null,
            index: true,
        },
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        processedAt: {
            type: Date,
            default: null,
        },
        rejectionReason: {
            type: String,
            default: "",
            trim: true,
        },
        paidAt: {
            type: Date,
            default: null,
        },
        paidBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        paidVia: {
            type: String,
            default: "",
            trim: true,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        cancellationReason: {
            type: String,
            default: "",
            trim: true,
        },
        notes: {
            type: String,
            default: "",
            trim: true,
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

payoutRequestSchema.index({
    status: 1,
    requestedAt: -1,
});

payoutRequestSchema.index({
    operator: 1,
    status: 1,
});

payoutRequestSchema.index({
    requestedAt: -1,
});

const PayoutRequest = mongoose.model(
    "PayoutRequest",
    payoutRequestSchema
);

export default PayoutRequest;