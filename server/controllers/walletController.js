import { getWalletTransactions } from "../services/walletService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

export const getMyWallet = async (req, res) => {
    try {
        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit, 10) || 20)
        );

        const { wallet, transactions, total } =
            await getWalletTransactions(req.user._id, {
                page,
                limit,
            });

        res.status(200).json({
            success: true,
            message: "Wallet retrieved successfully.",
            data: { wallet, transactions },
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
            error.statusCode || 500
        );
    }
};

export const getOperatorWallet = async (
    req,
    res
) => {
    try {
        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );
        const limit = Math.min(
            100,
            Math.max(1, parseInt(req.query.limit, 10) || 20)
        );

        const { wallet, transactions, total } =
            await getWalletTransactions(
                req.params.operatorId,
                { page, limit }
            );

        res.status(200).json({
            success: true,
            message: "Wallet retrieved successfully.",
            data: { wallet, transactions },
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
            error.statusCode || 500
        );
    }
};
