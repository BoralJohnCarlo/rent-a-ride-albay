import createError from "./createError.js";

export const BOOKING_PRICE_CHANGED_MESSAGE =
    "Booking pricing has changed. Please review the updated total before submitting again.";

export const PAYMENT_AMOUNT_CHANGED_MESSAGE =
    "The payment amount has changed. Please review the updated amount before paying.";

export const assertCheckoutAmountMatches = (expected, actual) => {
    if (typeof expected !== "number" || !Number.isFinite(expected) || expected <= 0) {
        throw createError("The reviewed payment amount is missing or invalid. Please reload checkout.", 400);
    }
    if (Math.round(expected * 100) !== Math.round(actual * 100)) {
        throw createError(PAYMENT_AMOUNT_CHANGED_MESSAGE, 409);
    }
};

// Compare pesos as centavos so harmless floating-point differences do not
// invalidate a quote. Check both total and upfront: either can change alone.
export const assertBookingQuoteMatches = (expected, totalAmount, upfrontAmount) => {
    for (const [key, actual] of [["totalAmount", totalAmount], ["upfrontAmount", upfrontAmount]]) {
        if (typeof expected?.[key] !== "number" || !Number.isFinite(expected[key]) || expected[key] < 0) {
            throw createError("The reviewed booking price is missing or invalid. Please reload and review your booking.", 400);
        }
        if (Math.round(expected[key] * 100) !== Math.round(actual * 100)) {
            throw createError(BOOKING_PRICE_CHANGED_MESSAGE, 409);
        }
    }
};
