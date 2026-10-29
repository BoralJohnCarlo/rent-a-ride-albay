import Payment from "../models/Payment.js";
import ManualRefund from "../models/ManualRefund.js";

import {
    PAYMENT_TYPE,
    PAYMENT_STATUS,
    PAYMENT_REFUND_STATUS,
    MANUAL_REFUND_STATUS,
} from "../constants/paymentConstants.js";
import { BUSINESS_TIMEZONE } from "../utils/businessTime.js";

/*
 * Revenue from money customers pay ONLINE (or that an admin verified against
 * a Payment record): the reservation fee — the whole rental total for a
 * pay-in-full booking — and extension fees.
 *
 * The dashboard's revenue used to be built only from `Rental.payments`, which
 * holds what an admin typed in by hand. Every PayMongo payment lives in the
 * Payment collection instead, so none of it counted — including a
 * reservation fee the business KEPT after a cancellation. This adds it:
 *
 *   + payments received in the period, and
 *   - refunds on those payments, except ones a rental refund tracks.
 *
 * A refund made for a rental refund entry (its `gatewayPayment`) is already
 * subtracted through `Rental.refunds` (the payment-level refund is just how
 * that same money was sent back), so counting it here as well would take it
 * out twice. That is what the `rentalDocs` check below is for.
 *
 * A refund that ultimately failed is not subtracted (the money stayed);
 * one that is pending, held for review, or succeeded is (it is owed).
 */
const ONLINE_FEE_TYPES = [
    PAYMENT_TYPE.RESERVATION_FEE,
    PAYMENT_TYPE.EXTENSION_FEE,
];

/* Bucketed by Philippine calendar day, matching the statistics trend. */
const dayBucket = (field) => ({
    $dateToString: {
        date: field,
        format: "%Y-%m-%d",
        timezone: BUSINESS_TIMEZONE,
    },
});

/*
 * Scopes a Payment pipeline to bookings on the given vehicles (an operator's
 * dashboard). `null` means everything.
 */
const vehicleScopeStages = (vehicleIds) =>
    vehicleIds === null
        ? []
        : [
              {
                  $lookup: {
                      from: "bookings",
                      localField: "booking",
                      foreignField: "_id",
                      as: "scopeBooking",
                  },
              },
              {
                  $match: {
                      "scopeBooking.vehicle": {
                          $in: vehicleIds,
                      },
                  },
              },
          ];

const rangeMatch = (start, end) => ({
    $gte: start,
    ...(end ? { $lt: end } : {}),
});

const receivedPipeline = (
    start,
    end,
    vehicleIds,
    groupId
) => [
    {
        $match: {
            paymentType: {
                $in: ONLINE_FEE_TYPES,
            },
            status: {
                $in: [
                    PAYMENT_STATUS.VERIFIED,
                    PAYMENT_STATUS.REFUNDED,
                ],
            },
        },
    },
    {
        $addFields: {
            receivedAt: {
                $ifNull: [
                    "$processedAt",
                    "$createdAt",
                ],
            },
        },
    },
    {
        $match: {
            receivedAt: rangeMatch(start, end),
        },
    },
    ...vehicleScopeStages(vehicleIds),
    {
        $group: {
            _id: groupId,
            total: { $sum: "$amount" },
        },
    },
];

const refundedPipeline = (
    start,
    end,
    vehicleIds,
    groupId
) => [
    {
        $match: {
            paymentType: {
                $in: ONLINE_FEE_TYPES,
            },
            refund: { $ne: null },
            "refund.status": {
                $ne: PAYMENT_REFUND_STATUS.FAILED,
            },
            "refund.initiatedAt": rangeMatch(
                start,
                end
            ),
        },
    },
    {
        $lookup: {
            from: "rentals",
            localField: "booking",
            foreignField: "booking",
            as: "rentalDocs",
        },
    },
    // Skip only a refund some rental refund entry tracks (it's counted
    // through Rental.refunds). A pre-pickup refund on a booking that later
    // became a rental — e.g. a reschedule to fewer days — has no such entry.
    {
        $match: {
            $expr: {
                $not: {
                    $in: [
                        "$_id",
                        {
                            $reduce: {
                                input: "$rentalDocs",
                                initialValue: [],
                                in: {
                                    $concatArrays: [
                                        "$$value",
                                        {
                                            $ifNull: [
                                                "$$this.refunds.gatewayPayment",
                                                [],
                                            ],
                                        },
                                    ],
                                },
                            },
                        },
                    ],
                },
            },
        },
    },
    ...vehicleScopeStages(vehicleIds),
    {
        $group: {
            _id: groupId,
            total: { $sum: "$refund.amount" },
        },
    },
];

/*
 * Refunds owed by hand (see ManualRefund) — money going back that no payment
 * records. Counted from when they were raised, like a payment refund from
 * its initiation; one an admin marked "Not Paid" returned nothing.
 */
const manualRefundPipeline = (
    start,
    end,
    vehicleIds,
    groupId
) => [
    {
        $match: {
            status: { $ne: MANUAL_REFUND_STATUS.NOT_PAID },
            createdAt: rangeMatch(start, end),
        },
    },
    ...vehicleScopeStages(vehicleIds),
    {
        $group: {
            _id: groupId,
            total: { $sum: "$amount" },
        },
    },
];

/*
 * Online revenue for [start, end): what was received and what was refunded
 * outside of rental refunds. Net = received - refunded.
 */
export const getOnlineRevenueForRange = async (
    start,
    end,
    vehicleIds = null
) => {
    const [received, refunded, manual] =
        await Promise.all([
            Payment.aggregate(
                receivedPipeline(
                    start,
                    end,
                    vehicleIds,
                    null
                )
            ),
            Payment.aggregate(
                refundedPipeline(
                    start,
                    end,
                    vehicleIds,
                    null
                )
            ),
            ManualRefund.aggregate(
                manualRefundPipeline(
                    start,
                    end,
                    vehicleIds,
                    null
                )
            ),
        ]);

    return {
        received: received[0]?.total || 0,
        refunded:
            (refunded[0]?.total || 0) +
            (manual[0]?.total || 0),
    };
};

/*
 * The same figures bucketed by calendar day (UTC, matching the rest of the
 * revenue trend), as Maps keyed "YYYY-MM-DD". `end` is optional.
 */
export const getOnlineRevenueByDay = async (
    start,
    end = null,
    vehicleIds = null
) => {
    const [received, refunded, manual] =
        await Promise.all([
            Payment.aggregate(
                receivedPipeline(
                    start,
                    end,
                    vehicleIds,
                    dayBucket("$receivedAt")
                )
            ),
            Payment.aggregate(
                refundedPipeline(
                    start,
                    end,
                    vehicleIds,
                    dayBucket("$refund.initiatedAt")
                )
            ),
            ManualRefund.aggregate(
                manualRefundPipeline(
                    start,
                    end,
                    vehicleIds,
                    dayBucket("$createdAt")
                )
            ),
        ]);

    const refundedByDay = new Map(
        refunded.map((row) => [row._id, row.total])
    );

    for (const row of manual) {
        refundedByDay.set(
            row._id,
            (refundedByDay.get(row._id) || 0) + row.total
        );
    }

    return {
        received: new Map(
            received.map((row) => [
                row._id,
                row.total,
            ])
        ),
        refunded: refundedByDay,
    };
};
