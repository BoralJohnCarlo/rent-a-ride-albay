/*
 * Changing a booking's driver before pickup (server: bookingService
 * changeBookingDriver / requestDriverChange). Shared by the admin panel, the
 * admin Bookings list and the customer's booking page.
 */

export const DRIVER_CHANGEABLE_STATUSES = [
    "Pending",
    "Payment Received",
    "Approved",
];

// Customers ask at least this long before pickup (server mirrors it).
export const DRIVER_CHANGE_MIN_NOTICE_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export const getDriverName = (driver) =>
    [driver?.firstName, driver?.lastName].filter(Boolean).join(" ") ||
    "Driver";

/* A "With Driver" booking that hasn't been picked up yet. */
export const isDriverChangeable = (booking) =>
    booking?.driverOption === "With Driver" &&
    DRIVER_CHANGEABLE_STATUSES.includes(booking?.status);

export const getPendingDriverChangeRequest = (booking) =>
    (booking?.driverChangeRequests || []).find(
        (request) => request?.status === "Pending"
    ) ?? null;

/*
 * Why the assigned driver can't take this trip — suspended or inactive,
 * archived, or a licence that runs out before the trip ends — or null.
 * Pickup refuses such a driver, so the admin must change them first.
 */
export const getDriverIssue = (booking) => {
    if (!isDriverChangeable(booking)) {
        return null;
    }

    const driver = booking.driver;

    if (!driver || typeof driver !== "object") {
        return null;
    }

    if (driver.archive?.isArchived) {
        return "The assigned driver was archived.";
    }

    if (driver.status && driver.status !== "Active") {
        return `The assigned driver is ${driver.status.toLowerCase()}.`;
    }

    const expiry = driver.license?.expiryDate
        ? new Date(driver.license.expiryDate)
        : null;

    if (
        expiry &&
        booking.endDate &&
        expiry.getTime() < new Date(booking.endDate).getTime()
    ) {
        return "The assigned driver's license expires before the trip ends.";
    }

    return null;
};

/* Whether a customer may still ask for a different driver themselves. */
export const isWithinDriverChangeNotice = (booking, now = Date.now()) => {
    const pickupMs = new Date(booking?.startDate).getTime();

    return (
        Number.isFinite(pickupMs) &&
        now <= pickupMs - DRIVER_CHANGE_MIN_NOTICE_HOURS * HOUR_MS
    );
};
