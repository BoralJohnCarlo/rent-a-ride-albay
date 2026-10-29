import { validationResult } from "express-validator";
import {
    listCustomerRefunds as listCustomerRefundsService,
    getCustomerRefund as getCustomerRefundService,
    recordBookingRefund as recordBookingRefundService,
    listAllRefunds as listAllRefundsService,
    requestCustomerRefund as requestCustomerRefundService,
    removeCustomerRefund as removeCustomerRefundService,
    approveRefund as approveRefundService,
    rejectRefund as rejectRefundService,
    settleRefund as settleRefundService,
} from "../services/refundService.js";
import {
    listManualRefunds,
    settleManualRefund,
} from "../services/manualRefundService.js";

const handleValidation = (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        res.status(400).json({
            success: false,
            message: "Validation failed.",
            errors: errors.array(),
            data: null,
        });
        return false;
    }

    return true;
};

export const listCustomerRefunds = async (req, res, next) => {
    try {
        const { search, page, limit } = req.query;

        const result = await listCustomerRefundsService(
            req.user.id,
            { search, page, limit }
        );

        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const getCustomerRefund = async (req, res, next) => {
    try {
        const { id } = req.params;

        const refund = await getCustomerRefundService(
            req.user.id,
            id
        );

        res.json(refund);
    } catch (err) {
        next(err);
    }
};

export const listAllRefunds = async (req, res, next) => {
    try {
        const { status, search, page, limit } = req.query;

        const result = await listAllRefundsService(
            { status, search, page, limit }
        );

        res.json(result);
    } catch (err) {
        next(err);
    }
};

export const recordBookingRefund = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rentalId } = req.params;

        const rental = await recordBookingRefundService(
            rentalId,
            req.body,
            req.user.id
        );

        res.json({
            success: true,
            message: "Rental refund recorded successfully.",
            data: rental
        });
    } catch (err) {
        next(err);
    }
};

export const requestCustomerRefund = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rentalId } = req.params;

        const rental = await requestCustomerRefundService(
            rentalId,
            req.body,
            req.user.id
        );

        res.json({
            success: true,
            message: "Refund request submitted successfully.",
            data: rental
        });
    } catch (err) {
        next(err);
    }
};

export const removeCustomerRefund = async (req, res, next) => {
    try {
        const { id } = req.params;

        await removeCustomerRefundService(
            req.user.id,
            id
        );

        res.json({
            success: true,
            message: "Refund request withdrawn successfully.",
            data: null
        });
    } catch (err) {
        next(err);
    }
};

export const approveRefund = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rentalId, refundId } = req.params;

        const rental = await approveRefundService(
            rentalId,
            refundId,
            req.user.id,
            req.body?.amount
        );

        res.json({
            success: true,
            message: "Refund request approved successfully.",
            data: rental
        });
    } catch (err) {
        next(err);
    }
};

export const rejectRefund = async (req, res, next) => {
    try {
        const { rentalId, refundId } = req.params;

        const rental = await rejectRefundService(
            rentalId,
            refundId,
            req.user.id,
            req.body?.note
        );

        res.json({
            success: true,
            message: "Refund request rejected successfully.",
            data: rental
        });
    } catch (err) {
        next(err);
    }
};

export const settleRefund = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const { rentalId, refundId } = req.params;

        const rental = await settleRefundService(
            rentalId,
            refundId,
            req.user.id,
            {
                succeeded: req.body?.succeeded !== false,
                notes: req.body?.notes,
            }
        );

        res.json({
            success: true,
            message:
                req.body?.succeeded === false
                    ? "Refund marked as not completed."
                    : "Refund marked as settled.",
            data: rental
        });
    } catch (err) {
        next(err);
    }
};

/*
 * Refunds owed by hand (see ManualRefund) — the admin's Owed Refunds list.
 */
export const listOwedRefunds = async (req, res, next) => {
    try {
        const result = await listManualRefunds({
            status: req.query.status,
        });

        res.json({
            success: true,
            message: "Owed refunds retrieved successfully.",
            data: result.data,
            counts: result.counts,
        });
    } catch (err) {
        next(err);
    }
};

export const settleOwedRefund = async (req, res, next) => {
    try {
        if (!handleValidation(req, res)) {
            return;
        }

        const refund = await settleManualRefund(
            req.params.id,
            {
                succeeded: req.body?.succeeded !== false,
                notes: req.body?.notes,
            },
            req.user.id
        );

        res.json({
            success: true,
            message:
                req.body?.succeeded === false
                    ? "Refund marked as not paid."
                    : "Refund marked as paid.",
            data: refund,
        });
    } catch (err) {
        next(err);
    }
};
