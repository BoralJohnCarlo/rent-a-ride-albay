import { validationResult } from "express-validator";

import {
    getDiscounts,
    getDiscountById,
    createDiscount,
    updateDiscountById,
    deleteDiscountById,
} from "../services/discountService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

/* Runs `handler` after the validators, mapping failures to responses. */
const withValidation = (handler) => async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed.", 400, errors.array());
    }

    try {
        return await handler(req, res);
    } catch (error) {
        return errorResponse(res, error.message, error.statusCode || 400);
    }
};

export const getAll = withValidation(async (req, res) =>
    successResponse(
        res,
        "Discounts retrieved successfully.",
        await getDiscounts({
            status: req.query.status,
            scope: req.query.scope,
        })
    )
);

export const getById = withValidation(async (req, res) =>
    successResponse(
        res,
        "Discount retrieved successfully.",
        await getDiscountById(req.params.discountId)
    )
);

export const create = withValidation(async (req, res) =>
    successResponse(
        res,
        "Discount created successfully.",
        await createDiscount(req.body, req.user?._id),
        201
    )
);

export const update = withValidation(async (req, res) =>
    successResponse(
        res,
        "Discount updated successfully.",
        await updateDiscountById(
            req.params.discountId,
            req.body,
            req.user?._id
        )
    )
);

export const remove = withValidation(async (req, res) => {
    await deleteDiscountById(req.params.discountId);

    return successResponse(res, "Discount deleted successfully.", null);
});
