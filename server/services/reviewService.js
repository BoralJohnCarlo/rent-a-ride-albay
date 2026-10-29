import Review from "../models/Review.js";
import Rental from "../models/Rental.js";
import Booking from "../models/Booking.js";
import Vehicle from "../models/Vehicle.js";
import mongoose from "mongoose";
import createError from "../utils/createError.js";
import { notifyAdmins, notifyUser } from "./notificationService.js";

const resolveRentalId = async (identifier) => {
    if (!identifier) {
        throw createError(
            "Rental ID or Booking ID is required.",
            400
        );
    }

    if (
        mongoose.Types.ObjectId.isValid(
            identifier
        ) &&
        identifier.length === 24
    ) {
        const rental = await Rental.findById(
            identifier
        );

        if (rental) {
            return rental._id;
        }

        const booking = await Booking.findById(
            identifier
        );

        if (booking) {
            const linkedRental =
                await Rental.findOne({
                    booking: booking._id,
                });

            if (!linkedRental) {
                throw createError(
                    "No rental found for this booking.",
                    404
                );
            }

            return linkedRental._id;
        }
    }

    throw createError(
        "Invalid Rental ID or Booking ID.",
        400
    );
};

export const createReview = async (
    identifier,
    customerId,
    reviewData
) => {
    const rentalId =
        await resolveRentalId(identifier);

    const rental = await Rental.findById(rentalId);

    if (!rental) {
        throw createError(
            "Rental not found.",
            404
        );
    }

    if (rental.status !== "Completed") {
        throw createError(
            "Reviews can only be submitted for completed rentals.",
            400
        );
    }

    if (rental.customer.toString() !== customerId.toString()) {
        throw createError(
            "You are not authorized to review this rental.",
            403
        );
    }

    const existingReview = await Review.findOne({
        rental: rentalId,
    });

    if (existingReview) {
        throw createError(
            "You have already reviewed this rental.",
            409
        );
    }

    if (
        reviewData.driverId &&
        (!rental.driver ||
            rental.driver.toString() !==
                reviewData.driverId.toString())
    ) {
        throw createError(
            "This driver is not assigned to your rental.",
            400
        );
    }

    // Guaranteed to match rental.driver at this point (checked above).
    const isRatingDriver = Boolean(reviewData.driverId);

    const review = await Review.create({
        rental: rentalId,
        customer: customerId,
        vehicle: rental.vehicle,
        driver: isRatingDriver ? reviewData.driverId : null,
        rating: reviewData.rating,
        comment: reviewData.comment?.trim() || "",
        image: reviewData.image?.trim() || null,
        driverRating: isRatingDriver
            ? reviewData.driverRating ?? null
            : null,
        driverComment: isRatingDriver
            ? reviewData.driverComment?.trim() || ""
            : "",
        driverImage: isRatingDriver
            ? reviewData.driverImage?.trim() || null
            : null,
    });

    try {
        const isLowRating = Number(review.rating) <= 2;
        const commentPreview = review.comment
            ? ` "${review.comment.slice(0, 160)}${review.comment.length > 160 ? "…" : ""}"`
            : "";

        await notifyAdmins({
            type: "review",
            title: isLowRating
                ? "Low Rating Review Submitted"
                : "New Review Submitted",
            message: `A ${review.rating}-star review was submitted for rental ${rental.rentalCode}.${commentPreview}`,
            variant: isLowRating ? "warning" : "info",
            category: "Review",
            metadata: {
                reference: rental.rentalCode,
                relatedId: review._id,
                relatedModel: "Review",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of new review:",
            notificationError
        );
    }

    try {
        const vehicle = await Vehicle.findById(rental.vehicle)
            .select("operator brand model")
            .lean();

        if (vehicle?.operator) {
            const isLowRating = Number(review.rating) <= 2;
            const commentPreview = review.comment
                ? ` "${review.comment.slice(0, 160)}${review.comment.length > 160 ? "…" : ""}"`
                : "";

            await notifyUser(vehicle.operator, {
                type: "review",
                title: "New Review on Your Vehicle",
                message: `Your ${vehicle.brand} ${vehicle.model} received a ${review.rating}-star review (rental ${rental.rentalCode}).${commentPreview}`,
                variant: isLowRating ? "warning" : "info",
                category: "Review",
                metadata: {
                    reference: rental.rentalCode,
                    relatedId: review._id,
                    relatedModel: "Review",
                },
            });
        }
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of new review:",
            notificationError
        );
    }

    return review;
};

export const getReviewsByVehicle = async (
    vehicleId
) => {
    const reviews = await Review.find({
        vehicle: vehicleId,
    })
        .populate(
            "customer",
            "firstName lastName profileImage"
        )
        .populate(
            "driver",
            "firstName lastName"
        )
        .sort({
            createdAt: -1,
        });

    return reviews;
};

export const getReviewsByDriver = async (
    driverId
) => {
    const reviews = await Review.find({
        driver: driverId,
        driverRating: {
            $ne: null,
        },
    })
        .populate(
            "customer",
            "firstName lastName profileImage"
        )
        .populate(
            "vehicle",
            "brand model plateNumber"
        )
        .sort({
            createdAt: -1,
        });

    return reviews;
};

export const getReviewByRental = async (
    rentalId
) => {
    const review = await Review.findOne({
        rental: rentalId,
    })
        .populate(
            "customer",
            "firstName lastName profileImage"
        )
        .populate(
            "vehicle",
            "brand model plateNumber"
        )
        .populate(
            "driver",
            "firstName lastName"
        );

    return review;
};

export const getAllReviews = async () => {
    const reviews = await Review.find()
        .populate(
            "customer",
            "firstName lastName email profileImage"
        )
        .populate(
            "vehicle",
            "brand model plateNumber"
        )
        .populate(
            "driver",
            "firstName lastName"
        )
        .populate(
            "rental",
            "bookingCode startDate endDate"
        )
        .sort({
            createdAt: -1,
        });

    return reviews;
};

export const getVehicleAverageRating = async (
    vehicleId
) => {
    const result = await Review.aggregate([
        {
            $match: {
                vehicle: new mongoose.Types.ObjectId(vehicleId),
            },
        },
        {
            $group: {
                _id: null,
                averageRating: {
                    $avg: "$rating",
                },
                reviewCount: {
                    $sum: 1,
                },
            },
        },
    ]);

    if (result.length === 0) {
        return {
            averageRating: 0,
            reviewCount: 0,
        };
    }

    return {
        averageRating: Math.round(
            result[0].averageRating * 10
        ) / 10,
        reviewCount: result[0].reviewCount,
    };
};

/*
 * Rating summaries for many vehicles in one aggregate, for listings (browse
 * cards/list, favorites). Same numbers as getVehicleAverageRating; vehicles
 * without reviews get { averageRating: 0, reviewCount: 0 }.
 */
export const getVehicleRatingSummaries = async (
    vehicleIds = []
) => {
    const summaries = new Map();

    if (vehicleIds.length === 0) {
        return summaries;
    }

    const results = await Review.aggregate([
        {
            $match: {
                vehicle: {
                    $in: vehicleIds.map(
                        (id) => new mongoose.Types.ObjectId(String(id))
                    ),
                },
            },
        },
        {
            $group: {
                _id: "$vehicle",
                averageRating: { $avg: "$rating" },
                reviewCount: { $sum: 1 },
            },
        },
    ]);

    for (const result of results) {
        summaries.set(String(result._id), {
            averageRating:
                Math.round(result.averageRating * 10) / 10,
            reviewCount: result.reviewCount,
        });
    }

    return summaries;
};

/* Copies of `vehicles` (documents or plain objects) with a `rating` field. */
export const attachVehicleRatings = async (vehicles = []) => {
    const summaries = await getVehicleRatingSummaries(
        vehicles.map((vehicle) => vehicle._id)
    );

    return vehicles.map((vehicle) => ({
        ...(typeof vehicle.toObject === "function"
            ? vehicle.toObject()
            : vehicle),
        rating: summaries.get(String(vehicle._id)) ?? {
            averageRating: 0,
            reviewCount: 0,
        },
    }));
};

/*
 * Driver rating summaries in one aggregate (the customer's driver picker).
 * Same numbers as getDriverAverageRating; keyed by driver id string.
 */
export const getDriverRatingSummaries = async (
    driverIds = []
) => {
    const summaries = new Map();

    if (driverIds.length === 0) {
        return summaries;
    }

    const results = await Review.aggregate([
        {
            $match: {
                driver: {
                    $in: driverIds.map(
                        (id) => new mongoose.Types.ObjectId(String(id))
                    ),
                },
                driverRating: { $ne: null },
            },
        },
        {
            $group: {
                _id: "$driver",
                averageRating: { $avg: "$driverRating" },
                reviewCount: { $sum: 1 },
            },
        },
    ]);

    for (const result of results) {
        summaries.set(String(result._id), {
            averageRating:
                Math.round(result.averageRating * 10) / 10,
            reviewCount: result.reviewCount,
        });
    }

    return summaries;
};

export const getDriverAverageRating = async (
    driverId
) => {
    const result = await Review.aggregate([
        {
            $match: {
                driver: new mongoose.Types.ObjectId(driverId),
                driverRating: {
                    $ne: null,
                },
            },
        },
        {
            $group: {
                _id: null,
                averageRating: {
                    $avg: "$driverRating",
                },
                reviewCount: {
                    $sum: 1,
                },
            },
        },
    ]);

    if (result.length === 0) {
        return {
            averageRating: 0,
            reviewCount: 0,
        };
    }

    return {
        averageRating: Math.round(
            result[0].averageRating * 10
        ) / 10,
        reviewCount: result[0].reviewCount,
    };
};
