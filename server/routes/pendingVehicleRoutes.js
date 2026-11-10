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
import mongoose from "mongoose";
import { updateRegistrationAppointment } from "../services/registrationAppointmentService.js";

const router = express.Router();

router.use(protect);

// Must come before "/:id" — otherwise "mine" would be matched as an id.
router.get("/mine", authorize("operator"), getMyPendingVehicles);

router.patch("/:id/inspection-appointment", authorize("operator", "admin"), async (req, res, next) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid vehicle ID." });
        const data = await updateRegistrationAppointment(req.params.id, req.body || {}, req.user);
        res.json({ success: true, message: "Appointment updated successfully.", data });
    } catch (error) { next(error); }
});

const admin = authorize("admin");

router.get("/", admin, getPendingVehicles);
router.get("/counts", admin, getPendingVehicleCounts);
router.get("/:id", admin, getPendingVehicleById);
router.put("/:id/status", admin, updatePendingVehicleStatus);
router.put("/:id", admin, updatePendingVehicle);

export default router;
