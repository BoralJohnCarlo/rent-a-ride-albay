
import express from "express";

import {
    create,
    createCheckout,
    verify,
    cancel,
    reconcile,
    reportFailure,
    getById,
    getAll,
    handleWebhook,
    reconcileRefundStatus,
    sendRefund,
    completeRefund,
} from "../controllers/paymentController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    paymentIdValidator,
    createPaymentValidator,
    verifyPaymentValidator,
    reconcileRefundValidator,
    sendRefundValidator,
    completeRefundValidator,
} from "../validators/paymentValidator.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Webhook Routes (No Auth)
|--------------------------------------------------------------------------
*/

router.post(
    "/webhooks/paymongo",
    express.raw({
        type: "application/json",
    }),
    handleWebhook
);

/*
|--------------------------------------------------------------------------
| Protected Routes
|--------------------------------------------------------------------------
*/

router.use(protect);

/*
|--------------------------------------------------------------------------
| Customer Routes
|--------------------------------------------------------------------------
*/

router.post(
    "/:paymentId/checkout",
    authorize("customer"),
    paymentIdValidator,
    createCheckout
);

router.post(
    "/",
    authorize("customer"),
    createPaymentValidator,
    create
);

router.get(
    "/:paymentId",
    authorize("admin", "customer"),
    paymentIdValidator,
    getById
);

router.patch(
    "/:paymentId/cancel",
    authorize("customer"),
    paymentIdValidator,
    cancel
);

router.patch(
    "/:paymentId/report-failure",
    authorize("customer"),
    paymentIdValidator,
    reportFailure
);

router.patch(
    "/:paymentId/reconcile",
    authorize("admin", "customer"),
    paymentIdValidator,
    reconcile
);

/*
|--------------------------------------------------------------------------
| Payment Retrieval
|--------------------------------------------------------------------------
*/

router.get(
    "/",
    authorize("admin", "customer"),
    getAll
);

/*
|--------------------------------------------------------------------------
| Administrator Routes
|--------------------------------------------------------------------------
*/

router.patch(
    "/:paymentId/verify",
    authorize("admin"),
    verifyPaymentValidator,
    verify
);

/*
|--------------------------------------------------------------------------
| Refunds
|--------------------------------------------------------------------------
*/

router.patch(
    "/:paymentId/refund/reconcile",
    authorize("admin"),
    reconcileRefundValidator,
    reconcileRefundStatus
);

router.patch(
    "/:paymentId/refund/send",
    authorize("admin"),
    sendRefundValidator,
    sendRefund
);

router.patch(
    "/:paymentId/refund/complete",
    authorize("admin"),
    completeRefundValidator,
    completeRefund
);

export default router;

