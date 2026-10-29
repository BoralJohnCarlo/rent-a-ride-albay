import { validationResult } from "express-validator";

import {
    createBooking,
    getBookings,
    getBookingById,
    updateBooking,
    approveBooking,
    rejectBooking,
    cancelBooking,
    getBookingCancellationPreview,
    expireBooking,
    markBookingNoShow,
    previewBookingReschedule,
    requestBookingReschedule,
    approveBookingReschedule,
    rejectBookingReschedule,
    cancelBookingReschedule,
    changeBookingDriver,
    requestDriverChange,
    approveDriverChangeRequest,
    declineDriverChangeRequest,
    cancelDriverChangeRequest,
    requestBookingExtension,
    approveBookingExtension,
    rejectBookingExtension,
    cancelBookingExtension,
    previewBookingLocationFees,
    sendMaintenanceConflictOptions,
    getMaintenanceConflictOptions,
    changeVehicleForMaintenanceConflict,
    refundMaintenanceConflict,
    waitForLateVehicle,
} from "../services/bookingService.js";
import { getLateReturnImpact } from "../services/lateReturnConflictService.js";


import {
    successResponse,
    errorResponse,
} from "../utils/response.js";

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

        const booking = await createBooking(
            req.body,
            req.user._id
        );

        return successResponse(
            res,
            "Booking created successfully.",
            booking,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getAll = async (req, res) => {
    try {
        const filters = {
            customer: req.query.customer,
            vehicle: req.query.vehicle,
            driver: req.query.driver,
            status: req.query.status,
            driverOption:
                req.query.driverOption,
            maintenanceConflict:
                req.user.role === "admin"
                    ? req.query.maintenanceConflict
                    : undefined,
        };

        const bookings = await getBookings(
            filters,
            req.user._id,
            req.user.role
        );

        return successResponse(
            res,
            "Bookings retrieved successfully.",
            bookings
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const getById = async (req, res) => {
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

        const booking =
            await getBookingById(
                req.params.bookingId,
                req.user._id,
                req.user.role
            );

        return successResponse(
            res,
            "Booking retrieved successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const calculateDistanceFeesPreview = async (
    req,
    res
) => {
    try {
        const result = await previewBookingLocationFees(req.body);

        return successResponse(
            res,
            "Distance fees calculated successfully.",
            result
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
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

        const booking =
            await updateBooking(
                req.params.bookingId,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Booking updated successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const approve = async (req, res) => {
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

        const booking =
            await approveBooking(
                req.params.bookingId,
                req.user._id,
                req.body.driverId || null
            );

        return successResponse(
            res,
            "Booking approved successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const reject = async (req, res) => {
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

        const booking =
            await rejectBooking(
                req.params.bookingId,
                req.user._id,
                req.body.reason
            );

        return successResponse(
            res,
            "Booking rejected successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const cancel = async (req, res) => {
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

        const booking =
            await cancelBooking(
                req.params.bookingId,
                req.user._id,
                req.body.reason,
                req.user.role
            );

        return successResponse(
            res,
            "Booking cancelled successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const cancellationPreview = async (req, res) => {
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

        const preview =
            await getBookingCancellationPreview(
                req.params.bookingId,
                req.user._id,
                req.user.role
            );

        return successResponse(
            res,
            "Cancellation preview retrieved successfully.",
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

export const expire = async (req, res) => {
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

        const booking =
            await expireBooking(
                req.params.bookingId,
                req.user._id
            );

        return successResponse(
            res,
            "Booking expired successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const markNoShow = async (req, res) => {
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

        const booking =
            await markBookingNoShow(
                req.params.bookingId,
                req.user._id,
                {
                    // Only after the admin saw and confirmed a pickup problem.
                    ignorePickupBlocker:
                        req.body?.ignorePickupBlocker === true,
                }
            );

        return successResponse(
            res,
            "Booking marked as a no-show.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400,
            error.errors
        );
    }
};

/*
 * Reschedule handlers - all share the same validate → call → respond shape,
 * so one wrapper builds them.
 */
const rescheduleHandler =
    (run, message, status = 200) =>
    async (req, res) => {
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

            return successResponse(
                res,
                message,
                await run(req),
                status
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
 * Maintenance conflicts: the admin sends the customer their options; the
 * customer (or an admin for them) moves to another vehicle or takes a full
 * refund. Same response handling as reschedules.
 */
export const sendMaintenanceOptions = rescheduleHandler(
    (req) =>
        sendMaintenanceConflictOptions(
            req.params.bookingId,
            req.user._id
        ),
    "The customer has been sent their options."
);

export const maintenanceOptions = rescheduleHandler(
    (req) =>
        getMaintenanceConflictOptions(
            req.params.bookingId,
            req.user._id,
            req.user.role
        ),
    "Options retrieved successfully."
);

export const maintenanceChangeVehicle = rescheduleHandler(
    (req) =>
        changeVehicleForMaintenanceConflict(
            req.params.bookingId,
            req.body.vehicleId,
            req.user._id,
            req.user.role
        ),
    "The booking was moved to the new vehicle."
);

export const maintenanceRefund = rescheduleHandler(
    (req) =>
        refundMaintenanceConflict(
            req.params.bookingId,
            req.user._id,
            req.user.role
        ),
    "The booking was cancelled with a full refund."
);

// Late return: keep the booking and wait for the vehicle.
export const lateReturnWait = rescheduleHandler(
    (req) =>
        waitForLateVehicle(
            req.params.bookingId,
            req.user._id,
            req.user.role
        ),
    "You'll be notified as soon as the vehicle is back."
);

// Admin: the bookings this booking's late return affected, and the cost.
export const lateReturnImpact = rescheduleHandler(
    (req) => getLateReturnImpact(req.params.bookingId),
    "Late return impact retrieved."
);

export const previewReschedule = rescheduleHandler(
    (req) =>
        previewBookingReschedule(
            req.params.bookingId,
            req.body,
            req.user._id,
            req.user.role
        ),
    "Reschedule quote calculated."
);

export const requestReschedule = rescheduleHandler(
    (req) =>
        requestBookingReschedule(
            req.params.bookingId,
            req.body,
            req.user._id,
            req.user.role
        ),
    "Reschedule submitted successfully.",
    201
);

export const approveReschedule = rescheduleHandler(
    (req) =>
        approveBookingReschedule(
            req.params.bookingId,
            req.params.rescheduleId,
            req.user._id
        ),
    "Reschedule approved successfully."
);

export const rejectReschedule = rescheduleHandler(
    (req) =>
        rejectBookingReschedule(
            req.params.bookingId,
            req.params.rescheduleId,
            req.user._id,
            req.body.reason
        ),
    "Reschedule rejected successfully."
);

export const cancelReschedule = rescheduleHandler(
    (req) =>
        cancelBookingReschedule(
            req.params.bookingId,
            req.params.rescheduleId,
            req.user._id,
            req.body.reason,
            req.user.role
        ),
    "Reschedule request cancelled successfully."
);

/* Driver changes before pickup (same response handling as reschedules). */
export const changeDriver = rescheduleHandler(
    (req) =>
        changeBookingDriver(
            req.params.bookingId,
            { driverId: req.body.driverId, reason: req.body.reason },
            req.user._id
        ),
    "The driver was changed."
);

export const requestDriverChangeHandler = rescheduleHandler(
    (req) =>
        requestDriverChange(
            req.params.bookingId,
            {
                reason: req.body.reason,
                preferredDriverId: req.body.preferredDriverId || null,
            },
            req.user._id
        ),
    "Your request for a different driver was sent.",
    201
);

export const approveDriverChange = rescheduleHandler(
    (req) =>
        approveDriverChangeRequest(
            req.params.bookingId,
            req.params.requestId,
            { driverId: req.body.driverId || null, note: req.body.note },
            req.user._id
        ),
    "The driver change was approved."
);

export const declineDriverChange = rescheduleHandler(
    (req) =>
        declineDriverChangeRequest(
            req.params.bookingId,
            req.params.requestId,
            { note: req.body.note },
            req.user._id
        ),
    "The driver change request was declined."
);

export const cancelDriverChange = rescheduleHandler(
    (req) =>
        cancelDriverChangeRequest(
            req.params.bookingId,
            req.params.requestId,
            req.user._id
        ),
    "Your request was withdrawn."
);

export const requestExtension = async (
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

        const booking =
            await requestBookingExtension(
                req.params.bookingId,
                req.body,
                req.user._id
            );

        return successResponse(
            res,
            "Booking extension requested successfully.",
            booking,
            201
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const approveExtension = async (
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

        const booking =
            await approveBookingExtension(
                req.params.bookingId,
                req.params.extensionId,
                req.user._id
            );

        return successResponse(
            res,
            "Booking extension approved successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const rejectExtension = async (
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

        const booking =
            await rejectBookingExtension(
                req.params.bookingId,
                req.params.extensionId,
                req.user._id,
                req.body.reason
            );

        return successResponse(
            res,
            "Booking extension rejected successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};

export const cancelExtension = async (
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

        const booking =
            await cancelBookingExtension(
                req.params.bookingId,
                req.params.extensionId,
                req.user._id,
                req.body.reason,
                req.user.role
            );

        return successResponse(
            res,
            "Booking extension cancelled successfully.",
            booking
        );
    } catch (error) {
        return errorResponse(
            res,
            error.message,
            error.statusCode || 400
        );
    }
};
