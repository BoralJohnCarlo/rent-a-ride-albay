import { body, param } from "express-validator";

import { DESTINATION_CATEGORIES } from "../constants/destinationConstants.js";
import { VEHICLE_TYPE_VALUES } from "../constants/vehicleConstants.js";

export const destinationIdValidator = [
    param("id")
        .isMongoId()
        .withMessage("Invalid destination ID."),
];

const optionalText = (field, label, max) =>
    body(field)
        .optional()
        .isString()
        .withMessage(`${label} must be text.`)
        .trim()
        .isLength({ max })
        .withMessage(`${label} must be at most ${max} characters.`);

const requiredText = (field, label, max, required) =>
    (required
        ? body(field).exists({ values: "falsy" }).withMessage(`${label} is required.`)
        : body(field).optional()
    )
        .bail()
        .isString()
        .trim()
        .notEmpty()
        .withMessage(`${label} is required.`)
        .isLength({ max })
        .withMessage(`${label} must be at most ${max} characters.`);

const fields = (required) => [
    requiredText("name", "Name", 80, required),
    requiredText("blurb", "Description", 400, required),

    optionalText("town", "Town", 120),
    optionalText("driveTime", "Drive time", 40),
    optionalText("road", "Road", 80),
    optionalText("bestTime", "Best time", 80),
    optionalText("rideNote", "Ride note", 200),

    body("category")
        .optional()
        .isIn(DESTINATION_CATEGORIES)
        .withMessage(
            `Category must be one of: ${DESTINATION_CATEGORIES.join(", ")}.`
        ),

    body("rideType")
        .optional()
        .isIn(VEHICLE_TYPE_VALUES)
        .withMessage(
            `Ride type must be one of: ${VEHICLE_TYPE_VALUES.join(", ")}.`
        ),

    body("image")
        .optional({ values: "falsy" })
        .isString()
        .isLength({ max: 2048 })
        .withMessage("image must be a valid image URL."),

    body("featuredInHero")
        .optional()
        .isBoolean()
        .withMessage("featuredInHero must be true or false."),

    body("isActive")
        .optional()
        .isBoolean()
        .withMessage("isActive must be true or false."),

    body("displayOrder")
        .optional()
        .isInt()
        .withMessage("Display order must be a whole number."),
];

export const createDestinationValidator = fields(true);

export const updateDestinationValidator = [
    ...destinationIdValidator,
    ...fields(false),
];

export const reorderDestinationsValidator = [
    body("ids")
        .isArray({ min: 1 })
        .withMessage("ids must be a non-empty array."),
    body("ids.*")
        .isMongoId()
        .withMessage("Every id must be a valid destination ID."),
];
