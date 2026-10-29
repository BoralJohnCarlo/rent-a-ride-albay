import { param } from "express-validator";

export const receiptIdValidator = [
    param("receiptId")
        .notEmpty()
        .withMessage("Receipt ID is required.")
        .isMongoId()
        .withMessage("Invalid receipt ID."),
];

export const statementBookingIdValidator = [
    param("bookingId")
        .notEmpty()
        .withMessage("Booking ID is required.")
        .isMongoId()
        .withMessage("Invalid booking ID."),
];
