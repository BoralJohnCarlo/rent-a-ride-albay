import { body, param } from "express-validator";

import {
    VEHICLE_TYPE_VALUES,
} from "../constants/vehicleConstants.js";

import {
    VEHICLE_CATEGORY_STATUS_VALUES,
} from "../constants/vehicleCategoryConstants.js";

export const vehicleCategoryIdValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid vehicle category ID."),
];

export const createVehicleCategoryValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Category name is required.")
        .isLength({
            max: 100,
        })
        .withMessage("Category name cannot exceed 100 characters."),

    body("description")
        .optional()
        .trim()
        .isLength({
            max: 500,
        })
        .withMessage("Description cannot exceed 500 characters."),

    body("vehicleType")
        .trim()
        .notEmpty()
        .withMessage("Vehicle type is required.")
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage("Invalid vehicle type."),

    body("status")
        .optional()
        .trim()
        .isIn(VEHICLE_CATEGORY_STATUS_VALUES)
        .withMessage("Invalid vehicle category status."),

    body("displayOrder")
        .optional()
        .isInt({
            min: 0,
        })
        .withMessage("Display order must be a non-negative integer."),

    body("presentation.icon")
        .optional()
        .trim()
        .isLength({
            max: 50,
        })
        .withMessage("Icon cannot exceed 50 characters."),

    body("presentation.color")
        .optional()
        .trim()
        .isLength({
            max: 30,
        })
        .withMessage("Color cannot exceed 30 characters."),

    body("presentation.image.url")
        .optional()
        .trim()
        .isURL()
        .withMessage("Invalid image URL."),

    body("presentation.image.publicId")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Image public ID is required."),
];

export const updateVehicleCategoryValidator = [
    vehicleCategoryIdValidator,

    body("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Category name cannot be empty.")
        .isLength({
            max: 100,
        })
        .withMessage("Category name cannot exceed 100 characters."),

    body("description")
        .optional()
        .trim()
        .isLength({
            max: 500,
        })
        .withMessage("Description cannot exceed 500 characters."),

    body("vehicleType")
        .optional()
        .trim()
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage("Invalid vehicle type."),

    body("status")
        .optional()
        .trim()
        .isIn(VEHICLE_CATEGORY_STATUS_VALUES)
        .withMessage("Invalid vehicle category status."),

    body("displayOrder")
        .optional()
        .isInt({
            min: 0,
        })
        .withMessage("Display order must be a non-negative integer."),

    body("presentation.icon")
        .optional()
        .trim()
        .isLength({
            max: 50,
        })
        .withMessage("Icon cannot exceed 50 characters."),

    body("presentation.color")
        .optional()
        .trim()
        .isLength({
            max: 30,
        })
        .withMessage("Color cannot exceed 30 characters."),

    body("presentation.image.url")
        .optional()
        .trim()
        .isURL()
        .withMessage("Invalid image URL."),

    body("presentation.image.publicId")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Image public ID is required."),
];

export const updateVehicleCategoryStatusValidator = [
    vehicleCategoryIdValidator,

    body("status")
        .trim()
        .notEmpty()
        .withMessage("Status is required.")
        .isIn(VEHICLE_CATEGORY_STATUS_VALUES)
        .withMessage("Invalid vehicle category status."),
];