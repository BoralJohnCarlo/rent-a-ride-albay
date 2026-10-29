import express from "express";

import {
    getPendingVehicles,
    getMyPendingVehicles,
    getPendingVehicleById,
    updatePendingVehicleStatus,
    getPendingVehicleCounts,
    updatePendingVehicle,
} from "../controllers/pendingVehicleController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";
import handleValidation from "../utils/handleValidation.js";

const router = express.Router();

router.use(protect);

// Must come before "/:id" — otherwise "mine" would be matched as an id.
router.get("/mine", authorize("operator"), getMyPendingVehicles);

const admin = authorize("admin");

router.get("/", admin, getPendingVehicles);
router.get("/counts", admin, getPendingVehicleCounts);
router.get("/:id", admin, getPendingVehicleById);
router.put("/:id/status", admin, updatePendingVehicleStatus);
router.put("/:id", admin, updatePendingVehicle);

export default router;