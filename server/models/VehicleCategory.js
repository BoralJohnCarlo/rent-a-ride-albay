import mongoose from "mongoose";

import {
    VEHICLE_TYPE_VALUES,
} from "../constants/vehicleConstants.js";

import {
    VEHICLE_CATEGORY_STATUS,
    VEHICLE_CATEGORY_STATUS_VALUES,
} from "../constants/vehicleCategoryConstants.js";

const imageSchema = new mongoose.Schema(
    {
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
    },
    {
        _id: false,
    }
);

const presentationSchema = new mongoose.Schema(
    {
        icon: {
            type: String,
            default: "",
            trim: true,
            maxlength: 50,
        },

        color: {
            type: String,
            default: "",
            trim: true,
            maxlength: 30,
        },

        image: {
            type: imageSchema,
            default: undefined,
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

const vehicleCategorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 100,
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            maxlength: 120,
        },

        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },

        vehicleType: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: VEHICLE_CATEGORY_STATUS_VALUES,
            default: VEHICLE_CATEGORY_STATUS.ACTIVE,
            trim: true,
        },

        displayOrder: {
            type: Number,
            default: 0,
            min: 0,
        },

        presentation: {
            type: presentationSchema,
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

vehicleCategorySchema.index({
    vehicleType: 1,
});

vehicleCategorySchema.index({
    status: 1,
});

vehicleCategorySchema.index({
    displayOrder: 1,
});

vehicleCategorySchema.index({
    vehicleType: 1,
    status: 1,
    displayOrder: 1,
});

const VehicleCategory = mongoose.model(
    "VehicleCategory",
    vehicleCategorySchema
);

export default VehicleCategory;