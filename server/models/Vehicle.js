import mongoose from "mongoose";

import {
    VEHICLE_STATUS,
    VEHICLE_STATUS_VALUES,
    VEHICLE_TYPE_VALUES,
    VEHICLE_CONDITIONS,
    VEHICLE_CONDITION_VALUES,
    TRANSMISSION_TYPE_VALUES,
    FUEL_TYPE_VALUES,
    VEHICLE_OWNERSHIP,
    VEHICLE_OWNERSHIP_VALUES,
    MAX_VEHICLE_IMAGES,
    VEHICLE_MAINTENANCE_MODE_VALUES,
} from "../constants/vehicleConstants.js";

/*
 * The current maintenance window, if any (see VEHICLE_MAINTENANCE_MODE). Only
 * [startedAt, until) is unbookable — until null meaning no end date (off
 * road) — and the vehicle stays listed. Set as soon as the return outcome is
 * saved, so the window holds even while the rental awaits completion; the
 * Maintenance status itself follows on completion (or straight away when an
 * admin sets it from the vehicle). See utils/vehicleMaintenance.js.
 */
const maintenanceSchema = new mongoose.Schema(
    {
        mode: {
            type: String,
            enum: [...VEHICLE_MAINTENANCE_MODE_VALUES, null],
            default: null,
        },

        startedAt: {
            type: Date,
            default: null,
        },

        until: {
            type: Date,
            default: null,
        },

        // Extended mode: the number of days chosen (for display).
        days: {
            type: Number,
            default: null,
            min: 0,
        },

        // Admin-only note; never shown to customers.
        reason: {
            type: String,
            default: "",
            trim: true,
        },

        setBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        setAt: {
            type: Date,
            default: null,
        },

        // The rental whose return outcome set it, if any.
        rental: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rental",
            default: null,
        },
    },
    {
        _id: false,
    }
);

const specificationSchema = new mongoose.Schema(
    {
        transmission: {
            type: String,
            enum: TRANSMISSION_TYPE_VALUES,
            required: true,
            trim: true,
        },

        fuelType: {
            type: String,
            enum: FUEL_TYPE_VALUES,
            required: true,
            trim: true,
        },

        engine: {
            type: String,
            default: "",
            trim: true,
        },

        seatingCapacity: {
            type: String,
            required: true,
            min: 1,
        },
    },
    {
        _id: false,
    }
);

const pricingSchema = new mongoose.Schema(
    {
        dailyRate: {
            type: Number,
            required: true,
            min: 0,
        },

        reservationFee: {
            type: Number,
            required: true,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

const commissionSchema = new mongoose.Schema(
    {
        mode: {
            type: String,
            enum: ["PERCENTAGE", "FIXED"],
            default: null,
        },

        value: {
            type: Number,
            default: null,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

const securityDepositSchema = new mongoose.Schema(
    {
        enabled: {
            type: Boolean,
            default: false,
        },

        amount: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    {
        _id: false,
    }
);

const descriptionSchema = new mongoose.Schema(
    {
        public: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const blockedDateSchema = new mongoose.Schema(
    {
        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
            validate: {
                validator(value) {
                    return (
                        !this.startDate ||
                        value >= this.startDate
                    );
                },
                message:
                    "End date must be on or after the start date.",
            },
        },

        reason: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: true,
    }
);

const availabilitySchema = new mongoose.Schema(
    {
        bookingEnabled: {
            type: Boolean,
            default: true,
        },

        /*
         * Set alongside bookingEnabled=false only when THIS vehicle was
         * turned off because its operator got suspended (see
         * setOperatorVehiclesBookable in vehicleService.js) — distinct from
         * an operator/admin independently disabling booking for their own
         * reason. On unsuspend, only vehicles carrying this flag are turned
         * back on, so one that was already off before the suspension stays
         * off afterward instead of being silently re-enabled.
         */
        disabledForSuspension: {
            type: Boolean,
            default: false,
        },

        availableFrom: {
            type: Date,
            default: null,
        },

        blockedDates: {
            type: [blockedDateSchema],
            default: [],
        },
    },
    {
        _id: false,
    }
);

const complianceSchema = new mongoose.Schema(
    {
        licenseExpiration: {
            type: Date,
            default: null,
        },

        registrationNumberVerified: {
            type: Boolean,
            default: false,
        },

        /*
         * Tracks the operator's registration-renewal attempts against
         * Settings.vehicleRegistrationRenewalSettings — reset once
         * lastRegistrationRenewalAt is old enough per the configured
         * period. Admin renewals don't touch or check this at all.
         */
        registrationRenewalCount: {
            type: Number,
            default: 0,
        },

        lastRegistrationRenewalAt: {
            type: Date,
            default: null,
        },
    },
    {
        _id: false,
    }
);
const imageSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        trim: true,
    },

    publicId: {
        type: String,
        required: true,
        trim: true,
    },

    originalName: {
        type: String,
        default: "",
        trim: true,
    },

    isPrimary: {
        type: Boolean,
        default: false,
    },
});

const documentSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
        trim: true,
    },

    publicId: {
        type: String,
        required: true,
        trim: true,
    },

    originalName: {
        type: String,
        default: "",
        trim: true,
    },
});

/*
 * Append-only log of every OR/CR ever attached to this vehicle — the
 * current officialReceipt/certificateOfRegistration below always mirrors
 * the newest entry of its type here, but superseded ones (e.g. an OR
 * replaced during registration renewal) stay recorded instead of being
 * discarded, so the "Documents" view can show a full upload history.
 */
const documentHistoryEntrySchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: [
                "officialReceipt",
                "certificateOfRegistration",
            ],
            required: true,
        },

        url: {
            type: String,
            required: true,
            trim: true,
        },

        publicId: {
            type: String,
            required: true,
            trim: true,
        },

        originalName: {
            type: String,
            default: "",
            trim: true,
        },

        uploadedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);

const gpsSchema = new mongoose.Schema(
    {
        deviceId: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        _id: false,
    }
);

const archiveSchema = new mongoose.Schema(
    {
        archivedAt: {
            type: Date,
            default: null,
        },

        archivedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        archiveReason: {
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
const vehicleSchema = new mongoose.Schema(
    {
        vehicleCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        plateNumber: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },

        registrationNumber: {
            type: String,
            default: "",
            uppercase: true,
            trim: true,
        },

        brand: {
            type: String,
            required: true,
            trim: true,
        },

        model: {
            type: String,
            required: true,
            trim: true,
        },

        variant: {
            type: String,
            default: "",
            trim: true,
        },

        year: {
            type: Number,
            required: true,
            min: 1900,
            max: new Date().getFullYear() + 1,
        },

        vehicleType: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: true,
            trim: true,
        },

        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "VehicleCategory",
            default: null,
        },

        specifications: {
            type: specificationSchema,
            required: true,
        },

        pricing: {
            type: pricingSchema,
            required: true,
        },

        /*
         * Individually-negotiated payout override for this vehicle's
         * partner, optionally set once at consignment approval time (the
         * admin decides per-vehicle whether to give it one) and kept for
         * the vehicle's lifetime after that. When mode is null, payouts
         * fall back to the platform-wide default commission rate.
         */
        commission: {
            type: commissionSchema,
            default: () => ({}),
        },

        securityDeposit: {
            type: securityDepositSchema,
            default: () => ({}),
        },

        description: {
            type: descriptionSchema,
            default: () => ({}),
        },

        availability: {
            type: availabilitySchema,
            default: () => ({}),
        },

        maintenance: {
            type: maintenanceSchema,
            default: () => ({}),
        },

        compliance: {
            type: complianceSchema,
            default: () => ({}),
        },

         images: {
             type: [imageSchema],
             default: [],
             validate: {
                 validator(images) {
                     return (
                         Array.isArray(images) &&
                         images.length <= MAX_VEHICLE_IMAGES
                     );
                 },
                 message: "A vehicle can only have up to 10 images.",
             },
         },

         documents: {
             officialReceipt: {
                 type: documentSchema,
                 default: null,
             },

             certificateOfRegistration: {
                 type: documentSchema,
                 default: null,
             },

             history: {
                 type: [documentHistoryEntrySchema],
                 default: [],
             },
         },

         status: {
            type: String,
            enum: VEHICLE_STATUS_VALUES,
            default: VEHICLE_STATUS.AVAILABLE,
            trim: true,
        },

        condition: {
            type: String,
            enum: VEHICLE_CONDITION_VALUES,
            default: VEHICLE_CONDITIONS.EXCELLENT,
            trim: true,
        },

        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        ownership: {
            type: String,
            enum: VEHICLE_OWNERSHIP_VALUES,
            default: VEHICLE_OWNERSHIP.COMPANY,
            trim: true,
        },

        gps: {
            type: gpsSchema,
            default: () => ({}),
        },

        isFeatured: {
            type: Boolean,
            default: false,
        },

        isPendingInspection: {
            type: Boolean,
            default: false,
        },

        archive: {
            type: archiveSchema,
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
vehicleSchema.index({ brand: 1 });

vehicleSchema.index({
    brand: 1,
    model: 1,
    variant: 1,
});

vehicleSchema.index({ vehicleType: 1 });

vehicleSchema.index({ category: 1 });


vehicleSchema.index({ status: 1 });

vehicleSchema.index({ operator: 1 });

vehicleSchema.index({
    isFeatured: 1,
    status: 1,
});

const Vehicle = mongoose.model("Vehicle", vehicleSchema);

export default Vehicle;