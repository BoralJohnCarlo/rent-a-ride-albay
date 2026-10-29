import mongoose from "mongoose";
import createError from "../utils/createError.js";
import Rental from "../models/Rental.js";
import { PAYMENT_REFUND_STATUS } from "../constants/paymentConstants.js";
import { getOnlineRevenueForRange } from "./onlineRevenueService.js";
import {
    recordRefund as recordRefundOnRental,
    requestRefund as requestRefundOnRental,
    withdrawRefundRequest as withdrawRefundRequestOnRental,
    approveRefund as approveRefundOnRental,
    rejectRefund as rejectRefundOnRental,
    settleRefundManually as settleRefundOnRental,
} from "./rentalService.js";

const escapeRegex = (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

export const listCustomerRefunds = async (
    customerId,
    { search, page = 1, limit = 20 } = {}
) => {
    const skip = (Number(page) - 1) * Number(limit);
    const match = {
        customer: new mongoose.Types.ObjectId(customerId),
    };

    const searchFilter = search
        ? {
            $or: [
                {
                    "refunds.reason": {
                        $regex: escapeRegex(search),
                        $options: "i",
                    },
                },
                {
                    "refunds.description": {
                        $regex: escapeRegex(search),
                        $options: "i",
                    },
                },
            ],
        }
        : {};

    const [refunds, total] = await Promise.all([
        Rental.aggregate([
            { $match: match },
            { $unwind: { path: "$refunds", preserveNullAndEmptyArrays: false } },
            { $match: searchFilter },
            { $sort: { "refunds.createdAt": -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $project: {
                    _id: "$refunds._id",
                    amount: "$refunds.amount",
                    reason: "$refunds.reason",
                    status: { $ifNull: ["$refunds.status", "Approved"] },
                    description: "$refunds.description",
                    requestedBy: "$refunds.requestedBy",
                    processedBy: "$refunds.processedBy",
                    processedAt: "$refunds.processedAt",
                    gatewayStatus: "$refunds.gatewayStatus",
                    gatewayRefundId: "$refunds.gatewayRefundId",
                    gatewayPayment: "$refunds.gatewayPayment",
                    settledAt: "$refunds.settledAt",
                    settlementNote: "$refunds.settlementNote",
                    createdAt: { $ifNull: ["$refunds.createdAt", "$refunds.processedAt"] },
                    updatedAt: { $ifNull: ["$refunds.updatedAt", "$refunds.processedAt"] },
                    rentalId: "$_id",
                    rentalCode: "$rentalCode",
                },
            },
        ]),
        Rental.aggregate([
            { $match: match },
            { $unwind: { path: "$refunds", preserveNullAndEmptyArrays: false } },
            { $match: searchFilter },
            { $count: "count" },
        ]),
    ]);

    const totalCount = total.length > 0 ? total[0].count : 0;
    const totalPages = Math.ceil(totalCount / Number(limit));

    return {
        data: refunds,
        pagination: {
            total: totalCount,
            page: Number(page),
            limit: Number(limit),
            pages: totalPages,
        },
    };
};

export const getCustomerRefund = async (
    customerId,
    id
) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw createError("Invalid refund ID.", 400);
    }

    const rental = await Rental.findOne({
        customer: new mongoose.Types.ObjectId(customerId),
        "refunds._id": new mongoose.Types.ObjectId(id),
    });

    if (!rental) {
        throw createError("Refund not found.", 404);
    }

    const refund = rental.refunds.id(id);

    if (!refund) {
        throw createError("Refund not found.", 404);
    }

    const refundData = refund.toObject();
    refundData.rentalId = rental._id;
    refundData.rentalCode = rental.rentalCode;

    return refundData;
};

export const recordBookingRefund = async (
    rentalId,
    data,
    currentUserId
) => {
    return await recordRefundOnRental(
        rentalId,
        data,
        currentUserId
    );
};

export const requestCustomerRefund = async (
    rentalId,
    data,
    customerId
) => {
    return await requestRefundOnRental(
        rentalId,
        data,
        customerId
    );
};

export const removeCustomerRefund = async (
    customerId,
    refundId
) => {
    return await withdrawRefundRequestOnRental(
        customerId,
        refundId
    );
};

export const approveRefund = async (
    rentalId,
    refundId,
    adminId,
    amount = null
) => {
    return await approveRefundOnRental(
        rentalId,
        refundId,
        adminId,
        amount
    );
};

export const rejectRefund = async (
    rentalId,
    refundId,
    adminId,
    note
) => {
    return await rejectRefundOnRental(
        rentalId,
        refundId,
        adminId,
        note
    );
};

export const settleRefund = async (
    rentalId,
    refundId,
    adminId,
    options
) => {
    return await settleRefundOnRental(
        rentalId,
        refundId,
        adminId,
        options
    );
};

export const listAllRefunds = async (
    { status, search, page = 1, limit = 20 } = {}
) => {
    const skip = (Number(page) - 1) * Number(limit);

    // Legacy refunds have no status and read as "Approved" (see $project).
    const statusStages = ["Pending", "Approved", "Rejected"].includes(status)
        ? [
            {
                $match: {
                    "refunds.status":
                        status === "Approved"
                            ? { $in: ["Approved", null] }
                            : status,
                },
            },
        ]
        : [];

    const searchRegex = search
        ? { $regex: escapeRegex(search), $options: "i" }
        : null;

    const searchFilter = searchRegex
        ? {
            $or: [
                "refunds.reason",
                "refunds.description",
                "rentalCode",
                "bookingInfo.bookingCode",
                "customerInfo.firstName",
                "customerInfo.lastName",
                "customerInfo.email",
            ].map((field) => ({ [field]: searchRegex })),
        }
        : {};

    const baseStages = [
        { $match: { "refunds.0": { $exists: true } } },
        { $unwind: { path: "$refunds", preserveNullAndEmptyArrays: false } },
    ];

    const joinStages = [
        {
            $lookup: {
                from: "users",
                localField: "customer",
                foreignField: "_id",
                as: "customerInfo"
            }
        },
        { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "bookings",
                localField: "booking",
                foreignField: "_id",
                as: "bookingInfo"
            }
        },
        { $unwind: { path: "$bookingInfo", preserveNullAndEmptyArrays: true } },
    ];

    // The count and totals only need the joins when the search can match
    // a customer or booking field.
    const filterStages = searchRegex
        ? [...baseStages, ...joinStages, { $match: searchFilter }]
        : baseStages;

    const [refunds, total, statusTotals, online] = await Promise.all([
        Rental.aggregate([
            ...baseStages,
            ...statusStages,
            ...joinStages,
            { $match: searchFilter },
            { $sort: { "refunds.createdAt": -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $project: {
                    _id: "$refunds._id",
                    amount: "$refunds.amount",
                    reason: "$refunds.reason",
                    status: { $ifNull: ["$refunds.status", "Approved"] },
                    description: "$refunds.description",
                    requestedBy: "$refunds.requestedBy",
                    processedBy: "$refunds.processedBy",
                    processedAt: "$refunds.processedAt",
                    gatewayStatus: "$refunds.gatewayStatus",
                    gatewayRefundId: "$refunds.gatewayRefundId",
                    gatewayPayment: "$refunds.gatewayPayment",
                    settledAt: "$refunds.settledAt",
                    settlementNote: "$refunds.settlementNote",
                    createdAt: { $ifNull: ["$refunds.createdAt", "$refunds.processedAt"] },
                    updatedAt: { $ifNull: ["$refunds.updatedAt", "$refunds.processedAt"] },
                    rentalId: "$_id",
                    rentalCode: "$rentalCode",
                    booking: {
                        _id: "$bookingInfo._id",
                        bookingCode: "$bookingInfo.bookingCode"
                    },
                    customer: {
                        _id: "$customerInfo._id",
                        firstName: "$customerInfo.firstName",
                        lastName: "$customerInfo.lastName",
                        email: "$customerInfo.email"
                    }
                },
            },
        ]),
        Rental.aggregate([
            ...filterStages,
            ...statusStages,
            { $count: "count" },
        ]),

        /*
         * Totals across every matching refund, independent of the page
         * being displayed — the "Load more" pagination above only bounds
         * how many rows render, and summing just the currently-loaded
         * page would silently understate these once there are more
         * refunds than one page holds. Also independent of the status
         * filter, so every status tab keeps its count.
         */
        Rental.aggregate([
            ...filterStages,
            {
                $group: {
                    _id: { $ifNull: ["$refunds.status", "Approved"] },
                    total: { $sum: "$refunds.amount" },
                    // Excludes refunds settled as "not completed": no
                    // money went back (see isRefundInEffect).
                    paidTotal: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        "$refunds.gatewayStatus",
                                        PAYMENT_REFUND_STATUS.FAILED,
                                    ],
                                },
                                0,
                                "$refunds.amount",
                            ],
                        },
                    },
                    count: { $sum: 1 },
                },
            },
        ]),

        /*
         * Refunds on bookings cancelled/rejected/expired before pickup live
         * on the Payment (managed from the Payments list), not here — but
         * they are still money going back, so the summary reports them.
         * Same figure the revenue dashboard subtracts.
         */
        getOnlineRevenueForRange(new Date(0), null),
    ]);

    const totalCount = total.length > 0 ? total[0].count : 0;
    const totalPages = Math.ceil(totalCount / Number(limit));

    const summary = {
        approvedTotal: 0,
        approvedCount: 0,
        pendingTotal: 0,
        pendingCount: 0,
        rejectedTotal: 0,
        rejectedCount: 0,
        bookingRefundedTotal: online.refunded,
    };

    for (const entry of statusTotals) {
        if (entry._id === "Approved") {
            summary.approvedTotal = entry.paidTotal;
            summary.approvedCount = entry.count;
        } else if (entry._id === "Pending") {
            summary.pendingTotal = entry.total;
            summary.pendingCount = entry.count;
        } else if (entry._id === "Rejected") {
            summary.rejectedTotal = entry.total;
            summary.rejectedCount = entry.count;
        }
    }

    return {
        data: refunds,
        summary,
        pagination: {
            total: totalCount,
            page: Number(page),
            limit: Number(limit),
            pages: totalPages,
        },
    };
};
