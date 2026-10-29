import mongoose from "mongoose";
import {
    body,
    param,
    query,
} from "express-validator";

import {
    DISCOUNT_SCOPE,
    DISCOUNT_SCOPE_VALUES,
    DISCOUNT_METHOD,
    DISCOUNT_METHOD_VALUES,
    DISCOUNT_STATUS_VALUES,
    DISCOUNT_LABEL_MAX_LENGTH,
} from "../constants/discountConstants.js";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

const discountIdParam = param("discountId")
    .custom(isValidObjectId)
    .withMessage("Discount ID must be valid.");

/*
 * Field rules shared by create and update; `required` decides whether a
 * missing field fails (create) or is skipped (update).
 */
const discountFieldRules = (required) => {
    const field = (name, message) =>
        required
            ? body(name).notEmpty().withMessage(message)
            : body(name).optional();

    return [
        field("name", "Discount name is required.")
            .isString()
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage("Discount name must be 1-200 characters."),

        body("label")
            .optional()
            .isString()
            .trim()
            .isLength({ max: DISCOUNT_LABEL_MAX_LENGTH })
            .withMessage(
                `Badge label must not exceed ${DISCOUNT_LABEL_MAX_LENGTH} characters.`
            ),

        body("description")
            .optional()
            .isString()
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Description must not exceed 1000 characters."),

        body("scope")
            .optional()
            .isIn(DISCOUNT_SCOPE_VALUES)
            .withMessage("Invalid discount scope."),

        body("vehicles")
            .optional()
            .isArray()
            .withMessage("Vehicles must be an array.")
            .custom((value) => value.every(isValidObjectId))
            .withMessage("Each vehicle must be a valid ID.")
            .custom((value, { req }) => {
                if (
                    req.body.scope === DISCOUNT_SCOPE.SPECIFIC_VEHICLES &&
                    value.length === 0
                ) {
                    throw new Error(
                        "Select at least one vehicle for this discount."
                    );
                }

                return true;
            }),

        field("discountMethod", "Discount method is required.")
            .isIn(DISCOUNT_METHOD_VALUES)
            .withMessage("Invalid discount method."),

        field("discountValue", "Discount value is required.")
            .isFloat({ gt: 0 })
            .withMessage("Discount value must be greater than 0.")
            .custom((value, { req }) => {
                if (
                    req.body.discountMethod === DISCOUNT_METHOD.PERCENTAGE &&
                    Number(value) > 100
                ) {
                    throw new Error("Percentage discount cannot exceed 100.");
                }

                return true;
            }),

        field("startDate", "Start date is required.")
            .isISO8601()
            .withMessage("Start date must be a valid date."),

        field("endDate", "End date is required.")
            .isISO8601()
            .withMessage("End date must be a valid date."),

        body("status")
            .optional()
            .isIn(DISCOUNT_STATUS_VALUES)
            .withMessage("Invalid discount status."),
    ];
};

export const createDiscountValidator = discountFieldRules(true);

export const updateDiscountValidator = [
    discountIdParam,
    ...discountFieldRules(false),
];

export const discountIdValidator = [discountIdParam];

export const discountFiltersValidator = [
    query("status").optional().isString(),
    query("scope").optional().isString(),
];
