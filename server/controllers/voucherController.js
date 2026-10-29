import { validationResult } from "express-validator";

import {
    createVoucher,
    getVouchers,
    getVoucherById,
    updateVoucherById,
    deleteVoucherById,
    getAvailableVouchers,
    validateVoucherForUser,
    calculatePricingWithVoucher,
    recordVoucherUsage,
} from "../services/voucherService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const create = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(
                req
            );

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const voucher =
            await createVoucher(
                req.body,
                req.user?._id
            );

        return successResponse(
            res,
            "Voucher created successfully.",
            voucher,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const getAll = async (
    req,
    res
) => {
    try {
        const filters = {
            status:
                req.query.status,
            type:
                req.query.type,
            search:
                req.query.search,
        };

        const vouchers =
            await getVouchers(
                filters,
                req.user?._id
            );

        return successResponse(
            res,
            "Vouchers retrieved successfully.",
            vouchers
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const getById = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(
                req
            );

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const voucher =
            await getVoucherById(
                req.params.voucherId
            );

        return successResponse(
            res,
            "Voucher retrieved successfully.",
            voucher
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const update = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(
                req
            );

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const voucher =
            await updateVoucherById(
                req.params.voucherId,
                req.body,
                req.user?._id
            );

        return successResponse(
            res,
            "Voucher updated successfully.",
            voucher
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const remove = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(
                req
            );

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        await deleteVoucherById(
            req.params.voucherId
        );

        return successResponse(
            res,
            "Voucher deleted successfully.",
            null
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const getAvailable = async (
    req,
    res
) => {
    try {
        const vouchers =
            await getAvailableVouchers(
                req.user?._id
            );

        return successResponse(
            res,
            "Available vouchers retrieved successfully.",
            vouchers
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const apply = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(
                req
            );

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const {
            code,
            pricing,
        } =
            req.body;

        const voucher =
            await validateVoucherForUser(
                code,
                req.user?._id
            );

        const discountedPricing =
            calculatePricingWithVoucher(
                pricing || {},
                voucher,
                req.user?._id
            );

        return successResponse(
            res,
            "Voucher applied successfully.",
            {
                voucher: {
                    _id:
                        voucher._id,
                    code:
                        voucher.code,
                    name:
                        voucher.name,
                    description:
                        voucher.description,
                    type:
                        voucher.type,
                    discountMethod:
                        voucher.discountMethod,
                    discountValue:
                        voucher.discountValue,
                    startDate:
                        voucher.startDate,
                    endDate:
                        voucher.endDate,
                },
                pricing:
                    discountedPricing,
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};

export const recordUsage = async (
    req,
    res
) => {
    try {
        const errors =
            validationResult(
                req
            );

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const {
            userId,
            bookingId,
        } =
            req.body;

        await recordVoucherUsage(
            req.params.voucherId,
            userId,
            bookingId
        );

        return successResponse(
            res,
            "Voucher usage recorded successfully.",
            null
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode ||
                400
        );
    }
};
