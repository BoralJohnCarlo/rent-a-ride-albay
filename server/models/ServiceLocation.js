import mongoose from "mongoose";

const serviceLocationSchema =
    new mongoose.Schema(
        {
            name: {
                type: String,
                required: true,
                trim: true,
            },

            region: {
                type: String,
                required: true,
                trim: true,
            },

            province: {
                type: String,
                required: true,
                trim: true,
            },

            city: {
                type: String,
                required: true,
                trim: true,
            },

            barangay: {
                type: String,
                trim: true,
            },

            address: {
                type: String,
                trim: true,
            },

            latitude: {
                type: Number,
                default: null,
            },

            longitude: {
                type: Number,
                default: null,
            },

            pickupFee: {
                type: Number,
                min: 0,
                default: 0,
            },

            returnFee: {
                type: Number,
                min: 0,
                default: 0,
            },

            isDefault: {
                type: Boolean,
                default: false,
            },

            enabled: {
                type: Boolean,
                default: true,
            },
        },
        {
            timestamps: true,
        }
    );

serviceLocationSchema.index(
    { enabled: 1, isDefault: -1 }
);

const ServiceLocation = mongoose.model(
    "ServiceLocation",
    serviceLocationSchema
);

export default ServiceLocation;
