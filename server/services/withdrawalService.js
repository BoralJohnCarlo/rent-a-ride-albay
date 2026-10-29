import mongoose from "mongoose";

import createError from "../utils/createError.js";

import WithdrawalRequest from "../models/WithdrawalRequest.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { nextSequence } from "../models/Sequence.js";

import {
    WITHDRAWAL_STATUS,
    WITHDRAWAL_CODE_PREFIX,
    MINIMUM_WITHDRAWAL_AMOUNT,
} from "../constants/withdrawalConstants.js";

import {
    WALLET_TRANSACTION_STATUS,
} from "../constants/walletConstants.js";

import {
    getOrCreateWallet,
    debitWallet,
    creditWallet,
} from "./walletService.js";

import { createGCashPayout } from "./xenditService.js";

import { notifyUser } from "./notificationService.js";

const generateWithdrawalCode = async () => {
    const nextNumber = await nextSequence(
        "withdrawalCode"
    );

    return `${WITHDRAWAL_CODE_PREFIX}${String(
        nextNumber
    ).padStart(5, "0")}`;
};

const formatPeso = (amount) =>
    Number(amount || 0).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
    });

/*
 * Reserves the funds (debits the wallet) and creates the withdrawal record
 * in one transaction, then calls Xendit outside of it — an external network
 * call has no place holding a DB transaction open. If Xendit rejects the
 * request, the reserved funds are refunded back to the wallet immediately.
 */
export const requestWithdrawal = async (
    operatorId,
    { amount, gcashNumber, accountName }
) => {
    const withdrawAmount = Number(amount);

    if (
        !Number.isFinite(withdrawAmount) ||
        withdrawAmount <= 0
    ) {
        throw createError(
            "Withdrawal amount must be greater than zero.",
            400
        );
    }

    if (withdrawAmount < MINIMUM_WITHDRAWAL_AMOUNT) {
        throw createError(
            `Minimum withdrawal amount is ${formatPeso(MINIMUM_WITHDRAWAL_AMOUNT)}.`,
            400
        );
    }

    if (!gcashNumber?.trim() || !accountName?.trim()) {
        throw createError(
            "GCash number and account name are required.",
            400
        );
    }

    const wallet = await getOrCreateWallet(
        operatorId
    );

    if (wallet.balance < withdrawAmount) {
        throw createError(
            "Insufficient wallet balance.",
            400
        );
    }

    const withdrawalCode =
        await generateWithdrawalCode();
    const withdrawalId =
        new mongoose.Types.ObjectId();

    const session = await mongoose.startSession();
    session.startTransaction();

    let withdrawal;

    try {
        const { transaction } = await debitWallet(
            operatorId,
            withdrawAmount,
            {
                description: `Withdrawal ${withdrawalCode} to GCash ${gcashNumber.trim()}.`,
                referenceId: withdrawalId,
                referenceModel: "WithdrawalRequest",
                status: WALLET_TRANSACTION_STATUS.PENDING,
                performedBy: operatorId,
                session,
            }
        );

        const [created] = await WithdrawalRequest.create(
            [
                {
                    _id: withdrawalId,
                    withdrawalCode,
                    operator: operatorId,
                    wallet: wallet._id,
                    amount: withdrawAmount,
                    gcashNumber: gcashNumber.trim(),
                    accountName: accountName.trim(),
                    status: WITHDRAWAL_STATUS.PENDING,
                    walletTransaction: transaction._id,
                },
            ],
            { session }
        );

        withdrawal = created;

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }

    try {
        const payout = await createGCashPayout({
            referenceId: withdrawal._id.toString(),
            amount: withdrawAmount,
            accountHolderName: accountName.trim(),
            gcashNumber: gcashNumber.trim(),
            description: `Rent-A-Ride Albay payout ${withdrawalCode}`,
        });

        withdrawal.status =
            WITHDRAWAL_STATUS.PROCESSING;
        withdrawal.xenditPayoutId =
            payout?.id || payout?.payout_id || "";

        await withdrawal.save();
    } catch (xenditError) {
        withdrawal.status = WITHDRAWAL_STATUS.FAILED;
        withdrawal.failureReason =
            xenditError.message ||
            "Unable to reach the payout provider.";

        await withdrawal.save();

        await WalletTransaction.findByIdAndUpdate(
            withdrawal.walletTransaction,
            {
                status: WALLET_TRANSACTION_STATUS.FAILED,
            }
        );

        await creditWallet(
            operatorId,
            withdrawAmount,
            {
                description: `Refund for failed withdrawal ${withdrawalCode}.`,
                referenceId: withdrawal._id,
                referenceModel: "WithdrawalRequest",
            }
        );

        try {
            await notifyUser(operatorId, {
                type: "wallet",
                title: "Withdrawal Failed",
                message: `Your withdrawal ${withdrawalCode} for ${formatPeso(withdrawAmount)} failed and has been refunded to your wallet. Reason: ${withdrawal.failureReason}`,
                variant: "error",
                category: "Payout",
                metadata: {
                    reference: withdrawalCode,
                    relatedId: withdrawal._id,
                    relatedModel: "WithdrawalRequest",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify operator of withdrawal failure:",
                notificationError
            );
        }
    }

    return withdrawal;
};

/*
 * Idempotent and race-safe:
 *
 * - Looked up by `reference_id` first — that's our own withdrawal `_id`,
 *   written at creation time, before Xendit is ever called. `xenditPayoutId`
 *   is only written to our record *after* the create-payout call returns,
 *   so a webhook arriving faster than that write (plausible in test mode,
 *   where transfers can "complete" almost immediately) would find nothing
 *   if looked up by that field first.
 * - The status transition itself is a single atomic `findOneAndUpdate`
 *   filtered on "not already terminal", so two concurrent/duplicate webhook
 *   deliveries (Xendit retries for 24h on any non-200 response) can't both
 *   pass a check and double-refund or double-notify — only one can ever
 *   win the transition; the other finds no matching document and no-ops.
 */
export const handlePayoutWebhook = async (
    payload
) => {
    const event = payload?.event;
    const data = payload?.data || {};
    const xenditPayoutId =
        data.id || data.payout_id;
    const referenceId = data.reference_id;

    const existing = referenceId
        ? await WithdrawalRequest.findById(
              referenceId
          )
        : xenditPayoutId
          ? await WithdrawalRequest.findOne({
                xenditPayoutId,
            })
          : null;

    if (!existing) {
        return null;
    }

    const isSuccess = event === "payout.succeeded";
    const isFailure =
        event === "payout.failed" ||
        event === "payout.reversed";

    if (!isSuccess && !isFailure) {
        return existing;
    }

    const update = isSuccess
        ? {
              status: WITHDRAWAL_STATUS.COMPLETED,
              completedAt: new Date(),
          }
        : {
              status: WITHDRAWAL_STATUS.FAILED,
              failureReason:
                  data.failure_code ||
                  data.status ||
                  "Payout failed at the provider.",
          };

    if (xenditPayoutId) {
        update.xenditPayoutId = xenditPayoutId;
    }

    const withdrawal =
        await WithdrawalRequest.findOneAndUpdate(
            {
                _id: existing._id,
                status: {
                    $in: [
                        WITHDRAWAL_STATUS.PENDING,
                        WITHDRAWAL_STATUS.PROCESSING,
                    ],
                },
            },
            { $set: update },
            { new: true }
        );

    if (!withdrawal) {
        // Already terminal — a duplicate/racing delivery lost the race.
        return existing;
    }

    if (isSuccess) {
        await WalletTransaction.findByIdAndUpdate(
            withdrawal.walletTransaction,
            {
                status: WALLET_TRANSACTION_STATUS.COMPLETED,
            }
        );

        try {
            await notifyUser(withdrawal.operator, {
                type: "wallet",
                title: "Withdrawal Completed",
                message: `Your withdrawal ${withdrawal.withdrawalCode} for ${formatPeso(withdrawal.amount)} has been sent to your GCash account.`,
                variant: "success",
                category: "Payout",
                metadata: {
                    reference: withdrawal.withdrawalCode,
                    relatedId: withdrawal._id,
                    relatedModel: "WithdrawalRequest",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify operator of completed withdrawal:",
                notificationError
            );
        }
    } else {
        await WalletTransaction.findByIdAndUpdate(
            withdrawal.walletTransaction,
            {
                status: WALLET_TRANSACTION_STATUS.FAILED,
            }
        );

        await creditWallet(
            withdrawal.operator,
            withdrawal.amount,
            {
                description: `Refund for failed withdrawal ${withdrawal.withdrawalCode}.`,
                referenceId: withdrawal._id,
                referenceModel: "WithdrawalRequest",
            }
        );

        try {
            await notifyUser(withdrawal.operator, {
                type: "wallet",
                title: "Withdrawal Failed",
                message: `Your withdrawal ${withdrawal.withdrawalCode} for ${formatPeso(withdrawal.amount)} failed and has been refunded to your wallet.`,
                variant: "error",
                category: "Payout",
                metadata: {
                    reference: withdrawal.withdrawalCode,
                    relatedId: withdrawal._id,
                    relatedModel: "WithdrawalRequest",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify operator of failed withdrawal:",
                notificationError
            );
        }
    }

    return withdrawal;
};

export const getWithdrawalsByOperator = async (
    operatorId,
    { page = 1, limit = 20 } = {}
) => {
    const filter = { operator: operatorId };
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        WithdrawalRequest.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        WithdrawalRequest.countDocuments(filter),
    ]);

    return { withdrawals, total };
};

export const getAllWithdrawals = async ({
    status,
    page = 1,
    limit = 20,
} = {}) => {
    const filter = {};

    if (status) {
        filter.status = status;
    }

    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        WithdrawalRequest.find(filter)
            .populate(
                "operator",
                "firstName lastName email"
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        WithdrawalRequest.countDocuments(filter),
    ]);

    return { withdrawals, total };
};
