import { body, param, query } from "express-validator";

import {
    TELEMETRY_HISTORY_MAX_RANGE_MS,
    TELEMETRY_MAX_FUTURE_SKEW_MS,
} from "../constants/telemetryConstants.js";
import { isTimestampTooFarInFuture } from "../services/telemetryNormalizationService.js";

export const ingestTelemetryValidator = [
    body("latitude")
        .notEmpty()
        .withMessage("Latitude is required.")
        .isFloat({ min: -90, max: 90 })
        .withMessage("Latitude must be between -90 and 90."),

    body("longitude")
        .notEmpty()
        .withMessage("Longitude is required.")
        .isFloat({ min: -180, max: 180 })
        .withMessage("Longitude must be between -180 and 180."),

    body("speed")
        .optional({ nullable: true })
        .isFloat({ min: 0 })
        .withMessage("Speed must be a non-negative number."),

    body("heading")
        .optional({ nullable: true })
        .isFloat({ min: 0, max: 360 })
        .withMessage("Heading must be between 0 and 360."),

    body("ignition")
        .optional({ nullable: true })
        .isBoolean()
        .withMessage("Ignition must be a boolean."),

    body("batteryLevel")
        .optional({ nullable: true })
        .isFloat({ min: 0, max: 100 })
        .withMessage("Battery level must be between 0 and 100."),

    // Omitted/null means "unknown" (see telemetryNormalizationService.js).
    body("gpsFix")
        .optional({ nullable: true })
        .isBoolean()
        .withMessage("gpsFix must be a boolean."),

    body("recordedAt")
        .optional()
        .isISO8601()
        .withMessage("recordedAt must be a valid ISO 8601 date.")
        .bail()
        .custom((value) => !isTimestampTooFarInFuture(value))
        .withMessage(
            `recordedAt cannot be more than ${TELEMETRY_MAX_FUTURE_SKEW_MS / (60 * 1000)} minutes in the future.`
        ),
];

export const vehicleIdParamValidator = [
    param("vehicleId")
        .trim()
        .notEmpty()
        .withMessage("Vehicle ID is required.")
        .isMongoId()
        .withMessage("Invalid vehicle ID."),
];

export const vehicleHistoryValidator = [
    ...vehicleIdParamValidator,

    query("start")
        .optional()
        .isISO8601()
        .withMessage("start must be a valid ISO 8601 date."),

    query("end")
        .optional()
        .isISO8601()
        .withMessage("end must be a valid ISO 8601 date.")
        .custom((value, { req }) => {
            if (!req.query.start) {
                return true;
            }

            const startDate = new Date(req.query.start);
            const endDate = new Date(value);

            if (startDate >= endDate) {
                throw new Error("start must be before end.");
            }

            if (
                endDate.getTime() - startDate.getTime() >
                TELEMETRY_HISTORY_MAX_RANGE_MS
            ) {
                throw new Error(
                    `Date range cannot exceed ${TELEMETRY_HISTORY_MAX_RANGE_MS / (60 * 60 * 1000)} hours.`
                );
            }

            return true;
        }),
];
