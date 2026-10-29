import express from "express";

import {
    getDashboardData,
    getActivityCounts,
} from "../controllers/dashboardController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, authorize("admin", "operator"), getDashboardData);
router.get(
    "/activity-counts",
    protect,
    authorize("admin", "operator"),
    getActivityCounts
);

export default router;
