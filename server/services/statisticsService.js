import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import Payment from "../models/Payment.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";

import {
    VEHICLE_STATUS,
} from "../constants/vehicleConstants.js";

import {
    PAYMENT_METHOD,
    PAYMENT_STATUS,
} from "../constants/paymentConstants.js";

import {
    RENTAL_PAYMENT_STATUS,
} from "../constants/rentalConstants.js";

import {
    getOnlineRevenueForRange,
    getOnlineRevenueByDay,
} from "./onlineRevenueService.js";

import { REFUND_IN_EFFECT_MATCH } from "../utils/refundUtils.js";

import {
    BUSINESS_TIMEZONE,
    addDaysToDateKey,
    businessDayStart,
    listDateKeys,
    toBusinessDateKey,
} from "../utils/businessTime.js";


const getOperatorVehicleIds = async (
    operatorId
) => {
    const vehicles =
        await Vehicle.find({
            operator: operatorId,
        })
            .select("_id")
            .lean();

    return vehicles.map(
        (vehicle) => vehicle._id
    );
};


/* Periods start at a Philippine-time midnight (see utils/businessTime). */
const getDateRange = (period) => {
    const now = new Date();
    const todayKey = toBusinessDateKey(now);

    let startKey;

    switch (period) {
        case "7d":
            startKey = addDaysToDateKey(todayKey, -7);
            break;

        case "month":
            startKey = `${todayKey.slice(0, 7)}-01`;
            break;

        case "year":
            startKey = `${todayKey.slice(0, 4)}-01-01`;
            break;

        case "30d":
        default:
            startKey = addDaysToDateKey(todayKey, -30);
    }

    return {
        start: businessDayStart(startKey),
        end: now,
    };
};


/*
 * The window immediately preceding the current period, for comparison.
 *
 * "month"/"year" get the full previous calendar month/year — their
 * current-period window is "since the 1st up to now", which grows
 * throughout the month/year, so mirroring its (variable) length would
 * make the comparison window shrink to near-nothing early on. "7d"/"30d"
 * are already a fixed duration, so the previous window of the same
 * length is a fair like-for-like comparison.
 */
const getPreviousDateRange = (period) => {
    const todayKey = toBusinessDateKey();
    const year = Number(todayKey.slice(0, 4));
    const month = Number(todayKey.slice(5, 7));

    if (period === "month") {
        const previousYear = month === 1 ? year - 1 : year;
        const previousMonth = month === 1 ? 12 : month - 1;

        return {
            start: businessDayStart(
                `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`
            ),
            end: businessDayStart(`${todayKey.slice(0, 7)}-01`),
        };
    }

    if (period === "year") {
        return {
            start: businessDayStart(`${year - 1}-01-01`),
            end: businessDayStart(`${year}-01-01`),
        };
    }

    const { start, end } = getDateRange(period);
    const duration = end.getTime() - start.getTime();

    return {
        start: new Date(start.getTime() - duration),
        end: start,
    };
};

const getRevenueForRange = async (
    start,
    end,
    vehicleIds = null
) => {
    const vehicleFilter =
        vehicleIds !== null
            ? { vehicle: { $in: vehicleIds } }
            : {};

    const [paymentsResult, refundsResult, online] =
        await Promise.all([
            Rental.aggregate([
                { $unwind: "$payments" },
                {
                    $match: {
                        "payments.paymentDate": {
                            $gte: start,
                            $lt: end,
                        },

                        "payments.status":
                            RENTAL_PAYMENT_STATUS.VERIFIED,

                        ...vehicleFilter,
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$payments.amount" },
                    },
                },
            ]),

            /* Refunds approved within the range are real money paid back
               out and must reduce revenue for that range, the same way
               they already reduce a rental's own financial.balance. */
            Rental.aggregate([
                { $unwind: "$refunds" },
                {
                    $match: {
                        "refunds.processedAt": {
                            $gte: start,
                            $lt: end,
                        },

                        ...REFUND_IN_EFFECT_MATCH,

                        ...vehicleFilter,
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: "$refunds.amount" },
                    },
                },
            ]),

            /* Money paid online (GCash/PayMongo reservation, pay-in-full and
               extension fees) is not in Rental.payments at all, so it is
               added separately — net of refunds on bookings that never
               became a rental (see onlineRevenueService). */
            getOnlineRevenueForRange(
                start,
                end,
                vehicleIds
            ),
        ]);

    const paymentsTotal =
        paymentsResult.length > 0
            ? paymentsResult[0].total
            : 0;

    const refundsTotal =
        refundsResult.length > 0
            ? refundsResult[0].total
            : 0;

    return (
        paymentsTotal -
        refundsTotal +
        online.received -
        online.refunded
    );
};

const calculateGrowthPercent = (current, previous) => {
    if (previous > 0) {
        return (
            Math.round(
                ((current - previous) / previous) * 1000
            ) / 10
        );
    }

    return current > 0 ? 100 : 0;
};

const getOverviewStats = async (
    period,
    vehicleIds = null
) => {
    const { start, end } =
        getDateRange(period);

    const previousRange =
        getPreviousDateRange(period);

    const vehicleFilter =
        vehicleIds !== null
            ? {
                  vehicle: {
                      $in: vehicleIds,
                  },
              }
            : {};

    const bookingFilter = {
        createdAt: {
            $gte: start,
        },
        ...vehicleFilter,
    };

    /*
     * For operator statistics we need
     * booking/customer/payment scope.
     */
    let operatorBookingIds = null;

    if (vehicleIds !== null) {
        operatorBookingIds =
            await Booking.find(
                bookingFilter
            )
                .select("_id customer")
                .lean();
    }

    const bookingIds =
        vehicleIds !== null
            ? operatorBookingIds.map(
                  (booking) =>
                      booking._id
              )
            : null;

    const customerIds =
        vehicleIds !== null
            ? [
                  ...new Set(
                      operatorBookingIds
                          .map(
                              (booking) =>
                                  booking.customer?.toString()
                          )
                          .filter(Boolean)
                  ),
              ]
            : null;

    const paymentFilter =
        vehicleIds !== null
            ? {
                  booking: {
                      $in: bookingIds,
                  },
                  createdAt: {
                      $gte: start,
                  },
              }
            : {
                  createdAt: {
                      $gte: start,
                  },
              };

    const [
        totalBookings,
        totalRentals,
        totalRevenue,
        previousRevenue,
        totalVehicles,
        totalCustomers,
        pendingPayments,
        verifiedPayments,
    ] = await Promise.all([
        Booking.countDocuments(
            bookingFilter
        ),

        Rental.countDocuments({
            createdAt: {
                $gte: start,
            },
            ...vehicleFilter,
        }),

        getRevenueForRange(
            start,
            end,
            vehicleIds
        ),

        getRevenueForRange(
            previousRange.start,
            previousRange.end,
            vehicleIds
        ),

        Vehicle.countDocuments({
            status: { $ne: VEHICLE_STATUS.ARCHIVED },
            ...(vehicleIds !== null
                ? { _id: { $in: vehicleIds } }
                : {}),
        }),

        vehicleIds !== null
            ? User.countDocuments({
                  _id: {
                      $in: customerIds,
                  },
                  role: "customer",
              })
            : User.countDocuments({
                  role: "customer",
              }),

        /* "Awaiting review" is the whole current queue (as the sidebar
           badge counts it), not only payments opened this period. */
        vehicleIds !== null
            ? Booking.distinct("_id", {
                  vehicle: { $in: vehicleIds },
              }).then((operatorBookings) =>
                  Payment.countDocuments({
                      booking: { $in: operatorBookings },
                      status: PAYMENT_STATUS.PENDING,
                  })
              )
            : Payment.countDocuments({
                  status: PAYMENT_STATUS.PENDING,
              }),

        Payment.countDocuments({
            ...paymentFilter,
            status:
                PAYMENT_STATUS.VERIFIED,
        }),
    ]);

    const revenueGrowth = calculateGrowthPercent(
        totalRevenue,
        previousRevenue
    );

    return {
        totalBookings,
        totalRentals,
        totalRevenue,
        revenueGrowth,
        totalVehicles,
        totalCustomers,
        pendingPayments,
        verifiedPayments,
    };
};


const getRevenueTrend = async (
    period,
    vehicleIds = null
) => {
    const { start, end } =
        getDateRange(period);

    const vehicleFilter =
        vehicleIds !== null
            ? { vehicle: { $in: vehicleIds } }
            : {};

    const [paymentsTrend, refundsTrend, onlineTrend] =
        await Promise.all([
            Rental.aggregate([
                { $unwind: "$payments" },

                {
                    $match: {
                        "payments.paymentDate": {
                            $gte: start,
                        },

                        "payments.status":
                            RENTAL_PAYMENT_STATUS.VERIFIED,

                        ...vehicleFilter,
                    },
                },

                {
                    $group: {
                        _id: {
                            $dateToString: {
                                date: "$payments.paymentDate",
                                format: "%Y-%m-%d",
                                timezone: BUSINESS_TIMEZONE,
                            },
                        },

                        total: {
                            $sum: "$payments.amount",
                        },
                    },
                },
            ]),

            /* Approved refunds dip the trend on the day they were
               processed — otherwise a refund-heavy day would look
               identical to a quiet one with no activity at all. */
            Rental.aggregate([
                { $unwind: "$refunds" },

                {
                    $match: {
                        "refunds.processedAt": {
                            $gte: start,
                        },

                        ...REFUND_IN_EFFECT_MATCH,

                        ...vehicleFilter,
                    },
                },

                {
                    $group: {
                        _id: {
                            $dateToString: {
                                date: "$refunds.processedAt",
                                format: "%Y-%m-%d",
                                timezone: BUSINESS_TIMEZONE,
                            },
                        },

                        total: {
                            $sum: "$refunds.amount",
                        },
                    },
                },
            ]),

            /* Online payments (and refunds on bookings that never became a
               rental) per day — see onlineRevenueService. */
            getOnlineRevenueByDay(
                start,
                null,
                vehicleIds
            ),
        ]);

    const refundsByDate = new Map(
        refundsTrend.map((item) => [
            item._id,
            item.total,
        ])
    );

    const paymentsByDate = new Map(
        paymentsTrend.map((item) => [
            item._id,
            item.total,
        ])
    );

    /*
     * Every calendar day in the range gets its own point (defaulting to 0
     * revenue), not just days that had activity. Skipping quiet days
     * entirely - the previous behavior - squeezes a burst of transactions
     * across a handful of days into a small slice of the chart's evenly-
     * spaced category axis while silently dropping everything else,
     * distorting the trend line into what looks like a rendering glitch.
     */
    const days = listDateKeys(
        toBusinessDateKey(start),
        toBusinessDateKey(end)
    );

    return days.map((date) => ({
        date,
        revenue:
            (paymentsByDate.get(date) || 0) -
            (refundsByDate.get(date) || 0) +
            (onlineTrend.received.get(date) || 0) -
            (onlineTrend.refunded.get(date) || 0),
    }));
};


const getBookingStatusBreakdown =
    async (
        period,
        vehicleIds = null
    ) => {
        const { start } =
            getDateRange(period);

        const match = {
            createdAt: {
                $gte: start,
            },
        };

        if (vehicleIds !== null) {
            match.vehicle = {
                $in: vehicleIds,
            };
        }

        const breakdown =
            await Booking.aggregate([
                {
                    $match: match,
                },

                {
                    $group: {
                        _id: "$status",
                        count: {
                            $sum: 1,
                        },
                    },
                },
            ]);

        const statusLabels = {
            [BOOKING_STATUS.PENDING]:
                "Pending",

            [BOOKING_STATUS.APPROVED]:
                "Approved",

            [BOOKING_STATUS.ONGOING]:
                "Ongoing",

            [BOOKING_STATUS.COMPLETED]:
                "Completed",

            [BOOKING_STATUS.CANCELLED]:
                "Cancelled",

            [BOOKING_STATUS.REJECTED]:
                "Rejected",

            [BOOKING_STATUS.EXPIRED]:
                "Expired",

            [BOOKING_STATUS.NO_SHOW]:
                "No Show",
        };

        return breakdown.map(
            (item) => ({
                name:
                    statusLabels[
                        item._id
                    ] ||
                    item._id,

                value: item.count,
            })
        );
    };


const getPaymentMethodBreakdown =
    async (
        period,
        vehicleIds = null
    ) => {
        const { start } =
            getDateRange(period);

        const match = {
            createdAt: {
                $gte: start,
            },

            status:
                PAYMENT_STATUS.VERIFIED,
        };

        if (vehicleIds !== null) {
            const bookingIds =
                await Booking.find({
                    createdAt: {
                        $gte: start,
                    },

                    vehicle: {
                        $in: vehicleIds,
                    },
                })
                    .select("_id")
                    .lean();

            match.booking = {
                $in: bookingIds.map(
                    (booking) =>
                        booking._id
                ),
            };
        }

        const breakdown =
            await Payment.aggregate([
                {
                    $match: match,
                },

                {
                    $group: {
                        _id:
                            "$paymentMethod",

                        count: {
                            $sum: 1,
                        },

                        total: {
                            $sum: "$amount",
                        },
                    },
                },
            ]);

        const methodLabels = {
            [PAYMENT_METHOD.GCASH]:
                "GCash",

            [PAYMENT_METHOD.CASH_ON_PICKUP]:
                "Cash on Pickup",
        };

        return breakdown.map(
            (item) => ({
                name:
                    methodLabels[
                        item._id
                    ] ||
                    item._id,

                value: item.count,
                amount: item.total,
            })
        );
    };


const getVehicleStatusBreakdown =
    async (vehicleIds = null) => {
        const match = {
            status: { $ne: VEHICLE_STATUS.ARCHIVED },
        };

        if (vehicleIds !== null) {
            match._id = {
                $in: vehicleIds,
            };
        }

        const breakdown =
            await Vehicle.aggregate([
                {
                    $match: match,
                },

                {
                    $group: {
                        _id: "$status",
                        count: {
                            $sum: 1,
                        },
                    },
                },
            ]);

        const statusLabels = {
            [VEHICLE_STATUS.AVAILABLE]:
                "Available",

            [VEHICLE_STATUS.RESERVED]:
                "Reserved",

            [VEHICLE_STATUS.PICKUP_IN_PROGRESS]:
                "Pickup In Progress",

            [VEHICLE_STATUS.RENTED]:
                "Rented",

            [VEHICLE_STATUS.MAINTENANCE]:
                "Maintenance",

            [VEHICLE_STATUS.EXPIRED_REGISTRATION]:
                "Registration Expired",

            [VEHICLE_STATUS.ARCHIVED]:
                "Archived",
        };

        return breakdown.map(
            (item) => ({
                name:
                    statusLabels[
                        item._id
                    ] ||
                    item._id,

                value: item.count,
            })
        );
    };


const getTopVehicles = async (
    period,
    vehicleIds = null
) => {
    const { start } =
        getDateRange(period);

    /* Rejected / cancelled / expired / no-show bookings never became a
       trip, so they don't make a vehicle "top performing". */
    const match = {
        createdAt: {
            $gte: start,
        },
        status: {
            $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
        },
    };

    if (vehicleIds !== null) {
        match.vehicle = {
            $in: vehicleIds,
        };
    }

    const topVehicles =
        await Booking.aggregate([
            {
                $match: match,
            },

            {
                $group: {
                    _id: "$vehicle",

                    bookings: {
                        $sum: 1,
                    },

                    revenue: {
                        $sum:
                            "$pricing.totalAmount",
                    },
                },
            },

            {
                $sort: {
                    bookings: -1,
                },
            },

            {
                $limit: 5,
            },

            {
                $lookup: {
                    from: "vehicles",

                    localField: "_id",

                    foreignField: "_id",

                    as: "vehicle",
                },
            },

            {
                $addFields: {
                    vehicle: {
                        $arrayElemAt: [
                            "$vehicle",
                            0,
                        ],
                    },
                },
            },

            {
                $project: {
                    _id: 1,
                    bookings: 1,
                    revenue: 1,

                    vehicle: {
                        _id: 1,
                        brand: 1,
                        model: 1,
                        vehicleCode: 1,
                        plateNumber: 1,
                        images: 1,
                    },
                },
            },
        ]);

    return topVehicles.map(
        (item) => ({
            _id: item._id,

            bookings:
                item.bookings,

            revenue:
                item.revenue,

            vehicle:
                item.vehicle
                    ? {
                          _id:
                              item
                                  .vehicle
                                  ._id,

                          brand:
                              item
                                  .vehicle
                                  .brand,

                          model:
                              item
                                  .vehicle
                                  .model,

                          vehicleCode:
                              item
                                  .vehicle
                                  .vehicleCode,

                          plateNumber:
                              item
                                  .vehicle
                                  .plateNumber,

                          images:
                              item
                                  .vehicle
                                  .images || [],
                      }
                    : null,
        })
    );
};


const getStatisticsData = async (
    period = "30d",
    userRole = "admin",
    userId = null
) => {
    let vehicleIds = null;

    /*
     * ADMIN
     * -------
     * vehicleIds remains null, meaning
     * statistics are system-wide.
     *
     * OPERATOR
     * --------
     * vehicleIds contains only vehicles
     * assigned to this operator.
     */
    if (
        userRole === "operator" &&
        userId !== null
    ) {
        vehicleIds =
            await getOperatorVehicleIds(
                userId
            );
    }

    const isOperator = vehicleIds !== null;

    const [
        overview,
        revenueTrend,
        bookingStatus,
        paymentMethods,
        vehicleStatus,
        topVehicles,
    ] = await Promise.all([
        getOverviewStats(
            period,
            vehicleIds
        ),

        getRevenueTrend(
            period,
            vehicleIds
        ),

        getBookingStatusBreakdown(
            period,
            vehicleIds
        ),

        /* How customers paid is the platform's business, not a
           partner's - they're paid out through payouts, not per method. */
        isOperator
            ? []
            : getPaymentMethodBreakdown(
                  period,
                  vehicleIds
              ),

        getVehicleStatusBreakdown(
            vehicleIds
        ),

        getTopVehicles(
            period,
            vehicleIds
        ),
    ]);

    /* Customer headcount and the payment-verification queue are admin
       concerns; a partner only gets their own bookings/rentals/revenue. */
    if (isOperator) {
        delete overview.totalCustomers;
        delete overview.pendingPayments;
        delete overview.verifiedPayments;
    }

    return {
        period,
        overview,
        revenueTrend,
        bookingStatus,
        paymentMethods,
        vehicleStatus,
        topVehicles,
    };
};


export {
    getStatisticsData,
    getRevenueForRange,
    getDateRange,
};