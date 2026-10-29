import express from "express";

import {
    createRequest,
    getMyRequests,
    getRequests,
    approveRequest,
    rejectRequest,
    cancelRequest,
} from "../controllers/vehicleAvailabilityRequestController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

import {
    availabilityRequestIdValidator,
    createAvailabilityRequestValidator,
    rejectAvailabilityRequestValidator,
    approveAvailabilityRequestValidator,
} from "../validators/vehicleAvailabilityRequestValidator.js";

const router = express.Router();

router.use(protect);

// Operator routes
router.post(
    "/",
    authorize("operator"),
    createAvailabilityRequestValidator,
    createRequest
);

router.get(
    "/mine",
    authorize("operator"),
    getMyRequests
);

// Operator (own, pending only) or admin.
router.delete(
    "/:id",
    availabilityRequestIdValidator,
    cancelRequest
);

// Admin routes
const admin = authorize("admin");

router.get("/", admin, getRequests);

router.put(
    "/:id/approve",
    admin,
    availabilityRequestIdValidator,
    approveAvailabilityRequestValidator,
    approveRequest
);

router.put(
    "/:id/reject",
    admin,
    availabilityRequestIdValidator,
    rejectAvailabilityRequestValidator,
    rejectRequest
);

export default router;
