import { body, param } from "express-validator";

import {
    TRACKER_PROTOCOL_VALUES,
    TRACKER_NOTES_MAX_LENGTH,
} from "../constants/telemetryConstants.js";

export const trackerIdValidator = [
    param("id")
        .trim()
        .notEmpty()
        .withMessage("Tracker ID is required.")
        .isMongoId()
        .withMessage("Invalid tracker ID."),
];

const descriptiveFieldValidators = [
    body("model")
        .optional()
        .trim()
        .isLength({ max: 100 })
        .withMessage("Model cannot exceed 100 characters."),

    body("simNumber")
        .optional()
        .trim()
        .isLength({ max: 20 })
        .withMessage("SIM number cannot exceed 20 characters.")
        .bail()
        .matches(/^\+?[0-9\s-]*$/)
        .withMessage(
            "SIM number may only contain digits, spaces, dashes, and a leading +."
        ),

    body("notes")
        .optional()
        .trim()
        .isLength({ max: TRACKER_NOTES_MAX_LENGTH })
        .withMessage(
            `Notes cannot exceed ${TRACKER_NOTES_MAX_LENGTH} characters.`
        ),
];

// Status is only changed through assign/unassign/enable/disable, which keep
// it consistent with the assignment - never set directly.
const rejectStatus = body("status")
    .not()
    .exists()
    .withMessage(
        "Tracker status cannot be set directly. Use the enable/disable actions."
    );

export const createTrackerValidator = [
    body("imei")
        .trim()
        .notEmpty()
        .withMessage("Device ID / IMEI is required.")
        .isLength({ min: 5, max: 32 })
        .withMessage("Device ID / IMEI must be between 5 and 32 characters."),

    body("protocol")
        .optional()
        .isIn(TRACKER_PROTOCOL_VALUES)
        .withMessage("Unsupported tracker protocol."),

    ...descriptiveFieldValidators,

    body("vehicle")
        .optional({ values: "falsy" })
        .isMongoId()
        .withMessage("Invalid vehicle ID."),

    rejectStatus,
];

export const updateTrackerValidator = [
    ...trackerIdValidator,

    ...descriptiveFieldValidators,

    body("imei")
        .not()
        .exists()
        .withMessage("Device ID / IMEI cannot be changed after registration."),

    body("protocol")
        .not()
        .exists()
        .withMessage("Protocol cannot be changed after registration."),

    rejectStatus,
];

export const assignTrackerValidator = [
    ...trackerIdValidator,

    body("vehicle")
        .trim()
        .notEmpty()
        .withMessage("Vehicle ID is required.")
        .isMongoId()
        .withMessage("Invalid vehicle ID."),
];
