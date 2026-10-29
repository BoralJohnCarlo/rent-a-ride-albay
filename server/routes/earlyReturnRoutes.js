import express from "express";

import {
    listEarlyReturnCredits,
    approveEarlyReturnCredit,
    rejectEarlyReturnCredit,
} from "../controllers/earlyReturnController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

import {
    approveEarlyReturnValidator,
    rejectEarlyReturnValidator,
} from "../validators/rentalValidator.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Early Return Credits (Admin only)
|--------------------------------------------------------------------------|
*/

router.get(
    "/",
    protect,
    authorize("admin"),
    listEarlyReturnCredits
);

router.patch(
    "/:rentalId/approve",
    protect,
    authorize("admin"),
    approveEarlyReturnValidator,
    approveEarlyReturnCredit
);

router.patch(
    "/:rentalId/reject",
    protect,
    authorize("admin"),
    rejectEarlyReturnValidator,
    rejectEarlyReturnCredit
);

export default router;
