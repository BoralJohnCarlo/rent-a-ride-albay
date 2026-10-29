import { validationResult } from "express-validator";

import {
    createReview,
    getReviewsByVehicle,
    getReviewsByDriver,
    getReviewByRental,
    getAllReviews,
    getVehicleAverageRating as getVehicleAverageRatingService,
    getDriverAverageRating as getDriverAverageRatingService,
} from "../services/reviewService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const handleValidation = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        errorResponse(
            res,
            "Validation failed.",
            400,
            errors.array()
        );

        return false;
    }

    return true;
};

export const create = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const review = await createReview(
            req.params.id,
            req.user._id,
            req.body
        );

        return successResponse(
            res,
            "Review submitted successfully.",
            review,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getVehicleReviews = async (
    req,
    res
) => {
    try {
        const reviews =
            await getReviewsByVehicle(
                req.params.vehicleId
            );

        return successResponse(
            res,
            "Vehicle reviews retrieved successfully.",
            reviews
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getDriverReviews = async (
    req,
    res
) => {
    try {
        const reviews =
            await getReviewsByDriver(
                req.params.driverId
            );

        return successResponse(
            res,
            "Driver reviews retrieved successfully.",
            reviews
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getVehicleAverageRating = async (
    req,
    res
) => {
    try {
        const rating =
            await getVehicleAverageRatingService(
                req.params.vehicleId
            );

        return successResponse(
            res,
            "Vehicle average rating retrieved successfully.",
            rating
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getDriverAverageRating = async (
    req,
    res
) => {
    try {
        const rating =
            await getDriverAverageRatingService(
                req.params.driverId
            );

        return successResponse(
            res,
            "Driver average rating retrieved successfully.",
            rating
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getRentalReview = async (
    req,
    res
) => {
    try {
        const review =
            await getReviewByRental(
                req.params.rentalId
            );

        return successResponse(
            res,
            "Review retrieved successfully.",
            review
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const uploadPhoto = async (req, res) => {
    try {
        return successResponse(
            res,
            "Review image uploaded successfully.",
            req.reviewImage,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAll = async (req, res) => {
    try {
        const reviews = await getAllReviews();

        return successResponse(
            res,
            "Reviews retrieved successfully.",
            reviews
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
