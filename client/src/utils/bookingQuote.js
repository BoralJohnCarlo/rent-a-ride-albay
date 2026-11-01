export const isBookingPriceChangedError = (message) =>
    typeof message === "string" && message.startsWith("Booking pricing has changed.");
