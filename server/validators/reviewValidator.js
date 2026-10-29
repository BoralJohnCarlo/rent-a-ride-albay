import mongoose from "mongoose";
import { body, param } from "express-validator";

import {
    REVIEW_RATING_VALUES,
} from "../constants/rentalConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

export const rentalIdValidator = [
    param("rentalId")
        .notEmpty()
        .withMessage("Rental ID is required.")
        .isMongoId()
        .withMessage("Invalid rental ID."),
];

export const reviewIdValidator = [
    param("id")
        .notEmpty()
        .withMessage("Review ID is required.")
        .isMongoId()
        .withMessage("Invalid review ID."),
];

export const createReviewValidator = [
    param("id")
        .notEmpty()
        .withMessage("Rental or booking ID is required.")
        .isMongoId()
        .withMessage("Invalid rental or booking ID."),

    body("rating")
        .notEmpty()
        .withMessage("Rating is required.")
        .isInt()
        .withMessage("Rating must be an integer.")
        .custom(
            (value) =>
                REVIEW_RATING_VALUES.includes(
                    Number(value)
                )
        )
        .withMessage(
            "Rating must be between 1 and 5."
        ),

    body("comment")
        .optional()
        .isString()
        .withMessage(
            "Comment must be a string."
        )
        .trim()
        .isLength({
            max: 1000,
        })
        .withMessage(
            "Comment cannot exceed 1000 characters."
        ),

    body("driverId")
        .optional()
        .isMongoId()
        .withMessage("Invalid driver ID."),

    body("image")
        .optional({ nullable: true })
        .isString()
        .withMessage("Image must be a valid URL string."),

    body("driverRating")
        .optional()
        .isInt()
        .withMessage("Driver rating must be an integer.")
        .custom(
            (value) =>
                REVIEW_RATING_VALUES.includes(
                    Number(value)
                )
        )
        .withMessage(
            "Driver rating must be between 1 and 5."
        ),

    body("driverComment")
        .optional()
        .isString()
        .withMessage(
            "Driver comment must be a string."
        )
        .trim()
        .isLength({
            max: 1000,
        })
        .withMessage(
            "Driver comment cannot exceed 1000 characters."
        ),

    body("driverImage")
        .optional({ nullable: true })
        .isString()
        .withMessage("Driver image must be a valid URL string."),
];

export const vehicleIdValidator = [
    param("vehicleId")
        .notEmpty()
        .withMessage("Vehicle ID is required.")
        .isMongoId()
        .withMessage("Invalid vehicle ID."),
];

export const driverIdValidator = [
    param("driverId")
        .notEmpty()
        .withMessage("Driver ID is required.")
        .isMongoId()
        .withMessage("Invalid driver ID."),
];
