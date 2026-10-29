import mongoose from "mongoose";

import {
    REVIEW_RATING_VALUES,
} from "../constants/rentalConstants.js";

const reviewSchema = new mongoose.Schema(
    {
        rental: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rental",
            required: true,
            unique: true,
            index: true,
        },

        customer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        vehicle: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vehicle",
            required: true,
            index: true,
        },

        driver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Driver",
            default: null,
            index: true,
        },

        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },

        comment: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        image: {
            type: String,
            default: null,
        },

        driverRating: {
            type: Number,
            min: 1,
            max: 5,
            default: null,
        },

        driverComment: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },

        driverImage: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

reviewSchema.index({ vehicle: 1, createdAt: -1 });
reviewSchema.index({ driver: 1, createdAt: -1 });
reviewSchema.index({ customer: 1, createdAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
