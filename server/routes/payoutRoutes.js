import express from "express";

import {
    getPayoutRequests,
    getPayoutRequestById,
    getPayoutRequestsByOperator,
    getOperatorPayoutSummary,
    getPayoutStats,
    approvePayout,
    rejectPayout,
    markPayoutAsPaid,
    cancelPayout,
    getPayoutSettings,
    updatePayoutSettingsHandler,
    createPayoutRequest,
} from "../controllers/payoutController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";
import handleValidation from "../utils/handleValidation.js";

const router = express.Router();

router.use(protect);

// Operator routes
router.post("/request", createPayoutRequest);
router.get("/my", getPayoutRequestsByOperator);
router.get("/my/summary", getOperatorPayoutSummary);
router.delete("/:id", cancelPayout);

// Admin routes
const admin = authorize("admin");

router.get("/", admin, getPayoutRequests);
router.get("/stats", admin, getPayoutStats);
// Read-only: operators legitimately need this to see their own commission
// rate/currency/minimum on their Earnings page - only writing is admin-only.
router.get("/settings", getPayoutSettings);
router.put("/settings", admin, updatePayoutSettingsHandler);
router.put("/:id/approve", admin, approvePayout);
router.put("/:id/reject", admin, rejectPayout);
router.put("/:id/pay", admin, markPayoutAsPaid);
router.get("/:id", admin, getPayoutRequestById);

export default router;