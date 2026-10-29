import express from "express";

import {
    create,
    getAll,
    getById,
    update,
    approve,
    reject,
    cancel,
    cancellationPreview,
    expire,
    markNoShow,
    requestExtension,
    approveExtension,
    rejectExtension,
    cancelExtension,
    previewReschedule,
    requestReschedule,
    approveReschedule,
    rejectReschedule,
    cancelReschedule,
    changeDriver,
    requestDriverChangeHandler,
    approveDriverChange,
    declineDriverChange,
    cancelDriverChange,
    calculateDistanceFeesPreview,
    sendMaintenanceOptions,
    maintenanceOptions,
    maintenanceChangeVehicle,
    maintenanceRefund,
    lateReturnWait,
    lateReturnImpact,
} from "../controllers/bookingController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createBookingValidator,
    updateBookingValidator,
    requestBookingExtensionValidator,
    extensionIdValidator,
    rejectBookingExtensionValidator,
    cancelBookingExtensionValidator,
    bookingIdValidator,
    approveBookingValidator,
    previewRescheduleValidator,
    requestRescheduleValidator,
    rescheduleIdValidator,
    rescheduleReasonValidator,
    maintenanceChangeVehicleValidator,
    changeBookingDriverValidator,
    requestDriverChangeValidator,
    approveDriverChangeValidator,
    declineDriverChangeValidator,
    driverChangeRequestIdValidator,
} from "../validators/bookingValidator.js";

const router = express.Router();

router.use(protect);

/*
|--------------------------------------------------------------------------|
| Customer Routes
|--------------------------------------------------------------------------|
*/

router.post(
    "/",
    authorize("customer"),
    createBookingValidator,
    create
);

router.put(
    "/:bookingId",
    authorize("customer"),
    updateBookingValidator,
    update
);

router.patch(
    "/:bookingId/cancel",
    authorize("admin", "customer"),
    bookingIdValidator,
    cancel
);

router.get(
    "/:bookingId/cancellation-preview",
    authorize("admin", "customer"),
    bookingIdValidator,
    cancellationPreview
);

router.post(
    "/:bookingId/extensions",
    authorize("customer"),
    requestBookingExtensionValidator,
    requestExtension
);

/*
 * Reschedule: a customer requests new dates (admin approves); an admin
 * posting here reschedules directly. The preview prices dates without saving.
 */
router.post(
    "/:bookingId/reschedules/preview",
    authorize("admin", "customer"),
    previewRescheduleValidator,
    previewReschedule
);

router.post(
    "/:bookingId/reschedules",
    authorize("admin", "customer"),
    requestRescheduleValidator,
    requestReschedule
);

router.patch(
    "/:bookingId/reschedules/:rescheduleId/cancel",
    authorize("admin", "customer"),
    rescheduleReasonValidator,
    cancelReschedule
);

/*
 * Driver changes before pickup: a customer asks for a different driver (an
 * admin approves or declines) or withdraws the request; admins also change
 * the driver directly.
 */
router.post(
    "/:bookingId/driver-change-requests",
    authorize("customer"),
    requestDriverChangeValidator,
    requestDriverChangeHandler
);

router.patch(
    "/:bookingId/driver-change-requests/:requestId/cancel",
    authorize("customer"),
    driverChangeRequestIdValidator,
    cancelDriverChange
);

/*
 * Maintenance conflict: the booking's vehicle went under maintenance over
 * its dates. The customer (once sent their options) or an admin picks
 * another vehicle for the same dates or a full refund.
 */
router.get(
    "/:bookingId/maintenance-conflict/options",
    authorize("admin", "customer"),
    bookingIdValidator,
    maintenanceOptions
);

router.post(
    "/:bookingId/maintenance-conflict/change-vehicle",
    authorize("admin", "customer"),
    maintenanceChangeVehicleValidator,
    maintenanceChangeVehicle
);

router.post(
    "/:bookingId/maintenance-conflict/refund",
    authorize("admin", "customer"),
    bookingIdValidator,
    maintenanceRefund
);

// Late return only: keep the booking and wait for the vehicle.
router.post(
    "/:bookingId/maintenance-conflict/wait",
    authorize("admin", "customer"),
    bookingIdValidator,
    lateReturnWait
);

// Admin: who this booking's late return affected, and what it cost.
router.get(
    "/:bookingId/late-return-impact",
    authorize("admin"),
    bookingIdValidator,
    lateReturnImpact
);

router.patch(
    "/:bookingId/extensions/:extensionId/cancel",
    authorize("admin", "customer"),
    cancelBookingExtensionValidator,
    cancelExtension
);

router.post(
    "/calculate-distance-fees",
    authorize("customer"),
    calculateDistanceFeesPreview
);

/*
|--------------------------------------------------------------------------|
| Booking Retrieval Routes
|--------------------------------------------------------------------------|
*/

router.get(
    "/",
    authorize("admin", "operator", "customer"),
    getAll
);

router.get(
    "/:bookingId",
    authorize("admin", "operator", "customer"),
    bookingIdValidator,
    getById
);

/*
|--------------------------------------------------------------------------|
| Administrator Routes
|--------------------------------------------------------------------------|
*/

router.patch(
    "/:bookingId/approve",
    authorize("admin"),
    approveBookingValidator,
    approve
);

router.patch(
    "/:bookingId/reject",
    authorize("admin"),
    bookingIdValidator,
    reject
);

router.patch(
    "/:bookingId/expire",
    authorize("admin"),
    bookingIdValidator,
    expire
);

router.patch(
    "/:bookingId/no-show",
    authorize("admin"),
    bookingIdValidator,
    markNoShow
);

router.post(
    "/:bookingId/maintenance-conflict/send-options",
    authorize("admin"),
    bookingIdValidator,
    sendMaintenanceOptions
);

router.patch(
    "/:bookingId/extensions/:extensionId/approve",
    authorize("admin"),
    extensionIdValidator,
    approveExtension
);

router.patch(
    "/:bookingId/driver",
    authorize("admin"),
    changeBookingDriverValidator,
    changeDriver
);

router.patch(
    "/:bookingId/driver-change-requests/:requestId/approve",
    authorize("admin"),
    approveDriverChangeValidator,
    approveDriverChange
);

router.patch(
    "/:bookingId/driver-change-requests/:requestId/decline",
    authorize("admin"),
    declineDriverChangeValidator,
    declineDriverChange
);

router.patch(
    "/:bookingId/reschedules/:rescheduleId/approve",
    authorize("admin"),
    rescheduleIdValidator,
    approveReschedule
);

router.patch(
    "/:bookingId/reschedules/:rescheduleId/reject",
    authorize("admin"),
    rescheduleReasonValidator,
    rejectReschedule
);

router.patch(
    "/:bookingId/extensions/:extensionId/reject",
    authorize("admin"),
    rejectBookingExtensionValidator,
    rejectExtension
);

export default router;
