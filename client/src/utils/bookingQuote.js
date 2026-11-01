export const isBookingPriceChangedError = (message) =>
    typeof message === "string" && message.startsWith("Booking pricing has changed.");

export const isPaymentAmountChangedError = (message) =>
    typeof message === "string" && message.startsWith("The payment amount has changed.");
