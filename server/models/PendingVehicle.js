import mongoose from "mongoose";

const contactSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["phone", "email"],
            default: "phone",
        },
        value: {
            type: String,
            trim: true,
        },
    },
    { _id: false }
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
    { _id: false }
);

const pricingSchema = new mongoose.Schema(
    {
        dailyRate: {
            type: Number,
            default: null,
            min: 0,
        },
        reservationFee: {
            type: Number,
            default: null,
            min: 0,
        },
        securityDeposit: {
            type: securityDepositSchema,
            default: () => ({}),
        },
    },
    { _id: false }
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
    },
    { _id: false }
);

const gpsSchema = new mongoose.Schema(
    {
        deviceId: {
            type: String,
            default: "",
            trim: true,
        },
    },
    { _id: false }
);

const availabilitySchema = new mongoose.Schema(
    {
        bookingEnabled: {
            type: Boolean,
            default: true,
        },
        availableFrom: {
            type: Date,
            default: null,
        },
        blockedDates: {
            type: [{
                date: Date,
                reason: { type: String, default: "" }
            }],
            default: [],
        },
    },
    { _id: false }
);

const documentsSchema = new mongoose.Schema(
    {
        officialReceipt: [{
            url: { type: String, default: "" },
            publicId: { type: String, default: "" },
            originalName: { type: String, default: "" },
        }],
        certificateOfRegistration: [{
            url: { type: String, default: "" },
            publicId: { type: String, default: "" },
            originalName: { type: String, default: "" },
        }],
    },
    { _id: false }
);

const pendingVehicleSchema = new mongoose.Schema(
    {
        vehicleType: {
            type: String,
            enum: ["Car", "Motorcycle"],
            required: true,
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
            default: null,
        },

        plateNumber: {
            type: String,
            required: true,
            trim: true,
        },

        registrationNumber: {
            type: String,
            default: "",
            trim: true,
        },

        images: [{
            url: { type: String, required: true },
            publicId: { type: String, default: "" },
            originalName: { type: String, default: "" },
            isPrimary: { type: Boolean, default: false }
        }],

        documents: {
            type: documentsSchema,
            default: () => ({}),
        },

        specifications: {
            transmission: {
                type: String,
                enum: ["Automatic", "Manual", "CVT"],
                required: true,
            },
            fuelType: {
                type: String,
                enum: ["Gasoline", "Diesel", "Hybrid", "Electric"],
                required: true,
            },
            engine: {
                type: String,
                default: "",
            },
            seatingCapacity: {
                type: Number,
                required: true,
                min: 1,
            },
        },

        pricing: {
            type: pricingSchema,
            default: () => ({}),
        },

        description: {
            public: {
                type: String,
                default: "",
            },
        },

        availability: {
            type: availabilitySchema,
            default: () => ({}),
        },

        compliance: {
            type: complianceSchema,
            default: () => ({}),
        },

        gps: {
            type: gpsSchema,
            default: () => ({}),
        },

        condition: {
            type: String,
            enum: ["Excellent", "Good", "Fair", "Needs Maintenance"],
            default: "Good",
        },

        isFeatured: {
            type: Boolean,
            default: false,
        },

        // References
        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Metadata
        status: {
            type: String,
            enum: ["pending_review", "under_inspection", "approved", "rejected"],
            default: "pending_review",
        },

        isPendingInspection: {
            type: Boolean,
            default: true,
        },

        // The inspection slot the partner booked at registration
        // ("YYYY-MM-DD" / "HH:mm", same shape as Consignment's).
        inspection: {
            scheduledDate: { type: String, default: "" },
            scheduledTime: { type: String, default: "" },
        },

        rejectionReason: {
            type: String,
            default: "",
        },

        rejectionDetails: {
            type: String,
            default: "",
        },
    },
    {
        timestamps: true,
    }
);

pendingVehicleSchema.index({ plateNumber: 1 });
pendingVehicleSchema.index({ registrationNumber: 1 });
pendingVehicleSchema.index({ operator: 1 });
pendingVehicleSchema.index({ status: 1 });
pendingVehicleSchema.index({ createdAt: 1 });

const PendingVehicle = mongoose.model(
    "PendingVehicle",
    pendingVehicleSchema
);

export default PendingVehicle;