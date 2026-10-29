import mongoose from "mongoose";
import {
    body,
    param,
    query,
} from "express-validator";

import {
    VOUCHER_TYPE_VALUES,
    VOUCHER_DISCOUNT_METHOD_VALUES,
    VOUCHER_STATUS_VALUES,
    VOUCHER_ASSIGNMENT_TYPE_VALUES,
    VOUCHER_CODE_LENGTH,
} from "../constants/voucherConstants.js";

const isValidObjectId = (
    value
) =>
    mongoose.Types.ObjectId.isValid(
        value
    );

const validateDateOrder = (
    endDate,
    {
        req,
    }
) => {
    const startDate =
        req.body.startDate;

    if (!startDate) {
        return true;
    }

    return (
        new Date(endDate) >
        new Date(startDate)
    );
};

export const createVoucherValidator = [
    body("name")
        .notEmpty()
        .withMessage(
            "Voucher name is required."
        )
        .isString()
        .withMessage(
            "Voucher name must be a string."
        )
        .trim()
        .isLength({
            max: 200,
        })
        .withMessage(
            "Voucher name must not exceed 200 characters."
        ),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Description must be a string."
        )
        .trim()
        .isLength({
            max: 1000,
        })
        .withMessage(
            "Description must not exceed 1000 characters."
        ),

    body("type")
        .notEmpty()
        .withMessage(
            "Voucher type is required."
        )
        .isIn(
            VOUCHER_TYPE_VALUES
        )
        .withMessage(
            "Invalid voucher type."
        ),

    body("discountMethod")
        .notEmpty()
        .withMessage(
            "Discount method is required."
        )
        .isIn(
            VOUCHER_DISCOUNT_METHOD_VALUES
        )
        .withMessage(
            "Invalid discount method."
        ),

    body("discountValue")
        .notEmpty()
        .withMessage(
            "Discount value is required."
        )
        .isFloat({
            min: 0,
        })
        .withMessage(
            "Discount value must be a non-negative number."
        )
        .custom(
            (value, { req }) => {
                if (
                    req.body
                        .discountMethod ===
                        "percentage" &&
                    value > 100
                ) {
                    throw new Error(
                        "Percentage discount cannot exceed 100."
                    );
                }

                return true;
            }
        ),

    body("startDate")
        .notEmpty()
        .withMessage(
            "Start date is required."
        )
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    body("endDate")
        .notEmpty()
        .withMessage(
            "End date is required."
        )
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        )
        .custom(
            validateDateOrder
        )
        .withMessage(
            "End date must be after start date."
        ),

    body("maxUsagesPerUser")
        .optional({
            nullable: true,
        })
        .isInt({
            min: 1,
        })
        .withMessage(
            "Max usages per user must be at least 1."
        ),

    body("status")
        .optional()
        .isIn(
            VOUCHER_STATUS_VALUES
        )
        .withMessage(
            "Invalid voucher status."
        ),

    body("assignmentType")
        .notEmpty()
        .withMessage(
            "Assignment type is required."
        )
        .isIn(
            VOUCHER_ASSIGNMENT_TYPE_VALUES
        )
        .withMessage(
            "Invalid assignment type."
        ),

    body("assignedTo")
        .optional()
        .isArray()
        .withMessage(
            "Assigned users must be an array."
        )
        .custom(
            (value) =>
                value.every(
                    (id) =>
                        isValidObjectId(
                            id
                        )
                )
        )
        .withMessage(
            "Each assigned user must be a valid ID."
        )
        .custom(
            (value, { req }) => {
                if (
                    req.body
                        .assignmentType ===
                        "specific_users" &&
                    (!value ||
                        value.length ===
                            0)
                ) {
                    throw new Error(
                        "Please select at least one customer for specific user assignment."
                    );
                }

                return true;
            }
        ),
];

export const updateVoucherValidator = [
    param("voucherId")
        .notEmpty()
        .withMessage(
            "Voucher ID is required."
        )
        .custom(
            isValidObjectId
        )
        .withMessage(
            "Voucher ID must be valid."
        ),

    body("name")
        .optional()
        .isString()
        .withMessage(
            "Voucher name must be a string."
        )
        .trim()
        .isLength({
            max: 200,
        })
        .withMessage(
            "Voucher name must not exceed 200 characters."
        ),

    body("description")
        .optional()
        .isString()
        .withMessage(
            "Description must be a string."
        )
        .trim()
        .isLength({
            max: 1000,
        })
        .withMessage(
            "Description must not exceed 1000 characters."
        ),

    body("type")
        .optional()
        .isIn(
            VOUCHER_TYPE_VALUES
        )
        .withMessage(
            "Invalid voucher type."
        ),

    body("discountMethod")
        .optional()
        .isIn(
            VOUCHER_DISCOUNT_METHOD_VALUES
        )
        .withMessage(
            "Invalid discount method."
        ),

    body("discountValue")
        .optional()
        .isFloat({
            min: 0,
        })
        .withMessage(
            "Discount value must be a non-negative number."
        ),

    body("startDate")
        .optional()
        .isISO8601()
        .withMessage(
            "Start date must be a valid date."
        ),

    body("endDate")
        .optional()
        .isISO8601()
        .withMessage(
            "End date must be a valid date."
        )
        .custom(
            validateDateOrder
        )
        .withMessage(
            "End date must be after start date."
        ),

    body("maxUsagesPerUser")
        .optional({
            nullable: true,
        })
        .isInt({
            min: 1,
        })
        .withMessage(
            "Max usages per user must be at least 1."
        ),

    body("status")
        .optional()
        .isIn(
            VOUCHER_STATUS_VALUES
        )
        .withMessage(
            "Invalid voucher status."
        ),

    body("assignmentType")
        .optional()
        .isIn(
            VOUCHER_ASSIGNMENT_TYPE_VALUES
        )
        .withMessage(
            "Invalid assignment type."
        ),

    body("assignedTo")
        .optional()
        .isArray()
        .withMessage(
            "Assigned users must be an array."
        )
        .custom(
            (value) =>
                value.every(
                    (id) =>
                        isValidObjectId(
                            id
                        )
                )
        )
        .withMessage(
            "Each assigned user must be a valid ID."
        )
        .custom(
            (value, { req }) => {
                if (
                    req.body
                        .assignmentType ===
                        "specific_users" &&
                    (!value ||
                        value.length ===
                            0)
                ) {
                    throw new Error(
                        "Please select at least one customer for specific user assignment."
                    );
                }

                return true;
            }
        ),
];

export const voucherIdValidator = [
    param("voucherId")
        .notEmpty()
        .withMessage(
            "Voucher ID is required."
        )
        .custom(
            isValidObjectId
        )
        .withMessage(
            "Voucher ID must be valid."
        ),
];

export const applyVoucherValidator = [
    body("code")
        .notEmpty()
        .withMessage(
            "Voucher code is required."
        )
        .isString()
        .withMessage(
            "Voucher code must be a string."
        )
        .trim()
        .isLength({
            min: VOUCHER_CODE_LENGTH,
            max: VOUCHER_CODE_LENGTH,
        })
        .withMessage(
            "Voucher code must be a valid format."
        ),
];

export const voucherFiltersValidator = [
    query("status")
        .optional()
        .isString()
        .withMessage(
            "Status must be a string."
        ),

    query("type")
        .optional()
        .isString()
        .withMessage(
            "Type must be a string."
        ),

    query("search")
        .optional()
        .isString()
        .withMessage(
            "Search must be a string."
        ),
];
