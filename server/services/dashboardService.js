import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import Booking from "../models/Booking.js";
import Rental from "../models/Rental.js";
import VehicleOwner from "../models/VehicleOwner.js";
import {
    BOOKING_STATUS,
} from "../constants/bookingConstants.js";
import {
    VEHICLE_STATUS,
} from "../constants/vehicleConstants.js";

const getOperatorVehicleIds = async (
    operatorId
) => {
    const ownerIds = await VehicleOwner.find({
        operator: operatorId,
    })
        .select("_id")
        .lean();

    if (!ownerIds.length) {
        return [];
    }

    const vehicles = await Vehicle.find({
        owner: {
            $in: ownerIds.map(
                (owner) => owner._id
            ),
        },
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
        rented: 0,
        maintenance: 0,
    };

    result.forEach((item) => {
        if (item._id === VEHICLE_STATUS.AVAILABLE) {
            summary.available = item.count;
        } else if (
            item._id === VEHICLE_STATUS.RESERVED
        ) {
            summary.reserved = item.count;
        } else if (
            item._id === VEHICLE_STATUS.RENTED
        ) {
            summary.rented = item.count;
        } else if (
            item._id === VEHICLE_STATUS.MAINTENANCE
        ) {
            summary.maintenance = item.count;
        }
    });

    return summary;
};

const getRecentBookings = async (
    vehicleIds = null
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
                  email: booking.customer.email,
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

const getMonthlyRevenue = async (
    vehicleIds = null
) => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const match = {
        "payments.paymentDate": {
            $gte: startOfMonth,
        },
        "payments.status": {
            $ne: "Rejected",
        },
    };

    if (vehicleIds !== null) {
        match.vehicle = { $in: vehicleIds };
    }

    const result = await Rental.aggregate([
        { $unwind: "$payments" },
        {
            $match: match,
        },
        {
            $group: {
                _id: null,
                total: { $sum: "$payments.amount" },
            },
        },
    ]);

    return result.length > 0 ? result[0].total : 0;
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

    return payments.map((p) => ({
        _id: p._id,
        rentalCode: p.rentalCode,
        transactionId: p.payment.reference || p._id.toString(),
        reference: p.payment.reference || p._id.toString(),
        amount: p.payment.amount,
        status: p.payment.status,
        paymentMethod: p.payment.paymentMethod,
        type: p.payment.type,
        createdAt: p.payment.paymentDate,
        customer: p.customer,
        vehicle: p.vehicle,
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

        vehicleIds !== null
            ? Vehicle.countDocuments({
                  _id: { $in: vehicleIds },
              })
            : Vehicle.countDocuments(),

        Booking.countDocuments({
            status: {
                $in: [
                    BOOKING_STATUS.PENDING,
                    BOOKING_STATUS.APPROVED,
                    BOOKING_STATUS.ONGOING,
                ],
            },
            ...(vehicleIds !== null
                ? { vehicle: { $in: vehicleIds } }
                : {}),
        }),

        getFleetSummary(vehicleIds),
        getRecentBookings(vehicleIds),
        getMonthlyRevenue(vehicleIds),
        getRecentPayments(vehicleIds),
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
            subtitle: "Currently rented",
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

    const filteredStats =
        userRole === "operator"
            ? stats.filter((stat) => stat.key !== "users")
            : stats;

    return {
        stats: filteredStats,
        revenue: {
            total: monthlyRevenue,
            growth: 0,
            period: "This Month",
        },
        fleetSummary,
        recentBookings,
        recentPayments,
    };
};

export { getDashboardStats };
