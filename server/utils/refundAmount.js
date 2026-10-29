import createError from "./createError.js";

// Use the same whole-centavo amount in the ledger and at the gateway.
// Tolerate binary floating-point noise from ordinary currency arithmetic.
export const refundCentavos = (value) => {
    const scaled = Number(value) * 100;
    const cents = Math.round(scaled);
    const tolerance = Math.max(1e-7, Math.abs(scaled) * Number.EPSILON * 2);
    if (!Number.isSafeInteger(cents) || cents < 1 || Math.abs(scaled - cents) > tolerance) {
        throw createError("Refund amount must be at least ₱0.01 and have at most two decimal places.", 400);
    }
    return cents;
};

export const normalizeRefundAmount = (value) => refundCentavos(value) / 100;
