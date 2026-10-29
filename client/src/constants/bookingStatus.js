export const BOOKING_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    // Approved, but the customer never came to pick the vehicle up.
    NO_SHOW: "No Show",
};

/*
 * Mirrors the server's no-show rule (getNoShowEligibleAt in
 * cancellationPolicyService): an admin may mark an Approved booking as a
 * no-show from `graceHours` after its booked pickup time — or after the
 * approval, if the booking was approved later than that. Same pickup
 * reference as the cancellation policy.
 */
export const DEFAULT_NO_SHOW_GRACE_HOURS = 4;

/*
 * Mirrors the server's turnaround buffer limits (bookingConstants.js): the
 * minimum gap between a vehicle's due-back time and its next pickup, set in
 * Settings → Bookings.
 */
/* Mirrors BOOKING_EARLY_PICKUP_MAX_HOURS: how early a vehicle can be
   released before the booked pickup time. */
export const EARLY_PICKUP_MAX_HOURS = 12;

/* The earliest moment a booking's vehicle can be released, or null. */
export const getEarliestPickupAt = (booking) => {
    const pickupAt = getPickupReferenceMs(booking?.startDate);

    return pickupAt === null
        ? null
        : new Date(pickupAt - EARLY_PICKUP_MAX_HOURS * 60 * 60 * 1000);
};

export const DEFAULT_TURNAROUND_BUFFER_MINUTES = 120;
export const MIN_TURNAROUND_BUFFER_MINUTES = 120;
export const MAX_TURNAROUND_BUFFER_MINUTES = 24 * 60;
export const TURNAROUND_BUFFER_STEP_MINUTES = 30;

/* Mirrors the server's BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS: an unpaid
   Pending booking is released once this long has passed since it was made —
   or at its pickup time if that's sooner (getReservationPaymentDeadline). */
export const BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

/* Mirrors the server's getReservationPaymentDeadline. */
export const getReservationPaymentDeadline = (booking) => {
    const created = new Date(booking?.createdAt).getTime();

    if (!Number.isFinite(created)) {
        return null;
    }

    const windowEnd =
        created + BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS * HOUR_MS;
    const pickupAt = getPickupReferenceMs(booking?.startDate);

    return new Date(
        pickupAt === null ? windowEnd : Math.min(windowEnd, pickupAt)
    );
};

/* The most recent approval in the booking's status history, or null. */
const getApprovedAt = (booking) => {
    const history = Array.isArray(booking?.statusHistory)
        ? booking.statusHistory
        : [];

    for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index]?.status === BOOKING_STATUS.APPROVED) {
            const approvedAt = new Date(history[index].changedAt);

            return Number.isNaN(approvedAt.getTime()) ? null : approvedAt;
        }
    }

    return null;
};

/*
 * Mirrors the server's getPickupReference, in ms (null for an invalid date):
 * the booked pickup time as stored. A date stored as Manila midnight is a
 * bare date (never a bookable time), read as 8:00 AM Manila (00:00 UTC) on
 * that date — as older bookings were.
 */
const getPickupReferenceMs = (startDate) => {
    const start = new Date(startDate);

    if (Number.isNaN(start.getTime())) {
        return null;
    }

    const manila = new Date(start.getTime() + 8 * HOUR_MS);

    if (manila.getUTCHours() !== 0 || manila.getUTCMinutes() !== 0) {
        return start.getTime();
    }

    return Date.UTC(
        manila.getUTCFullYear(),
        manila.getUTCMonth(),
        manila.getUTCDate()
    );
};

/*
 * The no-show grace that applies to this booking: the longer of today's
 * (`graceHours`) and the one locked in its accepted terms, when it has one
 * (mirrors the server's lockedTermsService getBookingNoShowTiming).
 */
export const getBookingNoShowGraceHours = (booking, graceHours) => {
    const current = Math.max(0, Number(graceHours) || 0);
    const snapshot = booking?.termsAcceptance?.policySnapshot;

    if (!snapshot || typeof snapshot !== "object") {
        return current;
    }

    const locked =
        typeof snapshot.noShowGraceHours === "number"
            ? snapshot.noShowGraceHours
            : DEFAULT_NO_SHOW_GRACE_HOURS;

    return Math.max(current, locked);
};

export const getNoShowEligibleAt = (booking, graceHours) => {
    const pickupAt = getPickupReferenceMs(booking?.startDate);

    if (pickupAt === null) {
        return null;
    }

    const approvedAt = getApprovedAt(booking)?.getTime() ?? 0;

    return new Date(
        Math.max(pickupAt, approvedAt) +
            getBookingNoShowGraceHours(booking, graceHours) * HOUR_MS
    );
};

/*
 * Mirrors the server's getCustomerCancelCutoff: a customer can cancel an
 * approved booking until its booked pickup time — or, if
 * it was approved so late that leaves no time, until the no-show grace period
 * after approval has run. After that, not picking it up makes it a no-show.
 * `now` comes from the caller's clock state, so this stays a pure check
 * (0 = clock not started yet).
 */
export const isPastCancellationCutoff = (booking, graceHours, now) => {
    if (booking?.status !== BOOKING_STATUS.APPROVED || !now) {
        return false;
    }

    const startMs = getPickupReferenceMs(booking.startDate);

    if (startMs === null) {
        return false;
    }

    const approvedAt = getApprovedAt(booking);

    const afterApprovalMs = approvedAt
        ? approvedAt.getTime() +
          getBookingNoShowGraceHours(booking, graceHours) * HOUR_MS
        : startMs;

    return now >= Math.max(startMs, afterApprovalMs);
};

/* `now` comes from the caller's clock state, so this stays a pure check. */
export const canMarkNoShow = (booking, graceHours, now) => {
    if (booking?.status !== BOOKING_STATUS.APPROVED || !now) {
        return false;
    }

    const eligibleAt = getNoShowEligibleAt(booking, graceHours);

    return Boolean(eligibleAt) && now >= eligibleAt.getTime();
};

/*
 * Rescheduling (mirrors assertBookingReschedulable on the server, which has
 * the final say): before pickup, reservation paid, no extension, and only
 * once per booking. A customer must also ask at least 24 hours before the
 * booked pickup time.
 */
export const RESCHEDULE_MIN_NOTICE_HOURS = 24;

const RESCHEDULABLE_STATUSES = [
    BOOKING_STATUS.PENDING,
    "Payment Received",
    BOOKING_STATUS.APPROVED,
];

export const getPendingReschedule = (booking) =>
    (booking?.reschedules || []).find(
        (reschedule) => reschedule?.status === "Pending"
    ) ?? null;

export const hasBeenRescheduled = (booking) =>
    (booking?.reschedules || []).some(
        (reschedule) => reschedule?.status === "Approved"
    );

export const getRescheduleDeadline = (booking) => {
    const pickupAt = getPickupReferenceMs(booking?.startDate);

    if (pickupAt === null) {
        return null;
    }

    return new Date(pickupAt - RESCHEDULE_MIN_NOTICE_HOURS * HOUR_MS);
};

/* Everything except the 24-hour notice (which an admin may override). */
export const isReschedulable = (booking) =>
    RESCHEDULABLE_STATUSES.includes(booking?.status) &&
    !booking?.rental &&
    !hasBeenRescheduled(booking) &&
    booking?.paymentStatus !== "PENDING" &&
    !(booking?.extensions || []).some((extension) =>
        ["Pending", "Approved"].includes(extension?.status)
    );

/* `now` comes from the caller's clock state (0 = not started yet). */
export const canCustomerReschedule = (booking, now) => {
    if (!now || !isReschedulable(booking) || getPendingReschedule(booking)) {
        return false;
    }

    const deadline = getRescheduleDeadline(booking);

    return Boolean(deadline) && now <= deadline.getTime();
};

export const BOOKING_STATUS_VALUES =
    Object.values(BOOKING_STATUS);


export const BOOKING_DRIVER_OPTIONS = {
    WITH_DRIVER: "With Driver",
    WITHOUT_DRIVER: "Without Driver",
};

export const BOOKING_DRIVER_OPTION_VALUES =
    Object.values(
        BOOKING_DRIVER_OPTIONS
    );