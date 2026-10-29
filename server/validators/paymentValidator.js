import mongoose from "mongoose";
import { body, param } from "express-validator";

import {
    PAYMENT_METHOD,
    PAYMENT_STATUS,
} from "../constants/paymentConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

const PAYMENT_METHOD_VALUES = Object.values(
    PAYMENT_METHOD
);

const PAYMENT_STATUS_VALUES = Object.values(
    PAYMENT_STATUS
);

export const paymentIdValidator = [
    param("paymentId")
        .custom(isValidObjectId)
        .withMessage("Invalid payment ID."),
];

export const createPaymentValidator = [
    body("bookingId")
        .custom(isValidObjectId)
        .withMessage("Invalid booking ID."),

    body("paymentMethod")
        .isString()
        .trim()
        .notEmpty()
        .withMessage("Payment method is required.")
        .isIn(PAYMENT_METHOD_VALUES)
        .withMessage("Invalid payment method."),
];

export const verifyPaymentValidator = [
    param("paymentId")
        .custom(isValidObjectId)
        .withMessage("Invalid payment ID."),
];

export const reconcileRefundValidator = [
    param("paymentId")
        .custom(isValidObjectId)
        .withMessage("Invalid payment ID."),
];

export const sendRefundValidator = [
    param("paymentId")
        .custom(isValidObjectId)
        .withMessage("Invalid payment ID."),
];

export const completeRefundValidator = [
    param("paymentId")
        .custom(isValidObjectId)
        .withMessage("Invalid payment ID."),

    body("succeeded")
        .optional()
        .isBoolean()
        .withMessage("succeeded must be true or false."),

    body("notes")
        .optional()
        .isString()
        .trim()
        .isLength({ max: 255 })
        .withMessage("Notes must be 255 characters or fewer."),
];