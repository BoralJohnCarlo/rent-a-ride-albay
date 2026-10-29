/*
 * Mirrors server/services/driverPricingService.js so the booking form quotes
 * the same driver fee the server will charge. The server stays the source of
 * truth: it re-prices every booking itself.
 */

const toRate = (value) => {
    const rate = Number(value);
    return Number.isFinite(rate) && rate > 0 ? Math.round(rate * 100) / 100 : 0;
};

/*
 * The per-day driver rate for a "With Driver" booking: the global rate, or
 * (individual mode, customer choosing) the selected driver's own rate,
 * falling back to the global rate when the driver has none.
 */
export const getDriverDailyRate = ({
    driverOption,
    driver = null,
    driverPricing,
    requireAdminDriverAssignment = false,
}) => {
    if (driverOption !== "With Driver") {
        return 0;
    }

    const globalRate = toRate(driverPricing?.globalDailyRate);

    if (driverPricing?.mode !== "individual" || requireAdminDriverAssignment) {
        return globalRate;
    }

    const ownRate = driver?.pricing?.dailyRate;

    return ownRate === null || ownRate === undefined
        ? globalRate
        : toRate(ownRate);
};

/* A driver's own rate as shown to customers (individual mode only). */
export const getDriverListRate = (driver, driverPricing) =>
    driverPricing?.mode === "individual"
        ? getDriverDailyRate({
              driverOption: "With Driver",
              driver,
              driverPricing,
          })
        : null;
