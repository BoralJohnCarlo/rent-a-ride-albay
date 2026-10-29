import express from "express";

import {
    getOne,
    getStatement,
} from "../controllers/receiptController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    receiptIdValidator,
    statementBookingIdValidator,
} from "../validators/receiptValidator.js";

const router = express.Router();

/*
 * Acknowledgement receipts and booking statements: admins, and the booking's
 * own customer (checked in the service). Operators never see platform
 * payments, so they're not allowed here at all.
 */
router.use(protect, authorize("admin", "customer"));

router.get(
    "/statements/:bookingId",
    statementBookingIdValidator,
    getStatement
);

router.get(
    "/:receiptId",
    receiptIdValidator,
    getOne
);

export default router;
