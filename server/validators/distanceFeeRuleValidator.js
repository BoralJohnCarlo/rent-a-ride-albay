import { body, param, query } from "express-validator";

export const distanceFeeRuleIdValidator = [
    param("id")
        .trim()
        .notEmpty()
        .withMessage(
            "Distance fee rule ID is required."
        )
        .isMongoId()
        .withMessage(
            "Invalid distance fee rule ID."
        ),
];

export const createDistanceFeeRuleValidator = [
    body("minDistanceKm")
        .notEmpty()
        .withMessage(
            "Minimum distance is required."
        )
        .isFloat({ min: 0 })
        .withMessage(
            "Minimum distance must be a non-negative number."
        ),

    body("maxDistanceKm")
        .notEmpty()
        .withMessage(
            "Maximum distance is required."
        )
        .isFloat({ min: 0 })
        .withMessage(
            "Maximum distance must be a non-negative number."
        ),

    body("pickupFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Pickup fee must be a non-negative number."
        ),

    body("returnFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Return fee must be a non-negative number."
        ),

    body("enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "Enabled must be a boolean."
        ),
];

export const updateDistanceFeeRuleValidator = [
    ...distanceFeeRuleIdValidator,

    body("minDistanceKm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Minimum distance must be a non-negative number."
        ),

    body("maxDistanceKm")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Maximum distance must be a non-negative number."
        ),

    body("pickupFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Pickup fee must be a non-negative number."
        ),

    body("returnFee")
        .optional()
        .isFloat({ min: 0 })
        .withMessage(
            "Return fee must be a non-negative number."
        ),

    body("enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "Enabled must be a boolean."
        ),
];
