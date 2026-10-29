import { validationResult } from "express-validator";
import Booking from "../models/Booking.js";
import { attachVehicleRatings } from "../services/reviewService.js";
import { getOffRoadVehicleSettings } from "../services/settingsService.js";
import { getMaintenanceWindow } from "../utils/vehicleMaintenance.js";
import { attachActiveDiscounts } from "../services/discountService.js";

import {
    createVehicle,
    getVehicles,
    getVehicleCounts,
    getVehicleBookingSchedule,
    getVehicleById,
    updateVehicle,
    archiveVehicle,
    restoreVehicle,
    updateVehicleStatus,
    updateVehicleCondition,
    updateVehicleBooking,
    addVehicleBlockedDate,
    removeVehicleBlockedDate,
    checkVehicleAvailability,
    checkVehiclesAvailabilityBulk,
    getVehicleAvailabilityCalendar,
    getVehiclePickupTimes,
    getVehicleAvailability,
    updateFeaturedVehicle,
    checkPlateNumberExists,
    checkRegistrationNumberExists,
    renewVehicleRegistration,
    setVehicleAvailabilityAfterRenewal,
    getRegistrationRenewalEligibility,
    requestVehicleRegistrationRenewalAttempt,
    grantVehicleRegistrationRenewalAttempt,
} from "../services/vehicleService.js";

import {
    applyVehicleMaintenance,
    clearVehicleMaintenance,
    previewVehicleMaintenance,
} from "../services/vehicleMaintenanceService.js";

import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

const handleDuplicateKeyError = (error) => {
    if (error.code !== 11000 && !error.message?.includes("E11000")) {
        return null;
    }

    const keyValue = error.keyValue || {};
    const errorMessage = error.message || "";

    if (keyValue.plateNumber || errorMessage.includes("plateNumber")) {
        return {
            message: "Plate number already exists.",
            errors: [
                {
                    path: "plateNumber",
                    msg: "Plate number already exists.",
                },
            ],
        };
    }

    if (keyValue.registrationNumber || errorMessage.includes("registrationNumber")) {
        return {
            message: "Registration number already exists.",
            errors: [
                {
                    path: "registrationNumber",
                    msg: "Registration number already exists.",
                },
            ],
        };
    }

    if (keyValue.vehicleCode || errorMessage.includes("vehicleCode")) {
        return {
            message: "Vehicle code already exists. Please try again.",
            errors: [],
        };
    }

    return {
        message: "A record with this information already exists.",
        errors: [],
    };
};

export const checkPlateNumber = async (req, res) => {
    try {
        const { plateNumber, excludeId } = req.query;
        const result = await checkPlateNumberExists(plateNumber, excludeId);

        return successResponse(
            res,
            "Plate number check completed.",
            result
        );
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const checkRegistrationNumber = async (req, res) => {
    try {
        const { registrationNumber, excludeId } = req.query;
        const result = await checkRegistrationNumberExists(
            registrationNumber,
            excludeId
        );

        return successResponse(
            res,
            "Registration number check completed.",
            result
        );
    } catch (error) {
        return errorResponse(res, error.message, 400);
    }
};

export const create = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicleData = {
    ...req.body,
    audit: {
        createdBy: req.user?._id ?? null,
    },
};

        const vehicle = await createVehicle(
            vehicleData
        );

        return successResponse(
            res,
            "Vehicle created successfully.",
            vehicle,
            201
        );
    } catch (error) {
        const duplicateError = handleDuplicateKeyError(error);
        if (duplicateError) {
            return errorResponse(
                res,
                duplicateError.message,
                400,
                duplicateError.errors
            );
        }

        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getAll = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            vehicleType: req.query.vehicleType,
            brand: req.query.brand,
            category: req.query.category,
            ownership: req.query.ownership,
            isFeatured:
                req.query.isFeatured !== undefined
                    ? req.query.isFeatured === "true"
                    : undefined,
        };

        let vehicles = await getVehicles(
            filters
        );

        /*
         * The customer-facing listings (browse, available vehicles, featured,
         * categories) send publicListing=true. Off-road vehicles stay in them
         * unless Settings → Bookings → Off-Road Vehicles says to hide them;
         * a direct link to one still opens.
         */
        if (req.query.publicListing === "true") {
            const { showInListings } = await getOffRoadVehicleSettings();

            if (!showInListings) {
                vehicles = vehicles.filter(
                    (vehicle) =>
                        getMaintenanceWindow(vehicle)?.end !== Infinity
                );
            }
        }

        let vehicleResults = vehicles;

        if (req.query.includeRatings === "true" && vehicles.length > 0) {
            vehicleResults = await attachVehicleRatings(vehicles);
        }

        if (req.query.includeBookingCounts === "true" && vehicles.length > 0) {
            const counts = await Booking.aggregate([
                {
                    $match: {
                        vehicle: {
                            $in: vehicles.map((vehicle) => vehicle._id),
                        },
                        status: {
                            $nin: ["Rejected", "Cancelled", "Expired", "No Show"],
                        },
                    },
                },
                {
                    $group: {
                        _id: "$vehicle",
                        bookingCount: { $sum: 1 },
                    },
                },
            ]);
            const countsByVehicle = new Map(
                counts.map((entry) => [
                    String(entry._id),
                    entry.bookingCount,
                ])
            );

            vehicleResults = vehicleResults.map((vehicle) => ({
                ...(typeof vehicle.toObject === "function"
                    ? vehicle.toObject()
                    : vehicle),
                bookingCount: countsByVehicle.get(String(vehicle._id)) ?? 0,
            }));
        }

        // Each vehicle's running discount (or null), for the price badges.
        vehicleResults = await attachActiveDiscounts(vehicleResults);

        return successResponse(
            res,
            "Vehicles retrieved successfully.",
            vehicleResults
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

/*
 * A partner's own fleet — scoped to req.user._id (never a client-supplied
 * operator id), same pattern as the booking/rental "mine" endpoints.
 */
export const getMine = async (req, res) => {
    try {
        const filters = {
            status: req.query.status,
            operator: req.user._id,
        };

        const vehicles = await getVehicles(
            filters
        );

        return successResponse(
            res,
            "Vehicles retrieved successfully.",
            vehicles
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getById = async (req, res) => {
    try {
        const vehicle = await attachActiveDiscounts(
            await getVehicleById(req.params.id)
        );

        return successResponse(
            res,
            "Vehicle retrieved successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            404
        );
    }
};

export const getCounts = async (
    req,
    res
) => {
    try {
        const filters = {
            status: req.query.status,
            vehicleType: req.query.vehicleType,
            brand: req.query.brand,
            category: req.query.category,
            ownership: req.query.ownership,
            isFeatured:
                req.query.isFeatured !== undefined
                    ? req.query.isFeatured === "true"
                    : undefined,
        };

        const counts =
            await getVehicleCounts(filters);

        return successResponse(
            res,
            "Vehicle counts retrieved successfully.",
            counts
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getBookingSchedule = async (req, res) => {
    try {
        const schedule = await getVehicleBookingSchedule();

        return successResponse(
            res,
            "Vehicle booking schedule retrieved successfully.",
            schedule
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const update = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicleData = {
    ...req.body,
    audit: {
        updatedBy: req.user?._id ?? null,
    },
};

const vehicle = await updateVehicle(
    req.params.id,
    vehicleData
);

        return successResponse(
            res,
            "Vehicle updated successfully.",
            vehicle
        );
    } catch (error) {
        const duplicateError = handleDuplicateKeyError(error);
        if (duplicateError) {
            return errorResponse(
                res,
                duplicateError.message,
                400,
                duplicateError.errors
            );
        }

        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const archive = async (req, res) => {
    try {
        const vehicle = await archiveVehicle(
            req.params.id,
            req.user?._id ?? null,
            req.body.archiveReason
        );

        return successResponse(
            res,
            "Vehicle archived successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const restore = async (req, res) => {
    try {
        const vehicle = await restoreVehicle(
            req.params.id
        );

        return successResponse(
            res,
            "Vehicle restored successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const updateStatus = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await updateVehicleStatus(
                req.params.id,
                req.body.status,
                {
                    maintenance: req.body.maintenance ?? null,
                    actorId: req.user?._id ?? null,
                }
            );

        return successResponse(
            res,
            "Vehicle status updated successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/*
 * PUT /vehicles/:id/maintenance — puts the vehicle under maintenance now
 * (turnaround, a number of days, or off road). It stays listed; only the
 * window is unbookable, and the bookings inside it are flagged.
 */
export const setMaintenance = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const { vehicle, conflicts } = await applyVehicleMaintenance(
            req.params.id,
            {
                mode: req.body.mode,
                days: req.body.days ?? null,
                reason: req.body.reason ?? "",
                setStatus: true,
            },
            req.user._id
        );

        return successResponse(
            res,
            conflicts.length
                ? `Vehicle is under maintenance. ${conflicts.length} booking(s) overlap it and were flagged for follow-up.`
                : "Vehicle is under maintenance.",
            { vehicle, conflicts }
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/* DELETE /vehicles/:id/maintenance — back in service now. */
export const endMaintenance = async (req, res) => {
    try {
        const vehicle = await clearVehicleMaintenance(req.params.id, {
            notifyBackInService: true,
        });

        return successResponse(
            res,
            "Vehicle is back in service.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

/*
 * GET /vehicles/:id/maintenance/preview?mode=&days=&from= — the window and
 * the bookings it would hit, before confirming.
 */
export const previewMaintenance = async (req, res) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const preview = await previewVehicleMaintenance(req.params.id, {
            mode: req.query.mode,
            days: req.query.days ?? null,
            from: req.query.from ?? null,
        });

        return successResponse(
            res,
            "Maintenance preview retrieved successfully.",
            preview
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const updateCondition = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await updateVehicleCondition(
                req.params.id,
                req.body.condition
            );

        return successResponse(
            res,
            "Vehicle condition updated successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const updateBooking = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await updateVehicleBooking(
                req.params.id,
                req.body.availability
            );

        return successResponse(
            res,
            "Vehicle booking settings updated successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const addBlockedDate = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await addVehicleBlockedDate(
                req.params.id,
                req.body.startDate,
                req.body.endDate,
                req.body.reason
            );

        return successResponse(
            res,
            "Vehicle blocked date added successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const removeBlockedDate = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await removeVehicleBlockedDate(
                req.params.id,
                req.params.blockedDateId
            );

        return successResponse(
            res,
            "Vehicle blocked date removed successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const checkAvailability = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const availability =
            await checkVehicleAvailability(
                req.params.id,
                req.query.startDate,
                req.query.endDate,
                req.query.driver || null
            );

        return successResponse(
            res,
            "Vehicle availability checked successfully.",
            availability
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const checkAvailabilityBulk = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const result =
            await checkVehiclesAvailabilityBulk(
                req.body.vehicleIds,
                req.body.startDate,
                req.body.endDate
            );

        return successResponse(
            res,
            "Vehicle availability checked successfully.",
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getAvailabilityCalendar = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const calendar =
            await getVehicleAvailabilityCalendar(
                req.params.id,
                req.query.startDate,
                req.query.endDate
            );

        return successResponse(
            res,
            "Vehicle availability calendar retrieved successfully.",
            calendar
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const getPickupTimes = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const pickupTimes =
            await getVehiclePickupTimes(
                req.params.id,
                req.query.startDate,
                req.query.endDate,
                req.query.driver || null
            );

        return successResponse(
            res,
            "Vehicle pickup times retrieved successfully.",
            pickupTimes
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAvailability = async (
    req,
    res
) => {
    try {
        const availability =
            await getVehicleAvailability(
                req.params.id
            );

        return successResponse(
            res,
            "Vehicle availability retrieved successfully.",
            availability
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            404
        );
    }
};

export const updateFeatured = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await updateFeaturedVehicle(
                req.params.id,
                req.body.isFeatured
            );

        return successResponse(
            res,
            "Vehicle featured status updated successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

export const uploadImage = async (
    req,
    res
) => {
    try {
        const vehicleImage =
            req.vehicleImage;

        return successResponse(
            res,
            "Vehicle image uploaded successfully.",
            vehicleImage,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            400
        );
    }
};

/*
 * These 5 registration-renewal endpoints use error.statusCode (falling back
 * to 400) rather than this file's usual hardcoded 400 — needed so an
 * ownership failure (assertCanManageRegistration, 403) actually surfaces as
 * 403 to the client instead of a misleading 400.
 */
export const renewRegistration = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await renewVehicleRegistration(
                req.params.id,
                {
                    officialReceiptImage:
                        req.body.officialReceipt,
                    expirationDate:
                        req.body.expirationDate,
                },
                req.user
            );

        return successResponse(
            res,
            "Vehicle registration renewed successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const setRegistrationAvailability = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await setVehicleAvailabilityAfterRenewal(
                req.params.id,
                {
                    availableFrom:
                        req.body.availableFrom,
                },
                req.user
            );

        return successResponse(
            res,
            "Vehicle availability updated successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getRegistrationRenewalEligibilityCtrl = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const eligibility =
            await getRegistrationRenewalEligibility(
                req.params.id,
                req.user
            );

        return successResponse(
            res,
            "Registration renewal eligibility retrieved successfully.",
            eligibility
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const requestRegistrationRenewalAttempt = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const vehicle =
            await requestVehicleRegistrationRenewalAttempt(
                req.params.id,
                req.user
            );

        return successResponse(
            res,
            "Renewal attempt request sent successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const grantRegistrationRenewalAttempt = async (
    req,
    res
) => {
    try {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                "Validation failed.",
                400,
                errors.array()
            );
        }

        const amount =
            parseInt(req.body.amount, 10) || 1;

        const vehicle =
            await grantVehicleRegistrationRenewalAttempt(
                req.params.id,
                amount
            );

        return successResponse(
            res,
            "Renewal attempt granted successfully.",
            vehicle
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
