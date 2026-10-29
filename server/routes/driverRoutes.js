import express from "express";

import {
    createDriverAccount,
    getAllDrivers,
    getAvailableDriversController,
    getSingleDriver,
    getDriverUpcomingBookings,
    getPublicDriverProfileController,
    editDriver,
    changeDriverStatus,
    changeDriverAvailability,
    archiveDriverAccount,
    restoreDriverAccount,
} from "../controllers/driverController.js";

import {
    createDriverValidator,
    updateDriverValidator,
    updateDriverStatusValidator,
    updateDriverAvailabilityValidator,
    driverIdValidator,
} from "../validators/driverValidator.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.get(
    "/available",
    getAvailableDriversController
);

router.get(
    "/:id/public",
    driverIdValidator,
    getPublicDriverProfileController
);

router.use(protect);
router.use(authorize("admin"));

router.post(
    "/",
    createDriverValidator,
    createDriverAccount
);

router.get(
    "/",
    getAllDrivers
);

router.get(
    "/:id",
    driverIdValidator,
    getSingleDriver
);

router.get(
    "/:id/upcoming-bookings",
    driverIdValidator,
    getDriverUpcomingBookings
);

router.put(
    "/:id",
    updateDriverValidator,
    editDriver
);

router.patch(
    "/:id/status",
    updateDriverStatusValidator,
    changeDriverStatus
);

router.patch(
    "/:id/availability",
    updateDriverAvailabilityValidator,
    changeDriverAvailability
);

router.patch(
    "/:id/archive",
    driverIdValidator,
    archiveDriverAccount
);

router.patch(
    "/:id/restore",
    driverIdValidator,
    restoreDriverAccount
);

export default router;