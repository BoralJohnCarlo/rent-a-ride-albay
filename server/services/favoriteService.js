import createError from "../utils/createError.js";

import Favorite from "../models/Favorite.js";
import Vehicle from "../models/Vehicle.js";

import { attachVehicleRatings } from "./reviewService.js";

const getFavoriteVehicles = async (userId) => {
    const favorites = await Favorite.find({ user: userId })
        .populate("vehicle")
        .sort({ createdAt: -1 });

    const vehicles = favorites
        .map((fav) => fav.vehicle)
        .filter(Boolean);

    // Favorites cards show the same star rating as the browse page.
    return attachVehicleRatings(vehicles);
};

const toggleFavorite = async (userId, vehicleId) => {
    const existing = await Favorite.findOne({
        user: userId,
        vehicle: vehicleId,
    });

    if (existing) {
        await Favorite.findByIdAndDelete(existing._id);

        return {
            isFavorited: false,
            message: "Removed from favorites.",
        };
    }

    const favorite = await Favorite.create({
        user: userId,
        vehicle: vehicleId,
    });

    const populatedVehicle = await Vehicle.findById(
        vehicleId
    );

    const [vehicleWithRating = null] = populatedVehicle
        ? await attachVehicleRatings([populatedVehicle])
        : [];

    return {
        isFavorited: true,
        message: "Added to favorites.",
        vehicle: vehicleWithRating,
    };
};

const checkIsFavorited = async (userId, vehicleId) => {
    const favorite = await Favorite.findOne({
        user: userId,
        vehicle: vehicleId,
    });

    return !!favorite;
};

export {
    getFavoriteVehicles,
    toggleFavorite,
    checkIsFavorited,
};
