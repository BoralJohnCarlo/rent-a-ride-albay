export const PAYOUT_STATUS = Object.freeze({
    PENDING: "PENDING",
    APPROVED: "APPROVED",
    SCHEDULED: "SCHEDULED",
    PAID: "PAID",
    REJECTED: "REJECTED",
    CANCELLED: "CANCELLED",
});

export const PAYOUT_STATUS_VALUES = Object.values(PAYOUT_STATUS);

export const PAYOUT_METHOD = Object.freeze({
    GCASH: "GCASH",
    BANK: "BANK",
});

export const PAYOUT_METHOD_VALUES = Object.values(PAYOUT_METHOD);