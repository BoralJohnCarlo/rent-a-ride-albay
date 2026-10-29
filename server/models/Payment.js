import mongoose from "mongoose";

import {
    PAYMENT_METHOD,
    PAYMENT_TYPE,
    PAYMENT_STATUS,
    PAYMENT_REFUND_STATUS,
    PAYMENT_REFUND_REASON,
} from "../constants/paymentConstants.js";

const verificationSchema = new mongoose.Schema(
    {
        verifiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        verifiedAt: {
            type: Date,
            default: null,
        },

        rejectionReason: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const paymongoSchema = new mongoose.Schema(
    {
        checkoutSessionId: {
            type: String,
            default: "",
            trim: true,
        },

        // Set once PayMongo has confirmed this checkout can no longer be paid
        // (we expired it, or it had already expired). A cancelled payment
        // whose checkout is still open is what the closed-checkout sweep
        // keeps an eye on; this marker is what lets it stop.
        checkoutExpiredAt: {
            type: Date,
            default: null,
        },

        // The PayMongo Payment Intent ID (`pi_...`). Kept for reference; NOT
        // the ID a refund is created against — see `chargeId` below.
        paymentId: {
            type: String,
            default: "",
            trim: true,
            index: true,
        },

        // The PayMongo Payment resource ID (`pay_...`) actually charged for
        // this checkout, taken from the checkout session's `payments[]`.
        // This is what the Refunds API's `payment_id` attribute expects.
        // Empty for payments that never went through a PayMongo checkout
        // (Cash on Pickup, or a payment force-verified without one) — those
        // have no gateway charge to refund automatically.
        chargeId: {
            type: String,
            default: "",
            trim: true,
        },

        // How the customer paid inside PayMongo's checkout (its payment
        // `source.type`: "gcash", "paymaya", "card", ...). Shown on receipts.
        sourceType: {
            type: String,
            default: "",
            trim: true,
        },

        // The wallet/bank's own reference for the charge, when PayMongo
        // passes one on (`external_reference_number` or
        // `source.provider_id`) — the number a customer sees in their GCash
        // history. PayMongo leaves both null in test mode, and whether live
        // GCash fills them isn't confirmed, so this is often empty.
        providerReference: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const refundSchema = new mongoose.Schema(
    {
        refundId: {
            type: String,
            default: "",
            trim: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        reason: {
            type: String,
            enum: Object.values(PAYMENT_REFUND_REASON),
            required: true,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },

        status: {
            type: String,
            enum: Object.values(PAYMENT_REFUND_STATUS),
            required: true,
        },

        // "automatic" = a real PayMongo refund was created; "manual" = there
        // was no gateway charge to refund (e.g. Cash on Pickup) and an admin
        // must settle it outside the app, then close it out here.
        method: {
            type: String,
            enum: ["automatic", "manual"],
            required: true,
        },

        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        initiatedAt: {
            type: Date,
            default: Date.now,
        },

        completedAt: {
            type: Date,
            default: null,
        },

        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        failureReason: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const paymentSchema = new mongoose.Schema(
    {
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

        bookingExtension: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        /*
         * Set on the EXTENSION_FEE payment that collects the extra cost of an
         * approved reschedule (Booking.reschedules[]). It is an extension-type
         * fee - extra rental days - so pickup balances, revenue and
         * cancellation refunds already treat it correctly; this only says
         * which request it came from. bookingExtension holds the same id so
         * the (booking, bookingExtension) unique index doesn't collide with
         * the reservation payment's null.
         */
        bookingReschedule: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        /*
         * Same idea for the extra cost of moving to another vehicle after a
         * maintenance conflict (Booking.maintenanceConflict.vehicleChange).
         */
        bookingVehicleChange: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        paymentType: {
            type: String,
            enum: Object.values(PAYMENT_TYPE),
            required: true,
        },

        paymentMethod: {
            type: String,
            enum: Object.values(PAYMENT_METHOD),
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        status: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            required: true,
            default: PAYMENT_STATUS.PENDING,
            index: true,
        },

        verification: {
            type: verificationSchema,
            default: () => ({}),
        },

        paymongo: {
            type: paymongoSchema,
            default: () => ({}),
        },

        refund: {
            type: refundSchema,
            default: null,
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

paymentSchema.index(
    {
        booking: 1,
        paymentType: 1,
    },
    {
        unique: true,
        partialFilterExpression: {
            paymentType: PAYMENT_TYPE.RESERVATION_FEE,
        },
    }
);

paymentSchema.index(
    {
        booking: 1,
        bookingExtension: 1,
    },
    {
        unique: true,
        sparse: true,
    }
);

paymentSchema.index({
    customer: 1,
    createdAt: -1,
});

paymentSchema.index({
    status: 1,
    createdAt: -1,
});

paymentSchema.index({
    booking: 1,
    createdAt: -1,
});

/*
 * One payment per real PayMongo checkout session. Partial, not sparse: every
 * payment stores "" here until a checkout opens, and `sparse` only skips
 * documents where the field is missing - so a sparse index treated every
 * not-yet-checked-out payment as a duplicate of the others. Existing
 * databases need scripts/fixCheckoutSessionIndex.js to swap the old index.
 */
export const CHECKOUT_SESSION_INDEX_OPTIONS = {
    unique: true,
    partialFilterExpression: {
        "paymongo.checkoutSessionId": {
            $type: "string",
            $gt: "",
        },
    },
};

paymentSchema.index(
    {
        "paymongo.checkoutSessionId": 1,
    },
    CHECKOUT_SESSION_INDEX_OPTIONS
);

const Payment = mongoose.model(
    "Payment",
    paymentSchema
);

export default Payment;
