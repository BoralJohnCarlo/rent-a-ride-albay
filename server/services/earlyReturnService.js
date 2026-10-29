import Rental from "../models/Rental.js";
import {
    approveEarlyReturnCredit as approveEarlyReturnCreditOnRental,
    rejectEarlyReturnCredit as rejectEarlyReturnCreditOnRental,
} from "./rentalService.js";

const escapeRegex = (text) => {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

export const approveEarlyReturnCredit = async (
    rentalId,
    adminId,
    overrideDays = null
) => {
    return await approveEarlyReturnCreditOnRental(
        rentalId,
        adminId,
        overrideDays
    );
};

export const rejectEarlyReturnCredit = async (
    rentalId,
    adminId,
    note
) => {
    return await rejectEarlyReturnCreditOnRental(
        rentalId,
        adminId,
        note
    );
};

/*
 * Paginated admin queue of every rental with a detected early return,
 * newest first. Mirrors listAllRefunds's aggregation shape, minus the
 * $unwind since earlyReturn is a single embedded subdocument, not an array.
 */
export const listEarlyReturnCredits = async (
    { status, search, page = 1, limit = 20 } = {}
) => {
    const skip = (Number(page) - 1) * Number(limit);

    const match = {
        "earlyReturn.detected": true,
    };

    if (status && status !== "All") {
        match["earlyReturn.status"] = status;
    }

    const searchFilter = search
        ? {
            $or: [
                {
                    rentalCode: {
                        $regex: escapeRegex(search),
                        $options: "i",
                    },
                },
            ],
        }
        : {};

    const [credits, total, statusTotals] = await Promise.all([
        Rental.aggregate([
            { $match: match },
            {
                $lookup: {
                    from: "users",
                    localField: "customer",
                    foreignField: "_id",
                    as: "customerInfo",
                },
            },
            { $unwind: { path: "$customerInfo", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "vehicles",
                    localField: "vehicle",
                    foreignField: "_id",
                    as: "vehicleInfo",
                },
            },
            { $unwind: { path: "$vehicleInfo", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "bookings",
                    localField: "booking",
                    foreignField: "_id",
                    as: "bookingInfo",
                },
            },
            { $unwind: { path: "$bookingInfo", preserveNullAndEmptyArrays: true } },
            { $match: searchFilter },
            { $sort: { "earlyReturn.actualReturnAt": -1 } },
            { $skip: skip },
            { $limit: Number(limit) },
            {
                $project: {
                    rentalId: "$_id",
                    rentalCode: "$rentalCode",
                    booking: {
                        _id: "$bookingInfo._id",
                        bookingCode: "$bookingInfo.bookingCode",
                    },
                    earlyReturn: "$earlyReturn",
                    customer: {
                        _id: "$customerInfo._id",
                        firstName: "$customerInfo.firstName",
                        lastName: "$customerInfo.lastName",
                        email: "$customerInfo.email",
                    },
                    vehicle: {
                        _id: "$vehicleInfo._id",
                        brand: "$vehicleInfo.brand",
                        model: "$vehicleInfo.model",
                    },
                },
            },
        ]),
        Rental.aggregate([
            { $match: match },
            { $match: searchFilter },
            { $count: "count" },
        ]),
        /*
         * Per-status totals ignore the status filter: they feed the status
         * tab badges, which must keep showing every status's count while
         * one of them is selected.
         */
        Rental.aggregate([
            { $match: { "earlyReturn.detected": true } },
            {
                /*
                 * Approved rows sum the actual issued amount
                 * (approvedCreditAmount, which may be lower than the
                 * computed creditAmount if the admin reduced the day
                 * count) — Pending/Rejected rows have no approved amount,
                 * so they fall back to the computed one.
                 */
                $group: {
                    _id: "$earlyReturn.status",
                    total: {
                        $sum: {
                            $cond: [
                                {
                                    $eq: [
                                        "$earlyReturn.status",
                                        "Approved",
                                    ],
                                },
                                "$earlyReturn.approvedCreditAmount",
                                "$earlyReturn.creditAmount",
                            ],
                        },
                    },
                    count: { $sum: 1 },
                },
            },
        ]),
    ]);

    const totalCount = total.length > 0 ? total[0].count : 0;
    const totalPages = Math.ceil(totalCount / Number(limit));

    const summary = {
        pendingTotal: 0,
        pendingCount: 0,
        approvedTotal: 0,
        approvedCount: 0,
        rejectedTotal: 0,
        rejectedCount: 0,
    };

    for (const entry of statusTotals) {
        if (entry._id === "Pending") {
            summary.pendingTotal = entry.total;
            summary.pendingCount = entry.count;
        } else if (entry._id === "Approved") {
            summary.approvedTotal = entry.total;
            summary.approvedCount = entry.count;
        } else if (entry._id === "Rejected") {
            summary.rejectedTotal = entry.total;
            summary.rejectedCount = entry.count;
        }
    }

    return {
        data: credits,
        summary,
        pagination: {
            total: totalCount,
            page: Number(page),
            limit: Number(limit),
            pages: totalPages,
        },
    };
};
