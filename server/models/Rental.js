import mongoose from "mongoose";

import {
    PAYMENT_REFUND_STATUS,
} from "../constants/paymentConstants.js";

import {
    RENTAL_STATUS,
    RENTAL_STATUS_VALUES,
    RENTAL_INSPECTION_CONDITION_VALUES,
    RENTAL_CHARGE_TYPE_VALUES,
    RENTAL_ADJUSTMENT_TYPE_VALUES,
    RENTAL_PAYMENT_TYPE_VALUES,
    RENTAL_PAYMENT_STATUS,
    RENTAL_PAYMENT_STATUS_VALUES,
    RENTAL_PAYMENT_METHOD_VALUES,
    RENTAL_SECURITY_DEPOSIT_STATUS,
    RENTAL_SECURITY_DEPOSIT_STATUS_VALUES,
    RENTAL_REFUND_REASON_VALUES,
    RENTAL_REFUND_STATUS,
    RENTAL_REFUND_STATUS_VALUES,
    RENTAL_EARLY_RETURN_STATUS,
    RENTAL_EARLY_RETURN_STATUS_VALUES,
    RENTAL_OPERATIONAL_EVENT_VALUES,
    RENTAL_VEHICLE_OUTCOME_VALUES,
} from "../constants/rentalConstants.js";

import {
    BOOKING_EXTENSION_PRICING_METHOD_VALUES,
    BOOKING_EXTENSION_STATUS,
    BOOKING_EXTENSION_STATUS_VALUES,
} from "../constants/bookingConstants.js";

const photoSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            required: true,
            trim: true,
        },

        publicId: {
            type: String,
            default: "",
            trim: true,
        },

        originalName: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: true,
        timestamps: true,
    }
);

const bookingPeriodSchema = new mongoose.Schema(
    {
        originalStartDate: {
            type: Date,
            required: true,
        },

        originalEndDate: {
            type: Date,
            required: true,
        },

        /*
         * When the vehicle was actually handed over. The rental period runs
         * from here for the booked duration (actualEndDate is the due-back
         * time). Null on rentals created before pickup times were tracked;
         * those keep measuring from the booked dates.
         */
        actualStartDate: {
            type: Date,
            default: null,
        },

        /*
         * True when the due-back time was cut short so it wouldn't run into
         * the next booking (or a blocked period) for the same vehicle or
         * driver after a late pickup.
         */
        returnCapped: {
            type: Boolean,
            default: false,
        },
    },
    {
        _id: false,
    }
);

const inspectionSchema = new mongoose.Schema(
    {
        date: {
            type: Date,
            default: null,
        },

        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        condition: {
            type: String,
            enum: RENTAL_INSPECTION_CONDITION_VALUES,
            default: null,
        },

        odometer: {
            type: Number,
            default: null,
            min: 0,
        },

        fuelLevel: {
            type: Number,
            default: null,
            min: 0,
            max: 100,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },

        photos: {
            type: [photoSchema],
            default: [],
        },
    },
    {
        _id: false,
    }
);

const damageIssueSchema = new mongoose.Schema(
    {
        description: {
            type: String,
            required: true,
            trim: true,
        },

        condition: {
            type: String,
            enum: RENTAL_INSPECTION_CONDITION_VALUES,
            default: null,
        },

        photos: {
            type: [photoSchema],
            default: [],
        },

        chargeReference: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        chargeAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: true,
    }
);

const chargeSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: RENTAL_CHARGE_TYPE_VALUES,
            required: true,
            trim: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        addedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: true,
    }
);

const adjustmentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: RENTAL_ADJUSTMENT_TYPE_VALUES,
            required: true,
            trim: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        reason: {
            type: String,
            required: true,
            trim: true,
        },

        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        processedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: true,
    }
);

const paymentSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        type: {
            type: String,
            enum: RENTAL_PAYMENT_TYPE_VALUES,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: RENTAL_PAYMENT_STATUS_VALUES,
            default: RENTAL_PAYMENT_STATUS.PENDING,
            trim: true,
        },

        paymentDate: {
            type: Date,
            default: Date.now,
        },

        paymentMethod: {
            type: String,
            enum: RENTAL_PAYMENT_METHOD_VALUES,
            required: true,
            trim: true,
        },

        reference: {
            type: String,
            default: "",
            trim: true,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },

        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

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
        _id: true,
    }
);

const securityDepositSchema = new mongoose.Schema(
    {
        required: {
            type: Boolean,
            default: false,
        },

        amount: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: RENTAL_SECURITY_DEPOSIT_STATUS_VALUES,
            default: RENTAL_SECURITY_DEPOSIT_STATUS.NOT_REQUIRED,
            trim: true,
        },

        amountHeld: {
            type: Number,
            default: 0,
            min: 0,
        },

        amountDeducted: {
            type: Number,
            default: 0,
            min: 0,
        },

        amountReleased: {
            type: Number,
            default: 0,
            min: 0,
        },

        deductionReason: {
            type: String,
            default: "",
            trim: true,
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
    },
    {
        _id: false,
    }
);

const refundSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        reason: {
            type: String,
            enum: RENTAL_REFUND_REASON_VALUES,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        status: {
            type: String,
            enum: RENTAL_REFUND_STATUS_VALUES,
            default: RENTAL_REFUND_STATUS.APPROVED,
        },

        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
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

        reference: {
            type: String,
            default: "",
            trim: true,
        },

        /*
         * Whether approving this refund actually sent money back through
         * PayMongo, against the booking's reservation-fee payment — the
         * only payment on a rental that ever went through a real gateway
         * charge. "not_applicable" until approved; stays that way if the
         * request is rejected or withdrawn instead.
         */
        gatewayStatus: {
            type: String,
            enum: [
                ...Object.values(PAYMENT_REFUND_STATUS),
                "not_applicable",
            ],
            default: "not_applicable",
        },

        gatewayRefundId: {
            type: String,
            default: "",
            trim: true,
        },

        gatewayPayment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Payment",
            default: null,
        },

        /*
         * Set when an admin confirms a refund that had to be paid outside the
         * app (gatewayStatus "requires_manual_action") and that no Payment
         * tracks — e.g. a second refund on a payment that already carried
         * one. Refunds tracked by a Payment are settled from the Payments
         * tab instead and mirrored here.
         */
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
        _id: true,
        timestamps: true,
    }
);

const operationalEventSchema =
    new mongoose.Schema(
        {
            type: {
                type: String,
                enum: RENTAL_OPERATIONAL_EVENT_VALUES,
                required: true,
                trim: true,
            },

            date: {
                type: Date,
                default: Date.now,
            },

            performedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            description: {
                type: String,
                default: "",
                trim: true,
            },

            referenceId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },
        },
        {
            _id: true,
        }
    );

const driverReassignmentSchema =
    new mongoose.Schema(
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

            reason: {
                type: String,
                default: "",
                trim: true,
            },

            reassignedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            reassignedAt: {
                type: Date,
                default: Date.now,
            },
        },
        {
            _id: true,
        }
    );

const noShowSchema = new mongoose.Schema(
    {
        expectedPickupAt: {
            type: Date,
            default: null,
        },

        gracePeriodMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        confirmedAt: {
            type: Date,
            default: null,
        },

        confirmedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
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

const penaltyHistorySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            enum: [
                "applied",
                "waived",
                "adjusted",
                "note_added",
            ],
            required: true,
        },

        previousAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        newAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },

        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        performedAt: {
            type: Date,
            default: Date.now,
        },

        gracePeriodMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        chargingUnit: {
            type: String,
            default: "",
            trim: true,
        },

        chargedUnits: {
            type: Number,
            default: 0,
            min: 0,
        },

        rate: {
            type: Number,
            default: 0,
            min: 0,
        },

        rateType: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const lateReturnSchema = new mongoose.Schema(
    {
        expectedReturnAt: {
            type: Date,
            default: null,
        },

        actualReturnAt: {
            type: Date,
            default: null,
        },

        gracePeriodMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        lateDurationMinutes: {
            type: Number,
            default: 0,
            min: 0,
        },

        chargingUnit: {
            type: String,
            default: "",
            trim: true,
        },

        chargedUnits: {
            type: Number,
            default: 0,
            min: 0,
        },

        rate: {
            type: Number,
            default: 0,
            min: 0,
        },

        rateType: {
            type: String,
            default: "",
            trim: true,
        },

        amount: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
         * Whose penalty rules set the charge: the booking's locked terms
         * ("booking"), today's when they were kinder ("current"), or null
         * for a booking without locked terms (lockedTermsService).
         */
        policySource: {
            type: String,
            default: null,
        },

        termsVersion: {
            type: Number,
            default: null,
        },

        confirmedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        confirmedAt: {
            type: Date,
            default: null,
        },
    },
    {
        _id: false,
    }
);

const earlyReturnSchema = new mongoose.Schema(
    {
        detected: {
            type: Boolean,
            default: false,
        },

        expectedReturnAt: {
            type: Date,
            default: null,
        },

        actualReturnAt: {
            type: Date,
            default: null,
        },

        unusedFullDays: {
            type: Number,
            default: 0,
            min: 0,
        },

        dailyRate: {
            type: Number,
            default: 0,
            min: 0,
        },

        creditAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        status: {
            type: String,
            enum: RENTAL_EARLY_RETURN_STATUS_VALUES,
            default: RENTAL_EARLY_RETURN_STATUS.PENDING,
        },

        approvedUnusedDays: {
            type: Number,
            default: 0,
            min: 0,
        },

        approvedCreditAmount: {
            type: Number,
            default: 0,
            min: 0,
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

        rejectionReason: {
            type: String,
            default: "",
            trim: true,
        },

        voucher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Voucher",
            default: null,
        },

        // As on lateReturn: whose credit rules applied.
        policySource: {
            type: String,
            default: null,
        },

        termsVersion: {
            type: Number,
            default: null,
        },
    },
    {
        _id: false,
    }
);

const financialSchema = new mongoose.Schema(
    {
        baseRentalCharge: {
            type: Number,
            required: true,
            min: 0,
        },

        reservationFee: {
            type: Number,
            required: true,
            min: 0,
        },

        pickupDistanceFee: {
            type: Number,
            default: 0,
            min: 0,
        },

        returnDistanceFee: {
            type: Number,
            default: 0,
            min: 0,
        },

        // The booking's driver fee (booked days); an extension's driver
        // share is inside that extension's charge.
        driverFee: {
            type: Number,
            default: 0,
            min: 0,
        },

        extensionCharges: {
            type: Number,
            default: 0,
            min: 0,
        },

        lateCharges: {
            type: Number,
            default: 0,
            min: 0,
        },

        damageCharges: {
            type: Number,
            default: 0,
            min: 0,
        },

        otherCharges: {
            type: Number,
            default: 0,
            min: 0,
        },

        discounts: {
            type: Number,
            default: 0,
            min: 0,
        },

        adjustments: {
            type: Number,
            default: 0,
            min: 0,
        },

        refunds: {
            type: Number,
            default: 0,
            min: 0,
        },

        finalAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        amountPaid: {
            type: Number,
            default: 0,
            min: 0,
        },

        securityDepositApplied: {
            type: Number,
            default: 0,
            min: 0,
        },

        balance: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

const completionSchema = new mongoose.Schema(
    {
        completedAt: {
            type: Date,
            default: null,
        },

        completedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        notes: {
            type: String,
            default: "",
            trim: true,
        },

        // Snapshot of the outstanding balance at the moment of completion,
        // set only when an admin explicitly completed the rental despite it
        // (see `completeRental`'s `overrideOutstandingBalance`). Zero
        // otherwise.
        outstandingBalanceAtCompletion: {
            type: Number,
            default: 0,
            min: 0,
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

            amount: {
                type: Number,
                required: true,
                min: 0,
            },
        },
        {
            _id: false,
        }
    );

const rentalExtensionSchema =
    new mongoose.Schema(
        {
            bookingExtensionId: {
                type: mongoose.Schema.Types.ObjectId,
                default: null,
            },

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

const rentalSchema = new mongoose.Schema(
    {
        rentalCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Booking",
            required: true,
            unique: true,
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

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
        },

        bookingPeriod: {
            type: bookingPeriodSchema,
            required: true,
        },

        status: {
            type: String,
            enum: RENTAL_STATUS_VALUES,
            default: RENTAL_STATUS.ONGOING,
            trim: true,
        },

        pickup: {
            type: inspectionSchema,
            default: () => ({}),
        },

        return: {
            type: inspectionSchema,
            default: () => ({}),
        },

        damageIssues: {
            type: [damageIssueSchema],
            default: [],
        },

        lateReturn: {
            type: lateReturnSchema,
            default: () => ({}),
        },

        earlyReturn: {
            type: earlyReturnSchema,
            default: () => ({}),
        },

        penaltyHistory: {
            type: [penaltyHistorySchema],
            default: [],
        },

        extensions: {
            type: [rentalExtensionSchema],
            default: [],
        },

        actualEndDate: {
            type: Date,
            default: null,
        },

        noShow: {
            type: noShowSchema,
            default: () => ({}),
        },

        charges: {
            type: [chargeSchema],
            default: [],
        },

        adjustments: {
            type: [adjustmentSchema],
            default: [],
        },

        payments: {
            type: [paymentSchema],
            default: [],
        },

        securityDeposit: {
            type: securityDepositSchema,
            default: () => ({}),
        },

        refunds: {
            type: [refundSchema],
            default: [],
        },

        financial: {
            type: financialSchema,
            required: true,
        },

        vehicleOutcome: {
            type: String,
            enum: RENTAL_VEHICLE_OUTCOME_VALUES,
            default: null,
            trim: true,
        },

        // With a Maintenance outcome: what was chosen (see Vehicle.maintenance).
        maintenancePlan: {
            mode: { type: String, default: null },
            days: { type: Number, default: null, min: 0 },
            reason: { type: String, default: "", trim: true },
        },

        driverReassignments: {
            type: [driverReassignmentSchema],
            default: [],
        },

        operationalEvents: {
            type: [operationalEventSchema],
            default: [],
        },

        completion: {
            type: completionSchema,
            default: () => ({}),
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

rentalSchema.index({
    customer: 1,
});

rentalSchema.index({
    vehicle: 1,
});

rentalSchema.index({
    driver: 1,
});

rentalSchema.index({
    status: 1,
});

rentalSchema.index({
    customer: 1,
    status: 1,
});

rentalSchema.index({
    vehicle: 1,
    status: 1,
});

rentalSchema.index({
    "bookingPeriod.originalStartDate": 1,
});

rentalSchema.index({
    "bookingPeriod.originalEndDate": 1,
});

rentalSchema.index({
    "pickup.date": 1,
});

rentalSchema.index({
    "return.date": 1,
});

rentalSchema.index({
    "earlyReturn.status": 1,
});

rentalSchema.index({
    createdAt: -1,
});

const Rental = mongoose.model(
    "Rental",
    rentalSchema
);

export default Rental;
