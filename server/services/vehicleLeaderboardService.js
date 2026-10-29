import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import Vehicle from "../models/Vehicle.js";

import {
    BOOKING_STATUS,
    BOOKING_ENDED_WITHOUT_TRIP_STATUSES,
} from "../constants/bookingConstants.js";

import { getDateRange } from "./statisticsService.js";

/*
 * Admin dashboard "Vehicle Leaderboard".
 *
 * Performance is for the dashboard's reporting period and only counts
 * bookings that became (or are still becoming) a trip — rejected,
 * cancelled, expired and no-show bookings are left out, same as the
 * statistics "top vehicles". Booking value is the booked total
 * (pricing.totalAmount: vehicle, reservation, distance and driver fees),
 * i.e. what customers committed to, not verified/settled revenue.
 *
 * Ratings are all-time: reviews are too sparse for a 7/30-day window to
 * rank anything meaningfully.
 */

export const LEADERBOARD_PERIODS = Object.freeze([
    "7d",
    "30d",
    "month",
    "year",
]);

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

const getPrimaryImage = (images = []) => {
    if (!Array.isArray(images) || images.length === 0) {
        return null;
    }

    const primary =
        images.find((image) => image?.isPrimary) ?? images[0];

    return primary?.url ?? null;
};

const toVehicleSummary = (vehicle) => ({
    _id: vehicle._id,
    brand: vehicle.brand ?? "",
    model: vehicle.model ?? "",
    year: vehicle.year ?? null,
    vehicleCode: vehicle.vehicleCode ?? "",
    plateNumber: vehicle.plateNumber ?? "",
    vehicleType: vehicle.vehicleType ?? "",
    status: vehicle.status ?? "",
    image: getPrimaryImage(vehicle.images),
});

const round1 = (value) => Math.round(value * 10) / 10;

const getPerformanceRows = async (period) => {
    const { start } = getDateRange(period);

    return Booking.aggregate([
        {
            $match: {
                createdAt: { $gte: start },
                status: { $nin: BOOKING_ENDED_WITHOUT_TRIP_STATUSES },
            },
        },
        {
            $group: {
                _id: "$vehicle",
                bookings: { $sum: 1 },
                completedTrips: {
                    $sum: {
                        $cond: [
                            {
                                $eq: [
                                    "$status",
                                    BOOKING_STATUS.COMPLETED,
                                ],
                            },
                            1,
                            0,
                        ],
                    },
                },
                bookingValue: {
                    $sum: { $ifNull: ["$pricing.totalAmount", 0] },
                },
                rentalDays: {
                    $sum: { $ifNull: ["$pricing.rentalDays", 0] },
                },
            },
        },
    ]);
};

const getRatingRows = () =>
    Review.aggregate([
        {
            $match: {
                vehicle: { $ne: null },
                rating: { $gte: 1 },
            },
        },
        {
            $group: {
                _id: "$vehicle",
                averageRating: { $avg: "$rating" },
                reviewCount: { $sum: 1 },
                fiveStarCount: {
                    $sum: {
                        $cond: [{ $eq: ["$rating", 5] }, 1, 0],
                    },
                },
            },
        },
    ]);

const vehicleSortName = (row) =>
    `${row.vehicle?.brand ?? ""} ${row.vehicle?.model ?? ""} ${row.vehicle?.plateNumber ?? ""}`;

/* Highest first on each key in turn; full ties fall back to the vehicle's
   name so the order doesn't shuffle between loads (aggregation output order
   isn't stable). */
const byDescending = (...keys) => (a, b) => {
    for (const key of keys) {
        const difference = (b[key] ?? 0) - (a[key] ?? 0);

        if (difference !== 0) {
            return difference;
        }
    }

    return vehicleSortName(a).localeCompare(vehicleSortName(b));
};

const getVehicleLeaderboard = async ({
    period = "30d",
    limit = DEFAULT_LIMIT,
} = {}) => {
    const safePeriod = LEADERBOARD_PERIODS.includes(period)
        ? period
        : "30d";

    const safeLimit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(limit, 10) || DEFAULT_LIMIT)
    );

    const [performanceRows, ratingRows] = await Promise.all([
        getPerformanceRows(safePeriod),
        getRatingRows(),
    ]);

    const vehicleIds = [
        ...new Set(
            [...performanceRows, ...ratingRows].map((row) =>
                String(row._id)
            )
        ),
    ];

    const vehicles = vehicleIds.length
        ? await Vehicle.find({ _id: { $in: vehicleIds } })
              .select(
                  "brand model year vehicleCode plateNumber vehicleType status images"
              )
              .lean()
        : [];

    const vehiclesById = new Map(
        vehicles.map((vehicle) => [String(vehicle._id), vehicle])
    );

    const ratingsById = new Map(
        ratingRows.map((row) => [
            String(row._id),
            {
                averageRating: round1(row.averageRating),
                reviewCount: row.reviewCount,
                fiveStarCount: row.fiveStarCount,
            },
        ])
    );

    // Rows whose vehicle was deleted outright have nothing to show.
    const performance = performanceRows
        .filter((row) => vehiclesById.has(String(row._id)))
        .map((row) => {
            const id = String(row._id);
            const rating = ratingsById.get(id);

            return {
                vehicle: toVehicleSummary(vehiclesById.get(id)),
                bookings: row.bookings,
                completedTrips: row.completedTrips,
                bookingValue: row.bookingValue,
                rentalDays: row.rentalDays,
                averageRating: rating?.averageRating ?? 0,
                reviewCount: rating?.reviewCount ?? 0,
            };
        });

    const ratings = ratingRows
        .filter((row) => vehiclesById.has(String(row._id)))
        .map((row) => {
            const id = String(row._id);

            return {
                vehicle: toVehicleSummary(vehiclesById.get(id)),
                ...ratingsById.get(id),
            };
        });

    return {
        period: safePeriod,
        limit: safeLimit,

        topByBookingValue: [...performance]
            .sort(byDescending("bookingValue", "bookings"))
            .slice(0, safeLimit),

        topByBookings: [...performance]
            .sort(byDescending("bookings", "bookingValue"))
            .slice(0, safeLimit),

        // Ties on the average go to the vehicle with more reviews behind it.
        highestRated: [...ratings]
            .sort(byDescending("averageRating", "reviewCount"))
            .slice(0, safeLimit),

        mostReviewed: [...ratings]
            .sort(byDescending("reviewCount", "averageRating"))
            .slice(0, safeLimit),
    };
};

export { getVehicleLeaderboard };
