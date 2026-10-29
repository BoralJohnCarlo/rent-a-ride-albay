import {
    body,
    param,
} from "express-validator";

import mongoose from "mongoose";

import { AVAILABILITY_REQUEST_REASON_VALUES } from "../constants/vehicleAvailabilityRequestConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

const availabilityRequestIdValidator = [
    param("id")
        .custom(isValidObjectId)
        .withMessage("Invalid availability request ID."),
];

const createAvailabilityRequestValidator = [
    body("vehicleId")
        .custom(isValidObjectId)
        .withMessage("A valid vehicle ID is required."),

    body("dateRanges")
        .isArray({ min: 1 })
        .withMessage("At least one date range is required."),

    body("dateRanges.*.startDate")
        .notEmpty()
        .withMessage("Start date is required.")
        .isISO8601()
        .withMessage("Start date must be a valid date."),

    body("dateRanges.*.endDate")
        .notEmpty()
        .withMessage("End date is required.")
        .isISO8601()
        .withMessage("End date must be a valid date."),

    body("reason")
        .trim()
        .notEmpty()
        .withMessage("A reason is required.")
        .isIn(AVAILABILITY_REQUEST_REASON_VALUES)
        .withMessage("Invalid reason."),

    body("reasonDetails")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage(
            "Reason details cannot exceed 500 characters."
        ),

    body("reasonDetails")
        .if(body("reason").equals("Others"))
        .trim()
        .notEmpty()
        .withMessage(
            "Please describe the reason when selecting \"Others\"."
        ),
];

const rejectAvailabilityRequestValidator = [
    body("rejectionReason")
        .trim()
        .notEmpty()
        .withMessage("A rejection reason is required.")
        .isLength({ max: 500 })
        .withMessage(
            "Rejection reason cannot exceed 500 characters."
        ),
];

const approveAvailabilityRequestValidator = [
    body("remarks")
        .optional()
        .trim()
        .isLength({ max: 500 })
        .withMessage(
            "Approval remarks cannot exceed 500 characters."
        ),
];

export {
    availabilityRequestIdValidator,
    createAvailabilityRequestValidator,
    rejectAvailabilityRequestValidator,
    approveAvailabilityRequestValidator,
};
