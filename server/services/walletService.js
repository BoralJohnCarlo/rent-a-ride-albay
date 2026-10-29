import createError from "../utils/createError.js";

import Wallet from "../models/Wallet.js";
import WalletTransaction from "../models/WalletTransaction.js";

import {
    WALLET_TRANSACTION_TYPE,
    WALLET_TRANSACTION_STATUS,
} from "../constants/walletConstants.js";

export const getOrCreateWallet = async (
    operatorId,
    session = null
) => {
    return await Wallet.findOneAndUpdate(
        { operator: operatorId },
        { $setOnInsert: { operator: operatorId } },
        { upsert: true, new: true, session }
    );
};

/*
 * Atomically increments the operator's wallet balance and records a ledger
 * entry for it. Pass `session` when this must commit together with another
 * write (e.g. flipping a PayoutRequest to PAID) so a failure on either side
 * rolls back both instead of leaving the payout marked paid without the
 * money actually landing in the wallet.
 */
export const creditWallet = async (
    operatorId,
    amount,
    {
        description = "",
        referenceId = null,
        referenceModel = "",
        performedBy = null,
        session = null,
    } = {}
) => {
    const creditAmount = Number(amount);

    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
        throw createError(
            "Credit amount must be greater than zero.",
            400
        );
    }

    const wallet = await Wallet.findOneAndUpdate(
        { operator: operatorId },
        {
            $inc: { balance: creditAmount },
            $setOnInsert: { operator: operatorId },
        },
        { upsert: true, new: true, session }
    );

    const [transaction] = await WalletTransaction.create(
        [
            {
                wallet: wallet._id,
                operator: operatorId,
                type: WALLET_TRANSACTION_TYPE.CREDIT,
                amount: creditAmount,
                balanceAfter: wallet.balance,
                description,
                referenceId,
                referenceModel,
                performedBy,
            },
        ],
        { session }
    );

    return { wallet, transaction };
};

/*
 * Atomically decrements the operator's wallet balance, guarded by a
 * `balance >= amount` filter so two concurrent debits (e.g. two withdrawal
 * requests) can never overdraw the wallet. Throws if the balance is
 * insufficient at the moment the update runs.
 */
export const debitWallet = async (
    operatorId,
    amount,
    {
        description = "",
        referenceId = null,
        referenceModel = "",
        performedBy = null,
        status = WALLET_TRANSACTION_STATUS.COMPLETED,
        session = null,
    } = {}
) => {
    const debitAmount = Number(amount);

    if (!Number.isFinite(debitAmount) || debitAmount <= 0) {
        throw createError(
            "Debit amount must be greater than zero.",
            400
        );
    }

    const wallet = await Wallet.findOneAndUpdate(
        {
            operator: operatorId,
            balance: { $gte: debitAmount },
        },
        { $inc: { balance: -debitAmount } },
        { new: true, session }
    );

    if (!wallet) {
        throw createError(
            "Insufficient wallet balance.",
            400
        );
    }

    const [transaction] = await WalletTransaction.create(
        [
            {
                wallet: wallet._id,
                operator: operatorId,
                type: WALLET_TRANSACTION_TYPE.DEBIT,
                status,
                amount: debitAmount,
                balanceAfter: wallet.balance,
                description,
                referenceId,
                referenceModel,
                performedBy,
            },
        ],
        { session }
    );

    return { wallet, transaction };
};

export const getWalletTransactions = async (
    operatorId,
    { page = 1, limit = 20 } = {}
) => {
    const wallet = await getOrCreateWallet(operatorId);

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        WalletTransaction.find({ wallet: wallet._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        WalletTransaction.countDocuments({
            wallet: wallet._id,
        }),
    ]);

    return { wallet, transactions, total };
};
