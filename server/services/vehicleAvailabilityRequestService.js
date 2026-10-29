import Vehicle from "../models/Vehicle.js";
import VehicleAvailabilityRequest from "../models/VehicleAvailabilityRequest.js";

import createError from "../utils/createError.js";

import {
    checkVehicleAvailability,
    addVehicleBlockedDate,
} from "./vehicleService.js";

import {
    notifyUser,
    notifyAdmins,
} from "./notificationService.js";

import {
    AVAILABILITY_REQUEST_STATUS,
    AVAILABILITY_REQUEST_REASON,
    MAX_AVAILABILITY_REQUEST_DATE_RANGES,
} from "../constants/vehicleAvailabilityRequestConstants.js";

const VEHICLE_SUMMARY_FIELDS =
    "vehicleCode brand model variant plateNumber images operator";

const OPERATOR_PUBLIC_FIELDS =
    "firstName lastName email phoneNumber";

/*
 * Normalizes and sanity-checks the raw date ranges from the request body —
 * separate from the availability check itself, so a malformed range fails
 * fast with a clear message instead of silently reaching
 * checkVehicleAvailability with garbage dates.
 */
const normalizeDateRanges = (dateRanges) => {
    if (
        !Array.isArray(dateRanges) ||
        dateRanges.length === 0
    ) {
        throw createError(
            "At least one date range is required.",
            400
        );
    }

    if (
        dateRanges.length >
        MAX_AVAILABILITY_REQUEST_DATE_RANGES
    ) {
        throw createError(
            `A single request can include at most ${MAX_AVAILABILITY_REQUEST_DATE_RANGES} date ranges.`,
            400
        );
    }

    const today = new Date();
    const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    return dateRanges.map((range) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);

        if (
            Number.isNaN(start.getTime()) ||
            Number.isNaN(end.getTime())
        ) {
            throw createError(
                "Each date range must have a valid start and end date.",
                400
            );
        }

        if (start >= end) {
            throw createError(
                "Each date range's start must be before its end.",
                400
            );
        }

        if (start < todayStart) {
            throw createError(
                "Date ranges cannot start in the past.",
                400
            );
        }

        return {
            startDate: start,
            endDate: end,
        };
    });
};

/*
 * Reuses the same availability logic the public booking flow relies on
 * (vehicle status, booking-enabled flag, availableFrom, existing blocked
 * dates, and — critically — active bookings) so a range can never be
 * requested (or approved) over dates the vehicle is already booked for.
 */
const ensureRangesAreAvailable = async (
    vehicleId,
    dateRanges
) => {
    for (const range of dateRanges) {
        const { available, reasons } =
            await checkVehicleAvailability(
                vehicleId,
                range.startDate,
                range.endDate
            );

        if (!available) {
            const formattedRange = `${range.startDate.toLocaleDateString()} - ${range.endDate.toLocaleDateString()}`;

            throw createError(
                `Cannot block ${formattedRange}: ${reasons.join(" ")}`,
                409
            );
        }
    }
};

const buildBlockedDateReason = (request) => {
    if (
        request.reason ===
        AVAILABILITY_REQUEST_REASON.OTHERS
    ) {
        return request.reasonDetails || "Others";
    }

    return request.reasonDetails
        ? `${request.reason} — ${request.reasonDetails}`
        : request.reason;
};

const findRequestById = async (requestId) => {
    const request =
        await VehicleAvailabilityRequest.findById(
            requestId
        );

    if (!request) {
        throw createError(
            "Availability request not found.",
            404
        );
    }

    return request;
};

const createAvailabilityRequest = async (
    { vehicleId, dateRanges, reason, reasonDetails },
    operatorId
) => {
    const vehicle = await Vehicle.findById(vehicleId);

    if (!vehicle) {
        throw createError("Vehicle not found.", 404);
    }

    if (
        !vehicle.operator ||
        vehicle.operator.toString() !==
            operatorId.toString()
    ) {
        throw createError(
            "You can only request unavailability for your own vehicles.",
            403
        );
    }

    if (
        reason === AVAILABILITY_REQUEST_REASON.OTHERS &&
        !reasonDetails?.trim()
    ) {
        throw createError(
            "Please describe the reason.",
            400
        );
    }

    const normalizedRanges =
        normalizeDateRanges(dateRanges);

    await ensureRangesAreAvailable(
        vehicleId,
        normalizedRanges
    );

    const request =
        await VehicleAvailabilityRequest.create({
            vehicle: vehicleId,
            operator: operatorId,
            dateRanges: normalizedRanges,
            reason,
            reasonDetails: reasonDetails?.trim() || "",
            audit: {
                createdBy: operatorId,
            },
        });

    try {
        await notifyAdmins({
            type: "vehicle-availability-request",
            title: "New Vehicle Unavailability Request",
            message: `${vehicle.brand} ${vehicle.model} (${vehicle.plateNumber}) — a partner requested ${normalizedRanges.length} date range(s) blocked for "${reason}". Awaiting review.`,
            variant: "info",
            category: "Vehicle",
            metadata: {
                reference: vehicle.vehicleCode,
                relatedId: request._id,
                relatedModel: "VehicleAvailabilityRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify admins of new availability request:",
            notificationError
        );
    }

    return request;
};

const getMyAvailabilityRequests = async (
    operatorId,
    { status } = {}
) => {
    const query = { operator: operatorId };

    if (status) {
        query.status = status;
    }

    return await VehicleAvailabilityRequest.find(query)
        .populate("vehicle", VEHICLE_SUMMARY_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
};

const getAvailabilityRequests = async (
    { status, vehicleId, operatorId } = {}
) => {
    const query = {};

    if (status) {
        query.status = status;
    }

    if (vehicleId) {
        query.vehicle = vehicleId;
    }

    if (operatorId) {
        query.operator = operatorId;
    }

    return await VehicleAvailabilityRequest.find(query)
        .populate("vehicle", VEHICLE_SUMMARY_FIELDS)
        .populate("operator", OPERATOR_PUBLIC_FIELDS)
        .sort({ createdAt: -1 })
        .lean();
};

const approveAvailabilityRequest = async (
    requestId,
    adminId,
    remarks = ""
) => {
    const request = await findRequestById(requestId);

    if (
        request.status !==
        AVAILABILITY_REQUEST_STATUS.PENDING
    ) {
        throw createError(
            "Only pending requests can be approved.",
            400
        );
    }

    // Re-check — time has passed since submission, a new booking may have
    // landed on one of the requested ranges in the meantime.
    await ensureRangesAreAvailable(
        request.vehicle,
        request.dateRanges
    );

    const blockedReason =
        buildBlockedDateReason(request);

    for (const range of request.dateRanges) {
        await addVehicleBlockedDate(
            request.vehicle,
            range.startDate,
            range.endDate,
            blockedReason
        );
    }

    request.status =
        AVAILABILITY_REQUEST_STATUS.APPROVED;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.reviewRemarks = remarks?.trim() || "";
    request.audit.updatedBy = adminId;

    await request.save();

    const vehicle = await Vehicle.findById(
        request.vehicle
    ).select("brand model plateNumber");

    try {
        await notifyUser(request.operator, {
            type: "vehicle-availability-request",
            title: "Unavailability Request Approved",
            message: `Your request to block ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plateNumber}) on the selected dates was approved. It will not be bookable during that period.`,
            variant: "success",
            category: "Vehicle",
            metadata: {
                reference: vehicle?.vehicleCode,
                relatedId: request._id,
                relatedModel: "VehicleAvailabilityRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of approved availability request:",
            notificationError
        );
    }

    return request;
};

const rejectAvailabilityRequest = async (
    requestId,
    adminId,
    rejectionReason
) => {
    if (!rejectionReason?.trim()) {
        throw createError(
            "A rejection reason is required.",
            400
        );
    }

    const request = await findRequestById(requestId);

    if (
        request.status !==
        AVAILABILITY_REQUEST_STATUS.PENDING
    ) {
        throw createError(
            "Only pending requests can be rejected.",
            400
        );
    }

    request.status =
        AVAILABILITY_REQUEST_STATUS.REJECTED;
    request.reviewedBy = adminId;
    request.reviewedAt = new Date();
    request.rejectionReason = rejectionReason.trim();
    request.audit.updatedBy = adminId;

    await request.save();

    const vehicle = await Vehicle.findById(
        request.vehicle
    ).select("brand model plateNumber");

    try {
        await notifyUser(request.operator, {
            type: "vehicle-availability-request",
            title: "Unavailability Request Rejected",
            message: `Your request to block ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plateNumber}) was rejected. Reason: ${rejectionReason.trim().slice(0, 300)}`,
            variant: "rejected",
            category: "Vehicle",
            metadata: {
                reference: vehicle?.vehicleCode,
                relatedId: request._id,
                relatedModel: "VehicleAvailabilityRequest",
            },
        });
    } catch (notificationError) {
        console.error(
            "Failed to notify operator of rejected availability request:",
            notificationError
        );
    }

    return request;
};

const cancelAvailabilityRequest = async (
    requestId,
    currentUser
) => {
    const request = await findRequestById(requestId);

    const isOwner =
        request.operator.toString() ===
        currentUser._id.toString();

    const isAdmin = currentUser.role === "admin";

    if (!isOwner && !isAdmin) {
        throw createError(
            "Only the requesting partner or an admin can cancel this request.",
            403
        );
    }

    if (
        request.status !==
        AVAILABILITY_REQUEST_STATUS.PENDING
    ) {
        throw createError(
            "Only pending requests can be cancelled.",
            400
        );
    }

    request.status =
        AVAILABILITY_REQUEST_STATUS.CANCELLED;
    request.cancelledAt = new Date();
    request.audit.updatedBy = currentUser._id;

    await request.save();

    if (isOwner && !isAdmin) {
        try {
            const vehicle = await Vehicle.findById(
                request.vehicle
            ).select("brand model plateNumber vehicleCode");

            await notifyAdmins({
                type: "vehicle-availability-request",
                title: "Unavailability Request Cancelled",
                message: `The partner cancelled their request to block ${vehicle?.brand} ${vehicle?.model} (${vehicle?.plateNumber}).`,
                variant: "info",
                category: "Vehicle",
                metadata: {
                    reference: vehicle?.vehicleCode,
                    relatedId: request._id,
                    relatedModel: "VehicleAvailabilityRequest",
                },
            });
        } catch (notificationError) {
            console.error(
                "Failed to notify admins of cancelled availability request:",
                notificationError
            );
        }
    }

    return request;
};

export {
    createAvailabilityRequest,
    getMyAvailabilityRequests,
    getAvailabilityRequests,
    approveAvailabilityRequest,
    rejectAvailabilityRequest,
    cancelAvailabilityRequest,
};
