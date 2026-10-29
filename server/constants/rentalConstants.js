export const RENTAL_STATUS = {
    ONGOING: "Ongoing",
    COMPLETED: "Completed",
};

export const RENTAL_STATUS_VALUES =
    Object.values(RENTAL_STATUS);

export const RENTAL_CODE_PREFIX = "RN-";

export const RENTAL_INSPECTION_CONDITION = {
    EXCELLENT: "Excellent",
    GOOD: "Good",
    FAIR: "Fair",
    POOR: "Poor",
    DAMAGED: "Damaged",
};

export const RENTAL_INSPECTION_CONDITION_VALUES =
    Object.values(
        RENTAL_INSPECTION_CONDITION
    );

export const RENTAL_CHARGE_TYPE = {
    EXTENSION: "Extension",
    LATE: "Late",
    DAMAGE: "Damage",
    OTHER: "Other",
};

export const RENTAL_CHARGE_TYPE_VALUES =
    Object.values(RENTAL_CHARGE_TYPE);

export const RENTAL_ADJUSTMENT_TYPE = {
    DISCOUNT: "Discount",
    ADJUSTMENT: "Adjustment",
};

export const RENTAL_ADJUSTMENT_TYPE_VALUES =
    Object.values(RENTAL_ADJUSTMENT_TYPE);

export const RENTAL_PAYMENT_TYPE = {
    DOWN_PAYMENT: "Down Payment",
    FULL_PAYMENT: "Full Payment",
    ADDITIONAL_PAYMENT: "Additional Payment",
};

export const RENTAL_PAYMENT_TYPE_VALUES =
    Object.values(
        RENTAL_PAYMENT_TYPE
    );

export const RENTAL_PAYMENT_STATUS = {
    PENDING: "Pending",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
};

export const RENTAL_PAYMENT_STATUS_VALUES =
    Object.values(
        RENTAL_PAYMENT_STATUS
    );

export const RENTAL_PAYMENT_METHOD = {
    CASH: "Cash",
    BANK_TRANSFER: "Bank Transfer",
    GCASH: "GCash",
    OTHER: "Other",
};

export const RENTAL_PAYMENT_METHOD_VALUES =
    Object.values(
        RENTAL_PAYMENT_METHOD
    );

export const RENTAL_SECURITY_DEPOSIT_STATUS = {
    NOT_REQUIRED: "Not Required",
    PENDING: "Pending",
    HELD: "Held",
    PARTIALLY_DEDUCTED: "Partially Deducted",
    FULLY_DEDUCTED: "Fully Deducted",
    RELEASED: "Released",
};

export const RENTAL_SECURITY_DEPOSIT_STATUS_VALUES =
    Object.values(
        RENTAL_SECURITY_DEPOSIT_STATUS
    );

export const RENTAL_REFUND_REASON = {
    CANCELLATION: "Cancellation",
    OVERPAYMENT: "Overpayment",
    ADJUSTMENT: "Adjustment",
    VEHICLE_PERFORMANCE_ISSUE: "Vehicle Performance Issue",
    OTHER: "Other",
};

export const RENTAL_REFUND_REASON_VALUES =
    Object.values(
        RENTAL_REFUND_REASON
    );

export const RENTAL_REFUND_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

export const RENTAL_REFUND_STATUS_VALUES =
    Object.values(
        RENTAL_REFUND_STATUS
    );

export const RENTAL_EARLY_RETURN_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
};

export const RENTAL_EARLY_RETURN_STATUS_VALUES =
    Object.values(
        RENTAL_EARLY_RETURN_STATUS
    );

export const RENTAL_OPERATIONAL_EVENT = {
    PICKUP: "Pickup",
    RETURN: "Return",
    DRIVER_REASSIGNED: "Driver Reassigned",
    NO_SHOW: "No Show",
    CHARGE_ADDED: "Charge Added",
    PAYMENT_RECORDED: "Payment Recorded",
    PAYMENT_VERIFIED: "Payment Verified",
    PAYMENT_REJECTED: "Payment Rejected",
    REFUND_RECORDED: "Refund Recorded",
    REFUND_REQUESTED: "Refund Requested",
    REFUND_APPROVED: "Refund Approved",
    REFUND_REJECTED: "Refund Rejected",
    REFUND_REMOVED: "Refund Removed",
    REFUND_SETTLED: "Refund Settled",
    EARLY_RETURN_CREDIT_APPROVED: "Early Return Credit Approved",
    EARLY_RETURN_CREDIT_REJECTED: "Early Return Credit Rejected",
    VEHICLE_OUTCOME_UPDATED: "Vehicle Outcome Updated",
    COMPLETED: "Completed",
};

export const MAX_REFUND_AMOUNT = 999999999.99;

export const RENTAL_OPERATIONAL_EVENT_VALUES =
    Object.values(
        RENTAL_OPERATIONAL_EVENT
    );

/*
 * What happens to the vehicle after the rental. Maintenance comes with a
 * plan (Rental.maintenancePlan: turnaround, a number of days, or off road —
 * see VEHICLE_MAINTENANCE_MODE), applied to the vehicle as soon as it's set.
 */
export const RENTAL_VEHICLE_OUTCOME = {
    AVAILABLE: "Available",
    MAINTENANCE: "Maintenance",
};

export const RENTAL_VEHICLE_OUTCOME_VALUES =
    Object.values(
        RENTAL_VEHICLE_OUTCOME
    );

export const REVIEW_RATING_VALUES = [1, 2, 3, 4, 5];

export const RENTAL_FUEL_LEVEL_UNIT =
    "Percentage";

export const RENTAL_CODE_LENGTH = 4;