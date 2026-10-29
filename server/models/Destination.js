import mongoose from "mongoose";

import { DESTINATION_CATEGORIES } from "../constants/destinationConstants.js";
import { VEHICLE_TYPE_VALUES } from "../constants/vehicleConstants.js";

/*
 * A place on the public Explore Albay page (/explore), managed by admins in
 * Settings → Destinations. `rideType` is a Vehicle.vehicleType, and becomes
 * the /available?type= filter on the destination's "Find a ride" button.
 */
const destinationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },

        town: {
            type: String,
            default: "",
            trim: true,
            maxlength: 120,
        },

        category: {
            type: String,
            enum: DESTINATION_CATEGORIES,
            default: "nature",
        },

        blurb: {
            type: String,
            required: true,
            trim: true,
            maxlength: 400,
        },

        // Trip facts — free text, e.g. "30–60 min", "Paved, steep".
        driveTime: {
            type: String,
            default: "",
            trim: true,
            maxlength: 40,
        },

        road: {
            type: String,
            default: "",
            trim: true,
            maxlength: 80,
        },

        bestTime: {
            type: String,
            default: "",
            trim: true,
            maxlength: 80,
        },

        rideType: {
            type: String,
            enum: VEHICLE_TYPE_VALUES,
            default: "Car",
        },

        rideNote: {
            type: String,
            default: "",
            trim: true,
            maxlength: 200,
        },

        // Photo URL (Cloudinary). Empty → a category-tinted placeholder.
        image: {
            type: String,
            default: "",
        },

        // One of the (up to 3) thumbnails in the home hero's Albay widget.
        featuredInHero: {
            type: Boolean,
            default: false,
        },

        isActive: {
            type: Boolean,
            default: true,
        },

        displayOrder: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

destinationSchema.index({ isActive: 1, displayOrder: 1, createdAt: 1 });

const Destination = mongoose.model("Destination", destinationSchema);

export default Destination;
