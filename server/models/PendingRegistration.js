import mongoose from "mongoose";

const pendingRegistrationSchema =
    new mongoose.Schema(
        {
            firstName: {
                type: String,
                required: true,
                trim: true,
            },

            lastName: {
                type: String,
                required: true,
                trim: true,
            },

            email: {
                type: String,
                required: true,
                unique: true,
                lowercase: true,
                trim: true,
            },

            password: {
                type: String,
                required: true,
                minlength: 8,
                select: false,
            },

            phoneNumber: {
                type: String,
                required: true,
                trim: true,
            },

            alternativeContact: {
                type: String,
                default: "",
                trim: true,
            },

            middleName: {
                type: String,
                default: "",
                trim: true,
            },

            birthdate: {
                type: Date,
                default: null,
            },

            validIdType: {
                type: String,
                default: "",
                trim: true,
            },

            validIdImage: {
                type: String,
                default: "",
                trim: true,
            },

validIdBack: {
            type: String,
            default: "",
            trim: true,
        },

        proofOfBillingImage: {
            type: String,
            default: "",
            trim: true,
        },

        licenseNumber: {
            type: String,
            default: "",
            trim: true,
        },

        licenseExpirationDate: {
            type: Date,
            default: null,
        },

        hasDriversLicense: {
            type: Boolean,
            default: null,
        },

        licenseCodes: [{
            type: String,
            default: "",
            trim: true,
        }],

        currentAddress: {
            houseUnitLot: {
                type: String,
                default: "",
                trim: true,
            },
            region: {
                type: String,
                default: "",
                trim: true,
            },
            street: {
                type: String,
                default: "",
                trim: true,
            },
            barangay: {
                type: String,
                default: "",
                trim: true,
            },
            cityMunicipality: {
                type: String,
                default: "",
                trim: true,
            },
            province: {
                type: String,
                default: "",
                trim: true,
            },
            postalCode: {
                type: String,
                default: "",
                trim: true,
            },
        },

        inspectionDate: {
            type: Date,
            default: null,
        },

        // The booked slot as plain strings, so it holds capacity until the
        // email is verified (or this record expires).
        inspectionSlot: {
            date: { type: String, default: "" },
            time: { type: String, default: "" },
        },

        termsAgreed: {
            type: Boolean,
            default: false,
        },

        // The Terms & Conditions version accepted (Settings → Terms &
        // Policies), copied to the User on verification.
        termsDocument: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "LegalDocument",
            default: null,
        },

        termsVersion: {
            type: Number,
            default: null,
        },

        temporaryUploadIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "TemporaryValidIdUpload",
        }],

        // Vehicle data (stored temporarily until email verification)
        vehicleData: {
            vehicleType: {
                type: String,
                trim: true,
                default: "",
            },
            brand: {
                type: String,
                trim: true,
                default: "",
            },
            model: {
                type: String,
                trim: true,
                default: "",
            },
            year: {
                type: Number,
                default: null,
            },
            plateNumber: {
                type: String,
                trim: true,
                default: "",
            },
            registrationNumber: {
                type: String,
                trim: true,
                default: "",
            },
            images: [{
                url: {
                    type: String,
                    trim: true,
                    default: "",
                },
                publicId: {
                    type: String,
                    trim: true,
                    default: "",
                },
                originalName: {
                    type: String,
                    trim: true,
                    default: "",
                },
            }],
            specifications: {
                transmission: {
                    type: String,
                    trim: true,
                    default: "",
                },
                fuelType: {
                    type: String,
                    trim: true,
                    default: "",
                },
                seatingCapacity: {
                    type: Number,
                    default: null,
                },
            },
            pricing: {
                dailyRate: {
                    type: Number,
                    default: null,
                },
                reservationFee: {
                    type: Number,
                    default: null,
                },
                securityDeposit: {
                    enabled: {
                        type: Boolean,
                        default: false,
                    },
                    amount: {
                        type: Number,
                        default: 0,
                    },
                },
            },
            description: {
                public: {
                    type: String,
                    trim: true,
                    default: "",
                },
            },
            availability: {
                bookingEnabled: {
                    type: Boolean,
                    default: true,
                },
                availableFrom: {
                    type: Date,
                    default: null,
                },
            },
            compliance: {
                licenseExpiration: {
                    type: Date,
                    default: null,
                },
                registrationNumberVerified: {
                    type: Boolean,
                    default: false,
                },
            },
            gps: {
                deviceId: {
                    type: String,
                    trim: true,
                    default: "",
                },
            },
            condition: {
                type: String,
                trim: true,
                default: "",
            },
            isFeatured: {
                type: Boolean,
                default: false,
            },
        },

        emailVerificationToken: {
                type: String,
                default: null,
                select: false,
            },

            emailVerificationExpires: {
                type: Date,
                default: null,
                select: false,
            },

            role: {
                type: String,
                enum: ["admin", "customer", "operator"],
                default: "customer",
            },

            // Wrong codes entered for the current code; past the limit the
            // code stops working and a new one must be requested.
            verificationAttempts: {
                type: Number,
                default: 0,
            },

            // Resend limits (per registration, not per IP): how many codes
            // were sent and when the last went out. `registrationStartedAt`
            // caps how long resends can keep the registration alive.
            codesSent: {
                type: Number,
                default: 0,
            },

            lastCodeSentAt: {
                type: Date,
                default: null,
            },

            registrationStartedAt: {
                type: Date,
                default: null,
            },

            // When the terms/privacy consent was given for this submission.
            termsAcceptedAt: {
                type: Date,
                default: null,
            },

            // Caps how many unverified partner registrations (each holding
            // an inspection slot) one IP can have at once.
            registrationIp: {
                type: String,
                default: "",
            },
        },
        {
            timestamps: true,
        }
    );

pendingRegistrationSchema.index(
    {
        emailVerificationExpires: 1,
    },
    {
        expireAfterSeconds: 0,
    }
);

const PendingRegistration = mongoose.model(
    "PendingRegistration",
    pendingRegistrationSchema
);

export default PendingRegistration;
