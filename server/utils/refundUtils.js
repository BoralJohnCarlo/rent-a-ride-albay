import { RENTAL_REFUND_STATUS } from "../constants/rentalConstants.js";
import { PAYMENT_REFUND_STATUS } from "../constants/paymentConstants.js";

/*
 * Whether a Rental.refunds entry is money the customer actually got (or is
 * getting) back. Only Approved refunds count (a missing status is a legacy
 * admin-recorded refund, i.e. Approved) — and not one an admin settled as
 * "not completed" (gatewayStatus "failed"): no money moved, so it must not
 * lower the rental total, the refundable balance, revenue or the payout.
 */
export const isRefundInEffect = (refund) =>
    (refund?.status || RENTAL_REFUND_STATUS.APPROVED) ===
        RENTAL_REFUND_STATUS.APPROVED &&
    refund?.gatewayStatus !== PAYMENT_REFUND_STATUS.FAILED;

/* Mongo `$match` equivalent of isRefundInEffect, for unwound `refunds`. */
export const REFUND_IN_EFFECT_MATCH = Object.freeze({
    "refunds.status": { $in: [RENTAL_REFUND_STATUS.APPROVED, null] },
    "refunds.gatewayStatus": { $ne: PAYMENT_REFUND_STATUS.FAILED },
});
