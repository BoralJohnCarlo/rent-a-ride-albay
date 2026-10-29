import {
    requestWithdrawal,
    getWithdrawalsByOperator,
    getAllWithdrawals,
    handlePayoutWebhook,
} from "../services/withdrawalService.js";

import { verifyPayoutWebhookToken } from "../services/xenditService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const paginationOf = (req) => ({
    page: Math.max(
        1,
        parseInt(req.query.page, 10) || 1
    ),
    limit: Math.min(
        100,
        Math.max(1, parseInt(req.query.limit, 10) || 20)
    ),
});

export const create = async (req, res) => {
    try {
        const withdrawal = await requestWithdrawal(
            req.user._id,
            req.body
        );

        return successResponse(
            res,
            "Withdrawal request submitted.",
            withdrawal,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getMine = async (req, res) => {
    try {
        const { page, limit } = paginationOf(req);

        const { withdrawals, total } =
            await getWithdrawalsByOperator(
                req.user._id,
                { page, limit }
            );

        res.status(200).json({
            success: true,
            message:
                "Withdrawal requests retrieved successfully.",
            data: withdrawals,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAll = async (req, res) => {
    try {
        const { page, limit } = paginationOf(req);

        const { withdrawals, total } =
            await getAllWithdrawals({
                status: req.query.status,
                page,
                limit,
            });

        res.status(200).json({
            success: true,
            message:
                "Withdrawal requests retrieved successfully.",
            data: withdrawals,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const webhook = async (req, res) => {
    try {
        const token =
            req.headers["x-callback-token"];

        if (!verifyPayoutWebhookToken(token)) {
            return res.status(401).json({
                success: false,
                message: "Invalid webhook token.",
            });
        }

        await handlePayoutWebhook(req.body);

        return res.status(200).json({
            success: true,
        });
    } catch (error) {
        console.error(
            "Xendit payout webhook error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
