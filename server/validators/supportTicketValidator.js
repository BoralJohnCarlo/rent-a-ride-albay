import { body, param } from "express-validator";

import {
    SUPPORT_TICKET_STATUS_VALUES,
    SUPPORT_TICKET_CATEGORY_VALUES,
} from "../constants/supportTicketConstants.js";

export const ticketIdValidator = [
    param("id")
        .notEmpty()
        .withMessage("Ticket ID is required.")
        .isMongoId()
        .withMessage("Invalid ticket ID."),
];

export const createTicketValidator = [
    body("subject")
        .notEmpty()
        .withMessage("Subject is required.")
        .isString()
        .withMessage("Subject must be a string.")
        .trim()
        .isLength({ max: 200 })
        .withMessage("Subject cannot exceed 200 characters."),

    body("category")
        .notEmpty()
        .withMessage("Category is required.")
        .trim()
        .isIn(SUPPORT_TICKET_CATEGORY_VALUES)
        .withMessage("Invalid category."),

    body("message")
        .notEmpty()
        .withMessage("Message is required.")
        .isString()
        .withMessage("Message must be a string.")
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Message cannot exceed 2000 characters."),
];

export const replyValidator = [
    ...ticketIdValidator,

    body("message")
        .notEmpty()
        .withMessage("Message is required.")
        .isString()
        .withMessage("Message must be a string.")
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Message cannot exceed 2000 characters."),
];

export const updateStatusValidator = [
    ...ticketIdValidator,

    body("status")
        .notEmpty()
        .withMessage("Status is required.")
        .trim()
        .isIn(SUPPORT_TICKET_STATUS_VALUES)
        .withMessage("Invalid status."),
];
