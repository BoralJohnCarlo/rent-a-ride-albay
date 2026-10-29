import mongoose from "mongoose";

import PayoutRequest from "../models/PayoutRequest.js";
import { PAYOUT_STATUS } from "../constants/payoutConstants.js";
import { successResponse, errorResponse } from "../utils/response.js";
import createError from "../utils/createError.js";
import {
    getSettingsWithDefaults,
    updatePayoutSettings,
    createPayoutRequest as createPayoutRequestService,
} from "../services/payoutService.js";
import {
    getBookingLocationPolicy,
    updateBookingLocationPolicy,
} from "../services/settingsService.js";
import { notifyUser, notifyAdmins } from "../services/notificationService.js";
import { creditWallet } from "../services/walletService.js";

/*
 * Best-effort notice to the operator who owns a payout request about an admin
 * decision. A failure here must never fail the payout action.
 */
const notifyOperatorOfPayout = async (payout, { type, title, message, variant }) => {
    if (!payout?.operator) {
        return;
    }

    try {
        await notifyUser(payout.operator, {
            type,
            title,
            message,
            variant,
            category: "Payout",
            metadata: {
                reference: payout.payoutCode,
                relatedId: payout._id,
                relatedModel: "PayoutRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of payout decision:",
            notificationError
        );
    }
};

const formatPeso = (amount) =>
    Number(amount || 0).toLocaleString("en-PH", {
        style: "currency",
        currency: "PHP",
    });

export const getPayoutSettings = async (req, res) => {
    try {
        const settings = await getSettingsWithDefaults();
        return successResponse(
            res,
            "Payout settings retrieved successfully.",
            settings.commissionSettings
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const updatePayoutSettingsHandler = async (req, res) => {
    try {
        const {
            platformCommissionRate,
            payoutCurrency,
            payoutHoldHours,
        } = req.body;

        if (
            platformCommissionRate !== undefined &&
            (typeof platformCommissionRate !== "number" ||
                platformCommissionRate < 0 ||
                platformCommissionRate > 100)
        ) {
            return errorResponse(
                res,
                "platformCommissionRate must be a number between 0 and 100.",
                400
            );
        }

        if (
            payoutCurrency !== undefined &&
            (typeof payoutCurrency !== "string" ||
                payoutCurrency.trim().length !== 3)
        ) {
            return errorResponse(
                res,
                "payoutCurrency must be a 3-letter currency code.",
                400
            );
        }

        if (
            payoutHoldHours !== undefined &&
            (typeof payoutHoldHours !== "number" ||
                payoutHoldHours < 0)
        ) {
            return errorResponse(
                res,
                "payoutHoldHours must be a non-negative number.",
                400
            );
        }

        const settings = await updatePayoutSettings({ commissionSettings: req.body });
        return successResponse(
            res,
            "Payout settings updated successfully.",
            settings.commissionSettings
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const getPayoutRequests = async (req, res) => {
    try {
        const {
            status,
            operatorId,
            page = 1,
            limit = 10,
            search = "",
        } = req.query;

        const filter = {};

        if (status) {
            filter.status = status;
        }

        if (operatorId) {
            filter.operator = operatorId;
        }

        if (search) {
            filter.payoutCode = { $regex: search, $options: "i" };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [payouts, total] = await Promise.all([
            PayoutRequest.find(filter)
                .populate("operator", "firstName lastName email phoneNumber")
                .populate("processedBy", "firstName lastName")
                .populate("paidBy", "firstName lastName")
                .populate({
                    path: "items.booking",
                    select: "bookingCode status totalAmount",
                })
                .populate({
                    path: "items.vehicle",
                    select: "vehicleCode brand model plateNumber",
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            PayoutRequest.countDocuments(filter),
        ]);

        return successResponse(
            res,
            "Payout requests retrieved successfully.",
            {
                payouts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit)),
                },
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const getPayoutRequestById = async (req, res) => {
    try {
        const { id } = req.params;

        const payout = await PayoutRequest.findById(id)
            .populate("operator", "firstName lastName email phoneNumber")
            .populate("processedBy", "firstName lastName")
            .populate("paidBy", "firstName lastName")
            .populate({
                path: "items.booking",
                select: "bookingCode status totalAmount customer",
            })
            .populate({
                path: "items.vehicle",
                select: "vehicleCode brand model plateNumber",
            })
            .lean();

        if (!payout) {
            throw createError("Payout request not found.", 404);
        }

        return successResponse(
            res,
            "Payout request retrieved successfully.",
            payout
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const getPayoutRequestsByOperator = async (req, res) => {
    try {
        const operatorId = req.user._id;

        const {
            status,
            page = 1,
            limit = 10,
        } = req.query;

        const filter = { operator: operatorId };

        if (status) {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [payouts, total] = await Promise.all([
            PayoutRequest.find(filter)
                .populate({
                    path: "items.booking",
                    select: "bookingCode status totalAmount",
                })
                .populate({
                    path: "items.vehicle",
                    select: "vehicleCode brand model plateNumber",
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            PayoutRequest.countDocuments(filter),
        ]);

        return successResponse(
            res,
            "Payout requests retrieved successfully.",
            {
                payouts,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit)),
                },
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const getOperatorPayoutSummary = async (req, res) => {
    try {
        const operatorId = req.user._id;

        const sumByStatus = (status) =>
            PayoutRequest.aggregate([
                {
                    $match: {
                        operator: operatorId,
                        status: Array.isArray(status)
                            ? { $in: status }
                            : status,
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$payoutAmount" },
                    },
                },
            ]);

        const [
            pendingTotal,
            scheduledTotal,
            paidTotal,
            rejectedTotal,
            cancelledTotal,
        ] = await Promise.all([
            sumByStatus([PAYOUT_STATUS.PENDING, PAYOUT_STATUS.APPROVED]),
            sumByStatus(PAYOUT_STATUS.SCHEDULED),
            sumByStatus(PAYOUT_STATUS.PAID),
            sumByStatus(PAYOUT_STATUS.REJECTED),
            sumByStatus(PAYOUT_STATUS.CANCELLED),
        ]);

        const pending = pendingTotal[0]?.total || 0;
        const scheduled = scheduledTotal[0]?.total || 0;
        const paid = paidTotal[0]?.total || 0;
        const rejected = rejectedTotal[0]?.total || 0;
        const cancelled = cancelledTotal[0]?.total || 0;

        return successResponse(
            res,
            "Payout summary retrieved.",
            {
                // Rejected/cancelled payouts never reach the operator, so
                // they don't count toward what they've "earned".
                totalEarned: pending + scheduled + paid,
                totalPaid: paid,
                totalPending: pending,
                totalScheduled: scheduled,
                totalCancelled: rejected + cancelled,
            }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const getPayoutStats = async (req, res) => {
    try {
        const stats = await PayoutRequest.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                    totalAmount: { $sum: "$payoutAmount" },
                },
            },
        ]);

        const [totalStats] = await PayoutRequest.aggregate([
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    totalAmount: { $sum: "$payoutAmount" },
                },
            },
        ]);

        const statsMap = {};
        stats.forEach((s) => {
            statsMap[s._id] = {
                count: s.count,
                totalAmount: s.totalAmount,
            };
        });

        return successResponse(res, "Payout stats retrieved.", {
            byStatus: statsMap,
            total: {
                count: totalStats?.totalCount || 0,
                amount: totalStats?.totalAmount || 0,
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

export const approvePayout = async (req, res) => {
    try {
        const { id } = req.params;

        const payout = await PayoutRequest.findById(id);

        if (!payout) {
            throw createError("Payout request not found.", 404);
        }

        if (payout.status !== PAYOUT_STATUS.PENDING) {
            throw createError(
                "Only pending payout requests can be approved.",
                400
            );
        }

        payout.status = PAYOUT_STATUS.APPROVED;
        payout.processedBy = req.user._id;
        payout.processedAt = new Date();
        payout.audit.updatedBy = req.user._id;

        await payout.save();

        await notifyOperatorOfPayout(payout, {
            type: "Payout Approved",
            title: "Payout Request Approved",
            message: `Your payout request ${payout.payoutCode} for ${formatPeso(payout.payoutAmount)} was approved and is being processed.`,
            variant: "success",
        });

        const populatedPayout = await PayoutRequest.findById(id)
            .populate("operator", "firstName lastName email phoneNumber")
            .populate("processedBy", "firstName lastName")
            .lean();

        return successResponse(
            res,
            "Payout request approved.",
            populatedPayout
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const rejectPayout = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || typeof reason !== "string" || !reason.trim()) {
            return errorResponse(
                res,
                "Rejection reason is required.",
                400
            );
        }

        const payout = await PayoutRequest.findById(id);

        if (!payout) {
            throw createError("Payout request not found.", 404);
        }

        if (payout.status !== PAYOUT_STATUS.PENDING) {
            throw createError(
                "Only pending payout requests can be rejected.",
                400
            );
        }

        payout.status = PAYOUT_STATUS.REJECTED;
        payout.rejectionReason = reason.trim();
        payout.processedBy = req.user._id;
        payout.processedAt = new Date();
        payout.audit.updatedBy = req.user._id;

        await payout.save();

        await notifyOperatorOfPayout(payout, {
            type: "Payout Rejected",
            title: "Payout Request Rejected",
            message: `Your payout request ${payout.payoutCode} for ${formatPeso(payout.payoutAmount)} was rejected. Reason: ${reason.trim().slice(0, 300)}`,
            variant: "rejected",
        });

        const populatedPayout = await PayoutRequest.findById(id)
            .populate("operator", "firstName lastName email phoneNumber")
            .populate("processedBy", "firstName lastName")
            .lean();

        return successResponse(
            res,
            "Payout request rejected.",
            populatedPayout
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};

export const markPayoutAsPaid = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        const payout = await PayoutRequest.findById(id).session(
            session
        );

        if (!payout) {
            throw createError("Payout request not found.", 404);
        }

        if (payout.status !== PAYOUT_STATUS.APPROVED) {
            throw createError(
                "Only approved payout requests can be marked as paid.",
                400
            );
        }

        await creditWallet(payout.operator, payout.payoutAmount, {
            description: `Payout ${payout.payoutCode} credited to wallet.`,
            referenceId: payout._id,
            referenceModel: "PayoutRequest",
            performedBy: req.user._id,
            session,
        });

        payout.status = PAYOUT_STATUS.PAID;
        payout.paidAt = new Date();
        payout.paidBy = req.user._id;
        payout.paidVia = "Wallet Credit";
        payout.audit.updatedBy = req.user._id;

        await payout.save({ session });

        await session.commitTransaction();

        // The transaction is already committed; a notification failure here
        // must never be treated as this action having failed.
        await notifyOperatorOfPayout(payout, {
            type: "Payout Paid",
            title: "Payout Sent to Your Wallet",
            message: `Your payout ${payout.payoutCode} for ${formatPeso(payout.payoutAmount)} has been credited to your wallet.`,
            variant: "payment",
        });

        const populatedPayout = await PayoutRequest.findById(id)
            .populate("operator", "firstName lastName email phoneNumber")
            .populate("paidBy", "firstName lastName")
            .lean();

        return successResponse(
            res,
            "Payout credited to the operator's wallet.",
            populatedPayout
        );
    } catch (error) {
        await session.abortTransaction();

        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    } finally {
        session.endSession();
    }
};

export const createPayoutRequest = async (req, res) => {
    try {
        const payout = await createPayoutRequestService(req);

        return successResponse(
            res,
            "Payout request created successfully.",
            payout
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const cancelPayout = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const payout = await PayoutRequest.findById(id);

        if (!payout) {
            throw createError("Payout request not found.", 404);
        }

        const isOperator = payout.operator.toString() === req.user._id.toString();
        const isAdmin = req.user.role === "admin";

        if (!isOperator && !isAdmin) {
            throw createError(
                "Only the payout requester or admin can cancel this request.",
                403
            );
        }

        /*
         * Operators can only withdraw their own manual request while it's
         * still pending (or already rejected). Only admin can cancel a
         * SCHEDULED payout — the auto-generated ones nobody explicitly
         * requested — since that's the intervention point for catching a
         * late refund/dispute before the wallet is actually credited.
         */
        const cancellableStatuses = isAdmin
            ? [
                  PAYOUT_STATUS.PENDING,
                  PAYOUT_STATUS.REJECTED,
                  PAYOUT_STATUS.SCHEDULED,
              ]
            : [
                  PAYOUT_STATUS.PENDING,
                  PAYOUT_STATUS.REJECTED,
              ];

        if (!cancellableStatuses.includes(payout.status)) {
            throw createError(
                isAdmin
                    ? "Only pending, rejected, or scheduled payout requests can be cancelled."
                    : "Only pending or rejected payout requests can be cancelled.",
                400
            );
        }

        if (
            payout.status === PAYOUT_STATUS.SCHEDULED &&
            !reason?.trim()
        ) {
            throw createError(
                "A reason is required to cancel a scheduled payout.",
                400
            );
        }

        payout.status = PAYOUT_STATUS.CANCELLED;
        payout.cancelledAt = new Date();
        payout.cancelledBy = req.user._id;
        payout.cancellationReason = reason?.trim() || "";
        payout.audit.updatedBy = req.user._id;

        await payout.save();

        if (isAdmin && !isOperator) {
            await notifyOperatorOfPayout(payout, {
                type: "Payout Cancelled",
                title: "Payout Request Cancelled",
                message: `Your payout ${payout.payoutCode} for ${formatPeso(payout.payoutAmount)} was cancelled by an administrator.${
                    payout.cancellationReason
                        ? ` Reason: ${payout.cancellationReason}`
                        : ""
                }`,
                variant: "warning",
            });
        } else {
            try {
                await notifyAdmins({
                    type: "payout",
                    title: "Payout Request Cancelled",
                    message: `The operator cancelled payout request ${payout.payoutCode} for ${formatPeso(payout.payoutAmount)}.`,
                    variant: "warning",
                    category: "Payout",
                    metadata: {
                        reference: payout.payoutCode,
                        relatedId: payout._id,
                        relatedModel: "PayoutRequest",
                    },
                });
            } catch (notificationError) {
                console.error(
                    "Failed to notify admins of payout cancellation:",
                    notificationError
                );
            }
        }

        return successResponse(
            res,
            "Payout request cancelled.",
            payout
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 500
        );
    }
};