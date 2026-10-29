import { BOOKING_EXTENSION_STATUS } from "../constants/bookingConstants.js";

/*
 * The moment a rental is expected back: the latest of its effective end date
 * and any approved extension's end date. Used for reminders, late-return
 * conflicts, and both late- and early-return calculations.
 *
 * Rentals timed from the actual pickup (bookingPeriod.actualStartDate) are
 * due at actualEndDate, which can fall before the booked end date after an
 * early pickup, or a late pickup that was capped by the next booking.
 * Older rentals also fold in the booked end date, as they always did.
 */
export const getExpectedReturnAt = (rental) => {
    const approvedExtensionEnd = (rental.extensions || []).reduce(
        (latest, extension) => {
            if (extension?.status !== BOOKING_EXTENSION_STATUS.APPROVED) {
                return latest;
            }

            const end = new Date(extension.requestedEndDate).getTime();

            return Number.isFinite(end) && end > latest ? end : latest;
        },
        0
    );

    const originalEnd = rental.bookingPeriod?.actualStartDate
        ? NaN
        : new Date(rental.bookingPeriod?.originalEndDate).getTime();

    const effectiveEnd = new Date(
        rental.actualEndDate || rental.bookingPeriod?.originalEndDate
    ).getTime();

    const candidates = [originalEnd, effectiveEnd, approvedExtensionEnd].filter(
        (value) => Number.isFinite(value) && value > 0
    );

    if (candidates.length === 0) {
        return null;
    }

    return new Date(Math.max(...candidates));
};
