import mongoose from "mongoose";

/*
 * An acknowledgement receipt for money that actually moved on a booking:
 * a payment received (kind "payment", AR-…) or a refund sent back (kind
 * "refund", RF-…). NOT a BIR official receipt or sales invoice.
 *
 * A receipt is a snapshot taken when it's issued — who paid, for which
 * vehicle and dates, how much — so it reads the same later even if the
 * booking is edited or the vehicle changed. Exactly one receipt exists per
 * money movement: `source` names it, and is unique.
 *
 * Sources:
 *   Payment        — a VERIFIED/REFUNDED Payment (reservation, extension,
 *                    reschedule or vehicle-change fee)
 *   RentalPayment  — a verified Rental.payments entry (subId); e.g. the
 *                    balance paid at pickup
 *   PaymentRefund  — a Payment's refund once it SUCCEEDED
 *   ManualRefund   — a ManualRefund marked Paid
 *   RentalRefund   — a Rental.refunds entry (subId) settled outside any
 *                    Payment (refunds a Payment carries are PaymentRefund)
 */
export const RECEIPT_KIND = Object.freeze({
    PAYMENT: "payment",
    REFUND: "refund",
});

export const RECEIPT_SOURCE = Object.freeze({
    PAYMENT: "Payment",
    RENTAL_PAYMENT: "RentalPayment",
    PAYMENT_REFUND: "PaymentRefund",
    MANUAL_REFUND: "ManualRefund",
    RENTAL_REFUND: "RentalRefund",
});

export const RECEIPT_NUMBER_PREFIX = Object.freeze({
    [RECEIPT_KIND.PAYMENT]: "AR",
    [RECEIPT_KIND.REFUND]: "RF",
});

const receiptSchema = new mongoose.Schema(
    {
        receiptNumber: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        kind: {
            type: String,
            enum: Object.values(RECEIPT_KIND),
            required: true,
        },

        source: {
            model: {
                type: String,
                enum: Object.values(RECEIPT_SOURCE),
                required: true,
            },

            id: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
            },

            // The array entry inside `id` (Rental.payments / Rental.refunds).
            subId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            index: true,
        },

        rental: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rental",
            default: null,
        },

        // What the money was for, in the customer's words.
        description: {
            type: String,
            required: true,
            trim: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        method: {
            type: String,
            default: "",
            trim: true,
        },

        // The transaction ID: PayMongo's payment/refund ID, or a reference an
        // admin entered for a payment taken at the counter. Empty for cash
        // and for refunds paid outside the app.
        reference: {
            type: String,
            default: "",
            trim: true,
        },

        // The wallet/bank's own reference (e.g. the GCash reference number),
        // when PayMongo passed one on. See Payment.paymongo.providerReference.
        providerReference: {
            type: String,
            default: "",
            trim: true,
        },

        // When the money moved (not when this receipt was issued).
        transactionDate: {
            type: Date,
            required: true,
        },

        snapshot: {
            customerName: { type: String, default: "", trim: true },
            customerEmail: { type: String, default: "", trim: true },
            customerPhone: { type: String, default: "", trim: true },
            vehicleName: { type: String, default: "", trim: true },
            plateNumber: { type: String, default: "", trim: true },
            startDate: { type: Date, default: null },
            endDate: { type: Date, default: null },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

receiptSchema.index(
    {
        "source.model": 1,
        "source.id": 1,
        "source.subId": 1,
    },
    { unique: true }
);

receiptSchema.index({ booking: 1, transactionDate: 1 });

const Receipt = mongoose.model("Receipt", receiptSchema);

export default Receipt;
