import express from "express";

import {
    getStatistics,
    getVehicleLeaderboard,
} from "../controllers/statisticsController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, authorize("admin", "operator"), getStatistics);

// Platform-wide rankings across every partner's vehicles - admin only.
router.get(
    "/vehicle-leaderboard",
    protect,
    authorize("admin"),
    getVehicleLeaderboard
);

export default router;
