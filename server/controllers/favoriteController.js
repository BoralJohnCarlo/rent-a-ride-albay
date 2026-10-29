import { validationResult } from "express-validator";

import {
    getFavoriteVehicles,
    toggleFavorite,
    checkIsFavorited,
} from "../services/favoriteService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const getFavorites = async (req, res) => {
    try {
        const vehicles = await getFavoriteVehicles(req.user._id);

        return successResponse(
            res,
            "Favorites retrieved successfully.",
            vehicles
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const toggleVehicleFavorite = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const { vehicleId } = req.params;

        const result = await toggleFavorite(req.user._id, vehicleId);

        return successResponse(
            res,
            result.message,
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const checkFavorite = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const { vehicleId } = req.params;

        const isFavorited = await checkIsFavorited(req.user._id, vehicleId);

        return successResponse(
            res,
            "Favorite status retrieved successfully.",
            { isFavorited }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
