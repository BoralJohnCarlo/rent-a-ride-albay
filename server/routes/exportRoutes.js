import express from "express";

import {
    exportBookings,
    exportFinancials,
    exportPartners,
    exportVehicles,
} from "../controllers/exportController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Excel exports hold customer contact details and money - admin only.
router.use(protect, authorize("admin"));

router.post("/bookings", exportBookings);
router.get("/financials", exportFinancials);
router.post("/vehicles", exportVehicles);
router.get("/partners", exportPartners);

export default router;
