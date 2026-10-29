import { body, param } from "express-validator";

export const serviceLocationIdValidator = [
    param("id")
        .trim()
        .notEmpty()
        .withMessage(
            "Service location ID is required."
        )
        .isMongoId()
        .withMessage("Invalid service location ID."),
];

export const createServiceLocationValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Name is required."),

    body("region")
        .trim()
        .notEmpty()
        .withMessage("Region is required."),

    body("province")
        .trim()
        .notEmpty()
        .withMessage(
            "Province is required."
        ),

    body("city")
        .trim()
        .notEmpty()
        .withMessage("City is required."),

    body("barangay")
        .optional()
        .trim(),

    body("address")
        .optional()
        .trim(),

    body("latitude")
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage(
            "Latitude must be between -90 and 90."
        ),

    body("longitude")
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage(
            "Longitude must be between -180 and 180."
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

    body("isDefault")
        .optional()
        .isBoolean()
        .withMessage(
            "isDefault must be a boolean."
        ),

    body("enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "enabled must be a boolean."
        ),
];

export const updateServiceLocationValidator = [
    ...serviceLocationIdValidator,

    body("name")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("Name cannot be empty."),

    body("region")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Region cannot be empty."
        ),

    body("province")
        .optional()
        .trim()
        .notEmpty()
        .withMessage(
            "Province cannot be empty."
        ),

    body("city")
        .optional()
        .trim()
        .notEmpty()
        .withMessage("City cannot be empty."),

    body("barangay")
        .optional()
        .trim(),

    body("address")
        .optional()
        .trim(),

    body("latitude")
        .optional()
        .isFloat({ min: -90, max: 90 })
        .withMessage(
            "Latitude must be between -90 and 90."
        ),

    body("longitude")
        .optional()
        .isFloat({ min: -180, max: 180 })
        .withMessage(
            "Longitude must be between -180 and 180."
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

    body("isDefault")
        .optional()
        .isBoolean()
        .withMessage(
            "isDefault must be a boolean."
        ),

    body("enabled")
        .optional()
        .isBoolean()
        .withMessage(
            "enabled must be a boolean."
        ),
];
