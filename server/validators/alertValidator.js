import { param, query } from "express-validator";

import {
    ALERT_TYPE_VALUES,
    ALERT_STATUS_VALUES,
} from "../constants/alertConstants.js";

export const alertIdValidator = [
    param("id")
        .trim()
        .notEmpty()
        .withMessage("Alert ID is required.")
        .isMongoId()
        .withMessage("Invalid alert ID."),
];

export const listAlertsValidator = [
    query("status")
        .optional()
        .isIn(ALERT_STATUS_VALUES)
        .withMessage("Invalid alert status."),

    query("type")
        .optional()
        .isIn(ALERT_TYPE_VALUES)
        .withMessage("Invalid alert type."),

    query("vehicle")
        .optional()
        .isMongoId()
        .withMessage("Invalid vehicle ID."),

    query("start")
        .optional()
        .isISO8601()
        .withMessage("Invalid start date."),

    query("end")
        .optional()
        .isISO8601()
        .withMessage("Invalid end date."),
];
