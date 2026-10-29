import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import Consignment from "../models/Consignment.js";
import PendingVehicle from "../models/PendingVehicle.js";
import Alert from "../models/Alert.js";
import Payment from "../models/Payment.js";
import {
    BOOKING_STATUS,
    BOOKING_EXTENSION_STATUS,
    BOOKING_RESCHEDULE_STATUS,
} from "../constants/bookingConstants.js";
import {
    RENTAL_REFUND_STATUS,
    RENTAL_EARLY_RETURN_STATUS,
} from "../constants/rentalConstants.js";
import {
    VEHICLE_STATUS,
} from "../constants/vehicleConstants.js";
import {
    CONSIGNMENT_STATUS,
} from "../constants/consignmentConstants.js";
import {
    ALERT_STATUS,
} from "../constants/alertConstants.js";
import {
    PAYMENT_STATUS,
} from "../constants/paymentConstants.js";
import { getRevenueForRange } from "./statisticsService.js";
import { getUnreadSummary } from "./supportTicketService.js";
import {
    businessDayStart,
    toBusinessDateKey,
} from "../utils/businessTime.js";

const getOperatorVehicleIds = async (
    operatorId
) => {
    const vehicles = await Vehicle.find({
        operator: operatorId,
    })
        .select("_id")
        .lean();

    return vehicles.map(
        (vehicle) => vehicle._id
    );
};

const getFleetSummary = async (
    vehicleIds = null
) => {
    const match = {};

    if (vehicleIds !== null) {
        match._id = { $in: vehicleIds };
    }

    const result = await Vehicle.aggregate([
        {
            $match: match,
        },
        {
            $group: {
                _id: "$status",
                count: { $sum: 1 },
            },
        },
    ]);

    const summary = {
        available: 0,
        reserved: 0,
        pickupInProgress: 0,
        rented: 0,
        maintenance: 0,
        expiredRegistration: 0,
    };

    result.forEach((item) => {
        if (item._id === VEHICLE_STATUS.AVAILABLE) {
            summary.available = item.count;
        } else if (
            item._id === VEHICLE_STATUS.RESERVED
        ) {
            summary.reserved = item.count;
        } else if (
            item._id ===
            VEHICLE_STATUS.PICKUP_IN_PROGRESS
        ) {
            summary.pickupInProgress = item.count;
        } else if (
            item._id === VEHICLE_STATUS.RENTED
        ) {
            summary.rented = item.count;
        } else if (
            item._id === VEHICLE_STATUS.MAINTENANCE
        ) {
            summary.maintenance = item.count;
        } else if (
            item._id ===
            VEHICLE_STATUS.EXPIRED_REGISTRATION
        ) {
            summary.expiredRegistration = item.count;
        }
    });

    return summary;
};

const getRecentBookings = async (
    vehicleIds = null,
    includeCustomerEmail = true
) => {
    const query = {};

    if (vehicleIds !== null) {
        query.vehicle = { $in: vehicleIds };
    }

    const bookings = await Booking.find(query)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("customer", "firstName lastName email")
        .populate("vehicle", "vehicleCode brand model plateNumber")
        .lean();

    return bookings.map((booking) => ({
        _id: booking._id,
        bookingCode: booking.bookingCode,
        bookingNumber: booking.bookingCode,
        customer: booking.customer
            ? {
                  _id: booking.customer._id,
                  firstName: booking.customer.firstName,
                  lastName: booking.customer.lastName,
                  ...(includeCustomerEmail
                      ? { email: booking.customer.email }
                      : {}),
              }
            : null,
        vehicle: booking.vehicle
            ? {
                  _id: booking.vehicle._id,
                  vehicleCode: booking.vehicle.vehicleCode,
                  brand: booking.vehicle.brand,
                  model: booking.vehicle.model,
                  plateNumber: booking.vehicle.plateNumber,
              }
            : null,
        status: booking.status,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalAmount: booking.pricing?.totalAmount || 0,
        createdAt: booking.createdAt,
    }));
};

/*
 * "Revenue — This month" quick stat. Delegates to the statistics service's
 * range calculation (verified rental payments − refunds + net online
 * payments) so it always matches the Revenue widget's "This Month" figure —
 * it used to count still-pending rental payments as well.
 */
const getMonthlyRevenue = async (
    vehicleIds = null
) => {
    const startOfMonth = businessDayStart(
        `${toBusinessDateKey().slice(0, 7)}-01`
    );

    return getRevenueForRange(
        startOfMonth,
        new Date(),
        vehicleIds
    );
};

const getRecentPayments = async (
    vehicleIds = null
) => {
    const match = {
        "payments.status": {
            $ne: "Rejected",
        },
    };

    if (vehicleIds !== null) {
        match.vehicle = { $in: vehicleIds };
    }

    const payments = await Rental.aggregate([
        { $unwind: "$payments" },
        {
            $match: match,
        },
        { $sort: { "payments.paymentDate": -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: "users",
                localField: "customer",
                foreignField: "_id",
                as: "customer",
            },
        },
        {
            $addFields: {
                customer: { $arrayElemAt: ["$customer", 0] },
            },
        },
        {
            $lookup: {
                from: "vehicles",
                localField: "vehicle",
                foreignField: "_id",
                as: "vehicle",
            },
        },
        {
            $addFields: {
                vehicle: { $arrayElemAt: ["$vehicle", 0] },
            },
        },
        {
            $project: {
                _id: 1,
                rentalCode: 1,
                payment: "$payments",
                customer: {
                    _id: "$customer._id",
                    firstName: "$customer.firstName",
                    lastName: "$customer.lastName",
                    email: "$customer.email",
                },
                vehicle: {
                    _id: "$vehicle._id",
                    brand: "$vehicle.brand",
                    model: "$vehicle.model",
                    plateNumber: "$vehicle.plateNumber",
                },
            },
        },
    ]);

    const rentalPayments = payments.map((p) => ({
        _id: p._id,
        rentalCode: p.rentalCode,
        transactionId: p.payment.reference || p._id.toString(),
        reference: p.payment.reference || p.rentalCode || p._id.toString(),
        amount: p.payment.amount,
        status: p.payment.status,
        paymentMethod: p.payment.paymentMethod,
        type: p.payment.type,
        createdAt: p.payment.paymentDate,
        customer: p.customer,
        vehicle: p.vehicle,
    }));

    const onlinePayments = await getRecentOnlinePayments(vehicleIds);

    return [...rentalPayments, ...onlinePayments]
        .sort(
            (a, b) =>
                new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
        .slice(0, 5);
};

/* Title-case the Payment collection's uppercase statuses to match the
   rental payment rows they're listed beside. */
const ONLINE_STATUS_LABELS = {
    [PAYMENT_STATUS.VERIFIED]: "Verified",
    [PAYMENT_STATUS.REFUNDED]: "Refunded",
};

/*
 * Online (GCash/PayMongo) payments live in the Payment collection, never in
 * Rental.payments, so the Recent Payments card has to read them separately.
 * Only money that actually moved is listed — a PENDING Payment is just an
 * opened (often abandoned) checkout, and CANCELLED never charged anything.
 */
const getRecentOnlinePayments = async (
    vehicleIds = null
) => {
    const query = {
        status: {
            $in: [
                PAYMENT_STATUS.VERIFIED,
                PAYMENT_STATUS.REFUNDED,
            ],
        },
    };

    if (vehicleIds !== null) {
        query.booking = {
            $in: await Booking.distinct("_id", {
                vehicle: { $in: vehicleIds },
            }),
        };
    }

    const payments = await Payment.find(query)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("customer", "firstName lastName email")
        .populate({
            path: "booking",
            select: "bookingCode vehicle",
            populate: {
                path: "vehicle",
                select: "brand model plateNumber",
            },
        })
        .lean();

    return payments.map((payment) => ({
        _id: payment._id,
        transactionId:
            payment.paymongo?.paymentId || payment._id.toString(),
        reference:
            payment.booking?.bookingCode || payment._id.toString(),
        amount: payment.amount,
        status:
            ONLINE_STATUS_LABELS[payment.status] || payment.status,
        paymentMethod: payment.paymentMethod,
        type: payment.paymentType,
        createdAt:
            payment.verification?.verifiedAt || payment.createdAt,
        customer: payment.customer
            ? {
                  _id: payment.customer._id,
                  firstName: payment.customer.firstName,
                  lastName: payment.customer.lastName,
                  email: payment.customer.email,
              }
            : null,
        vehicle: payment.booking?.vehicle
            ? {
                  _id: payment.booking.vehicle._id,
                  brand: payment.booking.vehicle.brand,
                  model: payment.booking.vehicle.model,
                  plateNumber: payment.booking.vehicle.plateNumber,
              }
            : null,
    }));
};

const getDashboardStats = async (
    userRole = "admin",
    userId = null
) => {
    let vehicleIds = null;

    if (
        userRole === "operator" &&
        userId !== null
    ) {
        vehicleIds = await getOperatorVehicleIds(
            userId
        );
    }

    /*
     * A partner sees their own vehicles' bookings and fleet, but not the
     * platform's cash flow: customer payment transactions and gross revenue
     * (what customers paid, before the platform's commission) are admin
     * concerns. Their own money is their payouts/wallet, which the partner
     * dashboard reads from the payout endpoints instead.
     */
    const isOperator = userRole === "operator";

    const [
        totalUsers,
        totalVehicles,
        activeBookings,
        fleetSummary,
        recentBookings,
        monthlyRevenue,
        recentPayments,
    ] = await Promise.all([
        userRole === "admin"
            ? User.countDocuments()
            : 0,

        /* Archived vehicles are retired — not part of the fleet. */
        Vehicle.countDocuments({
            status: { $ne: VEHICLE_STATUS.ARCHIVED },
            ...(vehicleIds !== null
                ? { _id: { $in: vehicleIds } }
                : {}),
        }),

        /* Every booking still in play: awaiting review (incl. already
           paid), approved and waiting for pickup, or on the road. */
        Booking.countDocuments({
            status: {
                $in: [
                    BOOKING_STATUS.PENDING,
                    BOOKING_STATUS.PAYMENT_RECEIVED,
                    BOOKING_STATUS.APPROVED,
                    BOOKING_STATUS.ONGOING,
                ],
            },
            ...(vehicleIds !== null
                ? { vehicle: { $in: vehicleIds } }
                : {}),
        }),

        getFleetSummary(vehicleIds),
        getRecentBookings(vehicleIds, !isOperator),
        isOperator ? 0 : getMonthlyRevenue(vehicleIds),
        isOperator ? [] : getRecentPayments(vehicleIds),
    ]);

    const stats = [
        {
            key: "users",
            value: totalUsers,
            title: "Total Users",
            subtitle: "Registered users",
            color: "blue",
        },
        {
            key: "vehicles",
            value: totalVehicles,
            title: "Vehicles",
            subtitle: "Fleet inventory",
            color: "green",
        },
        {
            key: "bookings",
            value: activeBookings,
            title: "Active Bookings",
            subtitle: "Pending, approved or ongoing",
            color: "yellow",
        },
        {
            key: "revenue",
            value: monthlyRevenue,
            title: "Revenue",
            subtitle: "This month",
            color: "purple",
        },
    ];

    const filteredStats = isOperator
        ? stats.filter(
              (stat) =>
                  stat.key !== "users" && stat.key !== "revenue"
          )
        : stats;

    return {
        stats: filteredStats,
        revenue: {
            total: monthlyRevenue,
        },
        fleetSummary,
        recentBookings,
        recentPayments,
    };
};

/*
 * Mirrors Bookings.jsx's actionCount (AWAITING_REVIEW_STATUSES +
 * hasPendingExtension + hasPendingEarlyReturnCredit), deduplicated the same
 * way — a booking with a pending extension AND a pending early-return
 * credit still only counts once.
 */
const getPendingBookingsCount = async () => {
    const [statusOrExtensionIds, earlyReturnBookingIds] =
        await Promise.all([
            Booking.find({
                $or: [
                    {
                        status: {
                            $in: [
                                BOOKING_STATUS.PENDING,
                                BOOKING_STATUS.PAYMENT_RECEIVED,
                            ],
                        },
                    },
                    {
                        extensions: {
                            $elemMatch: {
                                status: BOOKING_EXTENSION_STATUS.PENDING,
                            },
                        },
                    },
                    {
                        reschedules: {
                            $elemMatch: {
                                status: BOOKING_RESCHEDULE_STATUS.PENDING,
                            },
                        },
                    },
                ],
            })
                .select("_id")
                .lean(),

            Rental.find({
                "earlyReturn.detected": true,
                "earlyReturn.status": RENTAL_EARLY_RETURN_STATUS.PENDING,
            }).distinct("booking"),
        ]);

    const ids = new Set(
        statusOrExtensionIds.map((booking) => booking._id.toString())
    );

    earlyReturnBookingIds
        .filter(Boolean)
        .forEach((id) => ids.add(id.toString()));

    return ids.size;
};

const getPendingFinancialsCount = async () => {
    const [pendingRefunds, pendingEarlyReturns, pendingPayments] =
        await Promise.all([
            Rental.aggregate([
                { $match: { "refunds.0": { $exists: true } } },
                {
                    $unwind: {
                        path: "$refunds",
                        preserveNullAndEmptyArrays: false,
                    },
                },
                {
                    $match: {
                        "refunds.status": RENTAL_REFUND_STATUS.PENDING,
                    },
                },
                { $count: "count" },
            ]),

            Rental.aggregate([
                {
                    $match: {
                        "earlyReturn.detected": true,
                        "earlyReturn.status":
                            RENTAL_EARLY_RETURN_STATUS.PENDING,
                    },
                },
                { $count: "count" },
            ]),

            /*
             * A separate, top-level Payment collection (its own PAYMENT_STATUS
             * enum, uppercase - not the title-case RENTAL_PAYMENT_STATUS used
             * by Rental.payments[]) backs the Payments sub-tab's "Awaiting
             * verification" KPI, which admins clear via Force Verify /
             * reconcilePayment - a real pending queue like the other two.
             */
            Payment.countDocuments({ status: PAYMENT_STATUS.PENDING }),
        ]);

    const refundsCount =
        pendingRefunds.length > 0 ? pendingRefunds[0].count : 0;
    const earlyReturnsCount =
        pendingEarlyReturns.length > 0 ? pendingEarlyReturns[0].count : 0;

    return refundsCount + earlyReturnsCount + pendingPayments;
};

/*
 * An operator can request an inspection reschedule (reschedule.status:
 * "Pending") while their application is still application.status "Pending"
 * (see requestReschedule in consignmentService.js, which allows this for
 * both Pending and Under Review) - only an admin can approve/reject it
 * (approveRescheduleCtrl/rejectRescheduleCtrl are admin-only). That overlap
 * means a plain sum of the two counts could double-count the same
 * consignment, so - same as getPendingBookingsCount above - this unions
 * distinct ids instead.
 */
const getPendingConsignmentsCount = async () => {
    const [
        applicationIds,
        rescheduleIds,
        pendingVehicles,
    ] = await Promise.all([
        Consignment.find({
            "application.status": CONSIGNMENT_STATUS.PENDING,
        })
            .select("_id")
            .lean(),

        Consignment.find({ "reschedule.status": "Pending" })
            .select("_id")
            .lean(),

        PendingVehicle.countDocuments({ status: "pending_review" }),
    ]);

    const ids = new Set(
        applicationIds.map((doc) => doc._id.toString())
    );

    rescheduleIds.forEach((doc) => ids.add(doc._id.toString()));

    return ids.size + pendingVehicles;
};

const getActiveAlertsCount = async () =>
    Alert.countDocuments({ status: ALERT_STATUS.ACTIVE });

const getOperatorRevisionRequestedCount = async (operatorId) =>
    Consignment.countDocuments({
        "application.status": CONSIGNMENT_STATUS.REVISION_REQUESTED,
        "audit.createdBy": operatorId,
    });

/*
 * Powers the sidebar's per-icon activity badges — a small, cheap, role-aware
 * summary polled from the layout, kept separate from getDashboardStats
 * (which serves the heavier Dashboard page itself) so polling it every 30s
 * doesn't repeatedly pay for fleet/revenue aggregation nobody's looking at.
 */
const getActivitySummary = async (
    userRole = "admin",
    userId = null
) => {
    if (userRole === "operator") {
        const consignments = userId
            ? await getOperatorRevisionRequestedCount(userId)
            : 0;

        return { consignments };
    }

    const [bookings, financials, consignments, gpsAlerts, support] =
        await Promise.all([
            getPendingBookingsCount(),
            getPendingFinancialsCount(),
            getPendingConsignmentsCount(),
            getActiveAlertsCount(),
            getUnreadSummary({ role: "admin" }).then(
                (summary) => summary.unread
            ),
        ]);

    return { bookings, financials, consignments, gpsAlerts, support };
};

export {
    getDashboardStats,
    getActivitySummary,
    getMonthlyRevenue,
};
