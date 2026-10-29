import express from "express";

import {
    create,
    getAll,
    getMine,
    getCounts,
    getBookingSchedule,
    getById,
    update,
    archive,
    restore,
    updateStatus,
    setMaintenance,
    endMaintenance,
    previewMaintenance,
    updateCondition,
    updateBooking,
    addBlockedDate,
    removeBlockedDate,
    checkAvailability,
    checkAvailabilityBulk,
    getAvailabilityCalendar,
    getPickupTimes,
    getAvailability,
    updateFeatured,
    uploadImage,
    checkPlateNumber,
    checkRegistrationNumber,
    renewRegistration,
    setRegistrationAvailability,
    getRegistrationRenewalEligibilityCtrl,
    requestRegistrationRenewalAttempt,
    grantRegistrationRenewalAttempt,
} from "../controllers/vehicleController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createVehicleValidator,
    updateVehicleValidator,
    vehicleIdValidator,
    vehicleBlockedDateIdValidator,
    updateVehicleStatusValidator,
    setVehicleMaintenanceValidator,
    previewVehicleMaintenanceValidator,
    updateVehicleConditionValidator,
    updateVehicleBookingValidator,
    addBlockedDateValidator,
    checkVehicleAvailabilityValidator,
    checkVehiclesAvailabilityBulkValidator,
    vehicleAvailabilityCalendarValidator,
    vehiclePickupTimesValidator,
    updateFeaturedVehicleValidator,
    checkPlateNumberValidator,
    checkRegistrationNumberValidator,
    renewVehicleRegistrationValidator,
    setRegistrationAvailabilityValidator,
    grantRegistrationRenewalAttemptValidator,
} from "../validators/vehicleValidator.js";

import {
    uploadVehicleImage,
} from "../middleware/uploadMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

router.get(
    "/counts",
    getCounts
);

router.get(
    "/check-plate",
    checkPlateNumberValidator,
    checkPlateNumber
);

router.get(
    "/check-registration",
    checkRegistrationNumberValidator,
    checkRegistrationNumber
);

router.get(
    "/",
    getAll
);

// Must come before "/:id" — otherwise "mine" would be matched as an id.
router.get(
    "/mine",
    protect,
    authorize("operator"),
    getMine
);

// Also before "/:id". Admin fleet table's current/next booking per vehicle.
router.get(
    "/booking-schedule",
    protect,
    authorize("admin"),
    getBookingSchedule
);

router.post(
    "/availability/check-bulk",
    checkVehiclesAvailabilityBulkValidator,
    checkAvailabilityBulk
);

router.get(
    "/:id/availability",
    vehicleIdValidator,
    getAvailability
);

router.get(
    "/:id/availability/check",
    vehicleIdValidator,
    checkVehicleAvailabilityValidator,
    checkAvailability
);

router.get(
    "/:id/availability/calendar",
    vehicleIdValidator,
    vehicleAvailabilityCalendarValidator,
    getAvailabilityCalendar
);

router.get(
    "/:id/availability/pickup-times",
    vehicleIdValidator,
    vehiclePickupTimesValidator,
    getPickupTimes
);

router.get(
    "/:id",
    vehicleIdValidator,
    getById
);

/*
 * Operators need this too — to attach photos to a vehicle while submitting
 * a consignment application — so it sits here with its own dual-role check
 * rather than under the admin-only blanket gate below.
 */
router.post(
    "/upload-image",
    protect,
    authorize("admin", "operator"),
    uploadVehicleImage,
    uploadImage
);

/*
 * Registration renewal — operators need mutation access to exactly these
 * five endpoints (renew their own vehicle's registration, request/see
 * their attempt allowance), so each gets its own dual-role or operator-only
 * check here rather than falling under the admin-only blanket gate below.
 * Ownership (an operator can only act on a vehicle they own) is enforced
 * inside the service layer, not here.
 */
router.patch(
    "/:id/renew-registration",
    protect,
    authorize("admin", "operator"),
    vehicleIdValidator,
    renewVehicleRegistrationValidator,
    renewRegistration
);

router.patch(
    "/:id/registration-availability",
    protect,
    authorize("admin", "operator"),
    vehicleIdValidator,
    setRegistrationAvailabilityValidator,
    setRegistrationAvailability
);

router.get(
    "/:id/registration-renewal-eligibility",
    protect,
    authorize("admin", "operator"),
    vehicleIdValidator,
    getRegistrationRenewalEligibilityCtrl
);

router.post(
    "/:id/request-registration-renewal-attempt",
    protect,
    authorize("operator"),
    vehicleIdValidator,
    requestRegistrationRenewalAttempt
);

router.post(
    "/:id/grant-registration-renewal-attempt",
    protect,
    authorize("admin"),
    vehicleIdValidator,
    grantRegistrationRenewalAttemptValidator,
    grantRegistrationRenewalAttempt
);

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

router.use(
    protect,
    authorize("admin")
);

router.post(
    "/",
    createVehicleValidator,
    create
);

router.patch(
    "/:id",
    vehicleIdValidator,
    updateVehicleValidator,
    update
);

router.patch(
    "/:id/archive",
    vehicleIdValidator,
    archive
);

router.patch(
    "/:id/restore",
    vehicleIdValidator,
    restore
);

router.patch(
    "/:id/status",
    vehicleIdValidator,
    updateVehicleStatusValidator,
    updateStatus
);

router.get(
    "/:id/maintenance/preview",
    vehicleIdValidator,
    previewVehicleMaintenanceValidator,
    previewMaintenance
);

router.put(
    "/:id/maintenance",
    vehicleIdValidator,
    setVehicleMaintenanceValidator,
    setMaintenance
);

router.delete(
    "/:id/maintenance",
    vehicleIdValidator,
    endMaintenance
);

router.patch(
    "/:id/condition",
    vehicleIdValidator,
    updateVehicleConditionValidator,
    updateCondition
);

router.patch(
    "/:id/booking",
    vehicleIdValidator,
    updateVehicleBookingValidator,
    updateBooking
);

router.post(
    "/:id/blocked-dates",
    vehicleIdValidator,
    addBlockedDateValidator,
    addBlockedDate
);

router.delete(
    "/:id/blocked-dates/:blockedDateId",
    vehicleBlockedDateIdValidator,
    removeBlockedDate
);

router.patch(
    "/:id/featured",
    vehicleIdValidator,
    updateFeaturedVehicleValidator,
    updateFeatured
);

export default router;