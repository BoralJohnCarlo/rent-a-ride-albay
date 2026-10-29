import { validationResult } from "express-validator";

import {
    getBookingStatement,
    getReceiptById,
} from "../services/receiptService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const handleValidation = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        errorResponse(
            res,
            "Validation failed.",
            400,
            errors.array()
        );

        return false;
    }

    return true;
};

export const getOne = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const receipt = await getReceiptById(
            req.params.receiptId,
            req.user
        );

        return successResponse(
            res,
            "Receipt retrieved successfully.",
            receipt
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getStatement = async (req, res) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const statement = await getBookingStatement(
            req.params.bookingId,
            req.user
        );

        return successResponse(
            res,
            "Booking statement retrieved successfully.",
            statement
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
