import mongoose from "mongoose";

import {
    BOOKING_STATUS,
    BOOKING_STATUS_VALUES,
    BOOKING_DRIVER_OPTION_VALUES,
    BOOKING_EXTENSION_STATUS,
    BOOKING_EXTENSION_STATUS_VALUES,
    BOOKING_EXTENSION_PRICING_METHOD_VALUES,
    BOOKING_RESCHEDULE_STATUS,
    BOOKING_RESCHEDULE_STATUS_VALUES,
    DRIVER_CHANGE_REQUEST_STATUS,
    DRIVER_CHANGE_REQUEST_STATUS_VALUES,
    BOOKING_RESCHEDULE_SETTLEMENT,
    BOOKING_RESCHEDULE_SETTLEMENT_VALUES,
    BOOKING_MAINTENANCE_CONFLICT_STATUS_VALUES,
    BOOKING_VEHICLE_CONFLICT_CAUSE,
    BOOKING_VEHICLE_CONFLICT_CAUSE_VALUES,
} from "../constants/bookingConstants.js";

const locationSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            required: true,
            trim: true,
        },

        address: {
            type: String,
            required: true,
            trim: true,
        },

        serviceLocationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ServiceLocation",
            default: null,
        },

        name: {
            type: String,
            trim: true,
            default: "",
        },

        region: {
            type: String,
            trim: true,
            default: "",
        },

        province: {
            type: String,
            trim: true,
            default: "",
        },

        city: {
            type: String,
            trim: true,
            default: "",
        },

        barangay: {
            type: String,
            trim: true,
            default: "",
        },

        latitude: {
            type: Number,
            default: null,
        },

        longitude: {
            type: Number,
            default: null,
        },

        fee: {
            type: Number,
            min: 0,
            default: 0,
        },
    },
    {
        _id: false,
    }
);

/*
 * The vehicle discount (admin Promotions → Discounts) a booking was priced
 * with, copied so later edits to — or deletion of — the discount never
 * change it. `amountPerDay` is what came off the daily rate.
 */
const vehicleDiscountSchema = new mongoose.Schema(
    {
        discount: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Discount",
            default: null,
        },

        name: {
            type: String,
            trim: true,
            default: "",
        },

        label: {
            type: String,
            trim: true,
            default: "",
        },

        discountMethod: {
            type: String,
            trim: true,
            default: null,
        },

        discountValue: {
            type: Number,
            default: null,
        },

        amountPerDay: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

const termsAcceptanceSchema = new mongoose.Schema(
    {
        document: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LegalDocument",
            required: true,
        },

        version: {
            type: Number,
            required: true,
        },

        acceptedAt: {
            type: Date,
            required: true,
        },

        // buildTermsPolicySnapshot, as plain JSON.
        policySnapshot: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },
    },
    {
        _id: false,
    }
);

const noShowOutcomeSchema = new mongoose.Schema(
    {
        refundPercent: { type: Number, default: 0 },
        keptAmount: { type: Number, default: 0 },
        refundAmount: { type: Number, default: 0 },
        // "booking" | "current" | null (no locked terms).
        policySource: { type: String, default: null },
        termsVersion: { type: Number, default: null },
    },
    {
        _id: false,
    }
);

const pricingSchema = new mongoose.Schema(
    {
        // After any vehicle discount (see originalDailyRate).
        dailyRate: {
            type: Number,
            required: true,
            min: 0,
        },

        // The vehicle's own rate when a discount lowered dailyRate; null
        // when no discount applied.
        originalDailyRate: {
            type: Number,
            default: null,
            min: 0,
        },

        vehicleDiscount: {
            type: vehicleDiscountSchema,
            default: null,
        },

        reservationFee: {
            type: Number,
            required: true,
            min: 0,
        },

        rentalDays: {
            type: Number,
            required: true,
            min: 1,
        },

        subtotal: {
            type: Number,
            required: true,
            min: 0,
        },

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        /*
         * Paid by the platform, not the customer: after a late return moved
         * this booking to a pricier vehicle, the customer kept their price
         * (totalAmount) and the difference is covered here. Partner payouts
         * add it back, so the new vehicle's owner earns its full rate.
         * Repricing (a later vehicle change or reschedule) drops it.
         */
        platformCoveredAmount: {
            type: Number,
            min: 0,
            default: 0,
        },

        pickupDistanceKm: {
            type: Number,
            default: null,
        },

        returnDistanceKm: {
            type: Number,
            default: null,
        },

        pickupDistanceFee: {
            type: Number,
            min: 0,
            default: 0,
        },

        returnDistanceFee: {
            type: Number,
            min: 0,
            default: 0,
        },

        /*
         * The driver's price for a "With Driver" booking, locked when the
         * booking is priced (see driverPricingService): per rental day, and
         * driverFee = driverDailyRate × rentalDays. Kept apart from
         * `subtotal` (the vehicle's charge) so vehicle-rate vouchers and
         * partner payouts don't touch it; it is included in totalAmount.
         */
        driverDailyRate: {
            type: Number,
            min: 0,
            default: 0,
        },

        driverFee: {
            type: Number,
            min: 0,
            default: 0,
        },
    },
    {
        _id: false,
    }
);

const voucherSchema = new mongoose.Schema(
    {
        voucher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Voucher",
            default: null,
        },

        code: {
            type: String,
            trim: true,
            default: null,
        },

        name: {
            type: String,
            trim: true,
            default: null,
        },

        type: {
            type: String,
            trim: true,
            default: null,
        },

        discountMethod: {
            type: String,
            trim: true,
            default: null,
        },

        discountValue: {
            type: Number,
            default: null,
        },

        discountAmount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

const extensionPricingSchema =
    new mongoose.Schema(
        {
            pricingMethod: {
                type: String,
                enum: BOOKING_EXTENSION_PRICING_METHOD_VALUES,
                required: true,
                trim: true,
            },

            fixedRate: {
                type: Number,
                default: null,
                min: 0,
            },

            hourlyRate: {
                type: Number,
                default: null,
                min: 0,
            },

            additionalHours: {
                type: Number,
                required: true,
                min: 1,
            },

            // Total for the extension, vehicle and driver share together.
            amount: {
                type: Number,
                required: true,
                min: 0,
            },

            // The driver's part of `amount` (With Driver bookings only):
            // the booking's driver daily rate ÷ 24 per extra hour.
            driverHourlyRate: {
                type: Number,
                default: 0,
                min: 0,
            },

            driverAmount: {
                type: Number,
                default: 0,
                min: 0,
            },
        },
        {
            _id: false,
        }
    );

const extensionSchema = new mongoose.Schema(
    {
        requestedEndDate: {
            type: Date,
            required: true,
        },

        previousEndDate: {
            type: Date,
            required: true,
        },

        additionalHours: {
            type: Number,
            required: true,
            min: 1,
        },

        pricing: {
            type: extensionPricingSchema,
            required: true,
        },

        status: {
            type: String,
            enum: BOOKING_EXTENSION_STATUS_VALUES,
            default: BOOKING_EXTENSION_STATUS.PENDING,
            trim: true,
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },

        requestedAt: {
            type: Date,
            default: Date.now,
        },

        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        approvedAt: {
            type: Date,
            default: null,
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        rejectedAt: {
            type: Date,
            default: null,
        },

        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
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
    },
    {
        _id: true,
    }
);



/*
 * A request to move the whole booking to new dates before pickup (same
 * vehicle, driver option and locations). `pricing` is the quote the customer
 * saw when asking; approval applies it. `settlement` records how the price
 * difference was handled once approved: a new online payment for extra days,
 * or a refund of what was overpaid.
 */
const rescheduleSchema = new mongoose.Schema(
    {
        requestedStartDate: {
            type: Date,
            required: true,
        },

        requestedEndDate: {
            type: Date,
            required: true,
        },

        previousStartDate: {
            type: Date,
            required: true,
        },

        previousEndDate: {
            type: Date,
            required: true,
        },

        pricing: {
            dailyRate: { type: Number, default: 0, min: 0 },
            rentalDays: { type: Number, default: 0, min: 0 },
            subtotal: { type: Number, default: 0, min: 0 },
            driverDailyRate: { type: Number, default: 0, min: 0 },
            driverFee: { type: Number, default: 0, min: 0 },
            previousTotalAmount: { type: Number, default: 0, min: 0 },
            totalAmount: { type: Number, default: 0, min: 0 },
            // New total minus the old one: positive = more to pay.
            difference: { type: Number, default: 0 },
        },

        status: {
            type: String,
            enum: BOOKING_RESCHEDULE_STATUS_VALUES,
            default: BOOKING_RESCHEDULE_STATUS.PENDING,
            trim: true,
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },

        requestedAt: {
            type: Date,
            default: Date.now,
        },

        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // An admin rescheduling directly (no customer request).
        requestedByAdmin: {
            type: Boolean,
            default: false,
        },

        approvedAt: { type: Date, default: null },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        rejectedAt: { type: Date, default: null },
        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        rejectionReason: {
            type: String,
            default: "",
            trim: true,
        },

        cancelledAt: { type: Date, default: null },
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

        settlement: {
            // Named `kind`: a nested key called `type` would be read by
            // Mongoose as this object's schema type.
            kind: {
                type: String,
                enum: BOOKING_RESCHEDULE_SETTLEMENT_VALUES,
                default: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
            },
            amount: { type: Number, default: 0, min: 0 },
            payment: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Payment",
                default: null,
            },
            // A refund that couldn't go through automatically and was handed
            // to an admin instead.
            allocations: { type: [{ payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" }, amount: { type: Number, min: 0 } }], default: undefined },
            manual: { type: Boolean, default: false },
        },
    },
    {
        timestamps: false,
    }
);

/*
 * The booking's vehicle won't be ready for it before pickup (see
 * BOOKING_MAINTENANCE_CONFLICT_STATUS): it went under maintenance over its
 * dates, or the previous renter is returning it late (`cause`). Holds the
 * latest such conflict, how it was resolved, and — when the customer moved
 * to another vehicle — the switch with its price difference and how that
 * was settled.
 */
const maintenanceConflictSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: BOOKING_MAINTENANCE_CONFLICT_STATUS_VALUES,
            required: true,
        },

        // Older conflicts (before late returns) have none: maintenance.
        cause: {
            type: String,
            enum: BOOKING_VEHICLE_CONFLICT_CAUSE_VALUES,
            default: BOOKING_VEHICLE_CONFLICT_CAUSE.MAINTENANCE,
        },

        // The vehicle that went under maintenance / is out late.
        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },

        // Late return: the overdue rental holding the vehicle, when it was
        // due back, and when it finally came back.
        blockingRental: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rental",
            default: null,
        },
        dueBackAt: { type: Date, default: null },
        vehicleReturnedAt: { type: Date, default: null },

        // Late return: the customer chose to wait; past waitUntil with the
        // vehicle still out, full refund.
        waitingSince: { type: Date, default: null },
        waitUntil: { type: Date, default: null },

        maintenanceMode: {
            type: String,
            default: "",
        },

        // Null: no end date (off road).
        maintenanceUntil: {
            type: Date,
            default: null,
        },

        detectedAt: { type: Date, default: Date.now },

        optionsSentAt: { type: Date, default: null },
        optionsSentBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // The customer's deadline to choose; past it, full refund.
        respondBy: { type: Date, default: null },

        resolvedAt: { type: Date, default: null },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        // Who chose: "customer", "admin" or "system" (deadline passed).
        resolvedByRole: {
            type: String,
            default: "",
        },
        resolutionNote: {
            type: String,
            default: "",
            trim: true,
        },

        refundAmount: { type: Number, default: 0, min: 0 },

        vehicleChange: {
            // Payment.bookingExtension/bookingVehicleChange of the extra
            // charge, if any.
            changeId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },
            previousVehicle: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Vehicle",
                default: null,
            },
            newVehicle: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Vehicle",
                default: null,
            },
            pricing: {
                previousDailyRate: { type: Number, default: 0, min: 0 },
                dailyRate: { type: Number, default: 0, min: 0 },
                previousTotalAmount: { type: Number, default: 0, min: 0 },
                totalAmount: { type: Number, default: 0, min: 0 },
                // New total minus the old one: positive = more to pay.
                difference: { type: Number, default: 0 },
                // Late return: the part of a positive difference the
                // platform paid instead of the customer (free upgrade).
                coveredAmount: { type: Number, default: 0, min: 0 },
            },
            settlement: {
                kind: {
                    type: String,
                    enum: BOOKING_RESCHEDULE_SETTLEMENT_VALUES,
                    default: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
                },
                amount: { type: Number, default: 0, min: 0 },
                payment: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Payment",
                    default: null,
                },
                allocations: { type: [{ payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" }, amount: { type: Number, min: 0 } }], default: undefined },
                manual: { type: Boolean, default: false },
            },
        },
    },
    {
        _id: false,
    }
);

/*
 * Every move to another vehicle (Booking.vehicleChanges) — kept apart from
 * maintenanceConflict, which a later conflict replaces. Refunds and payment
 * checks read this history, so an earlier switch is never forgotten.
 */
/* Every driver swap before pickup (by an admin, or approving a request). */
const driverChangeSchema = new mongoose.Schema(
    {
        previousDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },
        newDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            required: true,
        },
        reason: { type: String, default: "", trim: true },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        changedAt: { type: Date, default: Date.now },
        // The customer request this answered, if any.
        requestId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },
    },
    { _id: true }
);

/* A customer asking for a different driver; an admin approves or declines. */
const driverChangeRequestSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: DRIVER_CHANGE_REQUEST_STATUS_VALUES,
            default: DRIVER_CHANGE_REQUEST_STATUS.PENDING,
        },
        reason: { type: String, default: "", trim: true },
        preferredDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        requestedAt: { type: Date, default: Date.now },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        resolvedAt: { type: Date, default: null },
        // Admin's note on approve/decline, or why it was closed.
        resolutionNote: { type: String, default: "", trim: true },
        assignedDriver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },
    },
    { _id: true }
);

const vehicleChangeHistorySchema = new mongoose.Schema(
    {
        changeId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        previousVehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },
        newVehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            default: null,
        },
        changedAt: { type: Date, default: Date.now },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        previousTotalAmount: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, default: 0, min: 0 },
        settlement: {
            kind: {
                type: String,
                enum: BOOKING_RESCHEDULE_SETTLEMENT_VALUES,
                default: BOOKING_RESCHEDULE_SETTLEMENT.NONE,
            },
            amount: { type: Number, default: 0, min: 0 },
            allocations: { type: [{ payment: { type: mongoose.Schema.Types.ObjectId, ref: "Payment" }, amount: { type: Number, min: 0 } }], default: undefined },
        },
    },
    {
        _id: false,
    }
);

const statusHistorySchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: BOOKING_STATUS_VALUES,
            required: true,
        },

        changedAt: {
            type: Date,
            default: Date.now,
        },

        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const auditSchema = new mongoose.Schema(
    {
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        _id: false,
    }
);

const bookingSchema = new mongoose.Schema(
    {
        // Held across external refund calls; cleared with the settlement record.
        priceChangeSettlementPending: { type: Boolean, default: false },
        bookingCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
        },

        driverOption: {
            type: String,
            enum: BOOKING_DRIVER_OPTION_VALUES,
            required: true,
            trim: true,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },

        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
        },

        /*
         * The schedule the customer booked (pickup date → return date,
         * counted from 8:00 AM Manila). Set once, at pickup, when startDate
         * and endDate move to the real hand-over time and the matching due-back
         * time (see createRental). Null until then: before pickup,
         * startDate/endDate are the booked schedule.
         */
        scheduledStartDate: {
            type: Date,
            default: null,
        },

        scheduledEndDate: {
            type: Date,
            default: null,
        },

        /*
         * When the vehicle was due back, recorded at return (processReturn).
         * endDate then moves to the actual return time so the turnaround
         * buffer counts from it; this keeps the due-back time for display.
         */
        dueBackDate: {
            type: Date,
            default: null,
        },

        pickupLocation: {
            type: locationSchema,
            required: true,
        },

        returnLocation: {
            type: locationSchema,
            required: true,
        },

        pricing: {
            type: pricingSchema,
            required: true,
        },

        voucher: {
            type: voucherSchema,
            default: null,
        },

        extensions: {
            type: [extensionSchema],
            default: [],
        },

        reschedules: {
            type: [rescheduleSchema],
            default: [],
        },

        driverChanges: {
            type: [driverChangeSchema],
            default: [],
        },

        driverChangeRequests: {
            type: [driverChangeRequestSchema],
            default: [],
        },

        maintenanceConflict: {
            type: maintenanceConflictSchema,
            default: null,
        },

        vehicleChanges: {
            type: [vehicleChangeHistorySchema],
            default: [],
        },

        status: {
            type: String,
            enum: BOOKING_STATUS_VALUES,
            default: BOOKING_STATUS.PENDING,
            trim: true,
        },

        statusHistory: {
            type: [statusHistorySchema],
            default: [],
        },

        refundAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        customerNotes: {
            type: String,
            default: "",
            trim: true,
        },

        internalNotes: {
            type: String,
            default: "",
            trim: true,
        },

        /*
         * The Terms & Conditions version the customer accepted when booking
         * (Settings → Terms & Policies), plus the settings its live policy
         * blocks were written from at that moment, so the exact terms they
         * agreed to can be shown later even after either is edited. Null on
         * bookings made before this was recorded.
         */
        termsAcceptance: {
            type: termsAcceptanceSchema,
            default: null,
        },

        /*
         * Set when the booking is marked a no-show: what was kept and
         * refunded, and whether its locked terms ("booking") or today's
         * kinder rules ("current") decided it (lockedTermsService).
         */
        noShowOutcome: {
            type: noShowOutcomeSchema,
            default: null,
        },

        audit: {
            type: auditSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

bookingSchema.index({
    customer: 1,
});

bookingSchema.index({
    vehicle: 1,
});

bookingSchema.index({
    status: 1,
});

bookingSchema.index({
    startDate: 1,
    endDate: 1,
});

bookingSchema.index({
    vehicle: 1,
    startDate: 1,
    endDate: 1,
});

bookingSchema.index({
    customer: 1,
    status: 1,
});

bookingSchema.index(
    {
        "maintenanceConflict.status": 1,
        "maintenanceConflict.respondBy": 1,
    },
    { sparse: true }
);

const Booking = mongoose.model(
    "Booking",
    bookingSchema
);

export default Booking;
