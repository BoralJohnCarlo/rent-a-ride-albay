import mongoose from "mongoose";

import {
    MANUAL_REFUND_STATUS,
    MANUAL_REFUND_STATUS_VALUES,
} from "../constants/paymentConstants.js";

/*
 * Money owed back to a customer for a booking that ended before pickup, which
 * couldn't be refunded through its payment — each Payment carries a single
 * refund record, and it was already used (typically by a reschedule to fewer
 * days, before the booking was then cancelled or marked a no-show).
 *
 * It used to exist only as an admin notification, easy to read and forget.
 * This keeps it on a list until an admin pays it outside the app and marks
 * it Paid (or Not Paid, if it couldn't be done).
 */
const manualRefundSchema = new mongoose.Schema(
    {
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // The payment whose refund slot was already taken, when known.
        payment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            default: null,
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        // Why it's owed, in words an admin can act on.
        reason: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: MANUAL_REFUND_STATUS_VALUES,
            default: MANUAL_REFUND_STATUS.OWED,
        },

        // Null when the system raised it (a cancellation, a sweep).
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        settledAt: {
            type: Date,
            default: null,
        },

        settledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        settlementNote: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

manualRefundSchema.index({ status: 1, createdAt: -1 });
manualRefundSchema.index({ booking: 1 });

const ManualRefund = mongoose.model(
    "ManualRefund",
    manualRefundSchema
);

export default ManualRefund;
