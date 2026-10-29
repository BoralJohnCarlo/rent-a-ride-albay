export const PAYMENT_METHOD = Object.freeze({
    GCASH: "GCASH",
    // Kept for bookings made before the reservation fee became online-only
    // (and extension fees that inherit it); no new reservation uses it.
    CASH_ON_PICKUP: "CASH_ON_PICKUP",
});

export const CASH_RESERVATION_NOT_ALLOWED_MESSAGE =
    "The reservation fee must be paid online (GCash) to confirm a booking. The rest of the rental can still be paid in cash when you pick up the vehicle.";

export const PAYMENT_TYPE = Object.freeze({
    RESERVATION_FEE: "RESERVATION_FEE",
    EXTENSION_FEE: "EXTENSION_FEE",
});

export const PAYMENT_STATUS = Object.freeze({
    PENDING: "PENDING",
    VERIFIED: "VERIFIED",
    CANCELLED: "CANCELLED",
    REFUNDED: "REFUNDED",
});

/*
 * PayMongo's Refund resource lifecycle (its `status` values, lowercase,
 * matched exactly so a webhook/reconcile payload can be stored as-is).
 * A refund is not necessarily instant: pending/processing precede a final
 * succeeded or failed.
 */
export const PAYMENT_REFUND_STATUS = Object.freeze({
    PENDING: "pending",
    PROCESSING: "processing",
    SUCCEEDED: "succeeded",
    FAILED: "failed",
    // Not a PayMongo status: set locally when there is no gateway charge to
    // refund automatically (e.g. Cash on Pickup) and an admin must complete
    // the refund outside the app, then close it out via the API.
    REQUIRES_MANUAL_ACTION: "requires_manual_action",
});

/* PayMongo's allowed `reason` values for a refund. */
/*
 * A refund the business owes a customer that no payment can carry (a Payment
 * holds a single refund record), so an admin pays it outside the app and then
 * records the outcome. See models/ManualRefund.js.
 */
export const MANUAL_REFUND_STATUS = Object.freeze({
    OWED: "Owed",
    PAID: "Paid",
    // The admin couldn't pay it (e.g. the customer can't be reached).
    NOT_PAID: "Not Paid",
});

export const MANUAL_REFUND_STATUS_VALUES = Object.values(
    MANUAL_REFUND_STATUS
);

export const PAYMENT_REFUND_REASON = Object.freeze({
    DUPLICATE: "duplicate",
    FRAUDULENT: "fraudulent",
    REQUESTED_BY_CUSTOMER: "requested_by_customer",
    OTHERS: "others",
});
