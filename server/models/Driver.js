import mongoose from "mongoose";

import {
    DRIVER_STATUS,
    DRIVER_STATUS_VALUES,
    DRIVER_AVAILABILITY,
    DRIVER_AVAILABILITY_VALUES,
    DRIVER_LICENSE_TYPE_VALUES,
    DRIVER_LICENSE_CODE_VALUES,
} from "../constants/driverConstants.js";

const driverSchema = new mongoose.Schema(
    {
        driverCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

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

        profileImage: {
            type: String,
            default: "",
            trim: true,
        },

        address: {
            // Same region → province → city → barangay chain as the other
            // address forms (client/src/data/philippineLocations.js).
            region: {
                type: String,
                default: "",
                trim: true,
            },

            province: {
                type: String,
                default: "",
                trim: true,
            },

            city: {
                type: String,
                default: "",
                trim: true,
            },

            barangay: {
                type: String,
                default: "",
                trim: true,
            },

            street: {
                type: String,
                default: "",
                trim: true,
            },
        },

        license: {
            licenseNumber: {
                type: String,
                required: true,
                unique: true,
                trim: true,
            },

            licenseType: {
                type: String,
                enum: DRIVER_LICENSE_TYPE_VALUES,
                required: true,
                trim: true,
            },

            expiryDate: {
                type: Date,
                required: true,
            },

            restrictionCodes: {
                type: [
                    {
                        type: String,
                        enum: DRIVER_LICENSE_CODE_VALUES,
                        trim: true,
                    },
                ],
                default: [],
            },
        },

        uploadedDocuments: {
            driversLicense: {
                type: String,
                default: "",
                trim: true,
            },

            governmentId: {
                type: String,
                default: "",
                trim: true,
            },

            selfieVerification: {
                type: String,
                default: "",
                trim: true,
            },
        },

        emergencyContact: {
            name: {
                type: String,
                default: "",
                trim: true,
            },

            relationship: {
                type: String,
                default: "",
                trim: true,
            },

            phoneNumber: {
                type: String,
                default: "",
                trim: true,
            },
        },

        /*
         * This driver's own price per rental day, used only while the
         * driver pricing mode (Settings.driverPricingSettings) is
         * "individual". Null means "use the global rate".
         */
        pricing: {
            dailyRate: {
                type: Number,
                default: null,
                min: 0,
            },
        },

        status: {
            type: String,
            enum: DRIVER_STATUS_VALUES,
            default: DRIVER_STATUS.ACTIVE,
        },

        availability: {
            type: String,
            enum: DRIVER_AVAILABILITY_VALUES,
            default: DRIVER_AVAILABILITY.AVAILABLE,
        },

        assignedBookings: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Booking",
            },
        ],

        schedule: {
            workingDays: {
                type: [String],
                default: [],
            },

            startTime: {
                type: String,
                default: "",
                trim: true,
            },

            endTime: {
                type: String,
                default: "",
                trim: true,
            },

            timezone: {
                type: String,
                default: "Asia/Manila",
                trim: true,
            },
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

        archive: {
            isArchived: {
                type: Boolean,
                default: false,
            },

            archivedAt: {
                type: Date,
                default: null,
            },

            archivedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            reason: {
                type: String,
                default: "",
                trim: true,
            },
        },
    },
    {
        timestamps: true,
    }
);

const Driver = mongoose.model(
    "Driver",
    driverSchema
);

export default Driver;