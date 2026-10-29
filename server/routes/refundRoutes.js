import express from "express";

import {
    listCustomerRefunds,
    getCustomerRefund,
    recordBookingRefund,
    listAllRefunds,
    requestCustomerRefund,
    removeCustomerRefund,
    approveRefund,
    rejectRefund,
    settleRefund,
    listOwedRefunds,
    settleOwedRefund,
} from "../controllers/refundController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

import {
    addRefundValidator,
    requestRefundValidator,
    approveRefundValidator,
    settleRefundValidator,
    settleOwedRefundValidator,
} from "../validators/rentalValidator.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Customer Refunds
|--------------------------------------------------------------------------|
*/

router.get(
    "/customer",
    protect,
    authorize("customer", "admin"),
    listCustomerRefunds
);

router.get(
    "/customer/:id",
    protect,
    authorize("customer", "admin"),
    getCustomerRefund
);

router.post(
    "/customer/:rentalId/refunds",
    protect,
    authorize("customer", "admin"),
    requestRefundValidator,
    requestCustomerRefund
);

router.delete(
    "/customer/:id",
    protect,
    authorize("customer", "admin"),
    removeCustomerRefund
);

/*
|--------------------------------------------------------------------------
| Admin Refunds
|--------------------------------------------------------------------------|
*/

router.get(
    "/",
    protect,
    authorize("admin"),
    listAllRefunds
);

/*
 * Refunds owed by hand — ones no payment could carry (see ManualRefund).
 */
router.get(
    "/owed",
    protect,
    authorize("admin"),
    listOwedRefunds
);

router.post(
    "/owed/:id/settle",
    protect,
    authorize("admin"),
    settleOwedRefundValidator,
    settleOwedRefund
);

/*
|--------------------------------------------------------------------------
| Booking Refund (Admin only)
|--------------------------------------------------------------------------|
*/

router.post(
    "/:rentalId/refunds",
    protect,
    authorize("admin"),
    addRefundValidator,
    recordBookingRefund
);

router.post(
    "/:rentalId/refunds/:refundId/approve",
    protect,
    authorize("admin"),
    approveRefundValidator,
    approveRefund
);

router.post(
    "/:rentalId/refunds/:refundId/reject",
    protect,
    authorize("admin"),
    rejectRefund
);

router.post(
    "/:rentalId/refunds/:refundId/settle",
    protect,
    authorize("admin"),
    settleRefundValidator,
    settleRefund
);

export default router;
