export const BOOKING_STATUS = {
    PENDING: "Pending",
    PAYMENT_RECEIVED: "Payment Received",
    APPROVED: "Approved",
    ONGOING: "Ongoing",
    COMPLETED: "Completed",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    EXPIRED: "Expired",
    // Approved, but the customer never came to pick the vehicle up.
    NO_SHOW: "No Show",
};

/*
 * Statuses of a booking that ended without the trip ever happening. Such a
 * booking holds no vehicle, driver or dates, and can't take a payment.
 */
export const BOOKING_ENDED_WITHOUT_TRIP_STATUSES = Object.freeze([
    BOOKING_STATUS.REJECTED,
    BOOKING_STATUS.CANCELLED,
    BOOKING_STATUS.EXPIRED,
    BOOKING_STATUS.NO_SHOW,
]);

export const BOOKING_STATUS_VALUES =
    Object.values(BOOKING_STATUS);


export const BOOKING_DRIVER_OPTIONS = {
    WITH_DRIVER: "With Driver",
    WITHOUT_DRIVER: "Without Driver",
};

export const BOOKING_DRIVER_OPTION_VALUES =
    Object.values(BOOKING_DRIVER_OPTIONS);


export const BOOKING_EXTENSION_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};

export const BOOKING_EXTENSION_STATUS_VALUES =
    Object.values(BOOKING_EXTENSION_STATUS);


/*
 * Moving a booking to new dates before pickup. The customer requests it and an
 * admin approves (or the admin reschedules directly). Same four states as an
 * extension request.
 */
export const BOOKING_RESCHEDULE_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};

export const BOOKING_RESCHEDULE_STATUS_VALUES =
    Object.values(BOOKING_RESCHEDULE_STATUS);

/*
 * A customer asking for a different driver before pickup (an admin decides).
 * Admins can also change the driver directly.
 */
export const DRIVER_CHANGE_REQUEST_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    DECLINED: "Declined",
    CANCELLED: "Cancelled",
};

export const DRIVER_CHANGE_REQUEST_STATUS_VALUES = Object.values(
    DRIVER_CHANGE_REQUEST_STATUS
);

// Customers ask at least this long before pickup (same as reschedules).
export const DRIVER_CHANGE_MIN_NOTICE_HOURS = 24;

// A customer must ask at least this long before the current pickup time.
export const BOOKING_RESCHEDULE_MIN_NOTICE_HOURS = 24;

// Approved reschedules allowed per booking; after that it's cancel-and-rebook.
export const BOOKING_RESCHEDULE_MAX_APPROVED = 1;

// How the price difference of an approved reschedule was settled.
export const BOOKING_RESCHEDULE_SETTLEMENT = {
    NONE: "none",
    CHARGE: "charge",
    REFUND: "refund",
};

export const BOOKING_RESCHEDULE_SETTLEMENT_VALUES =
    Object.values(BOOKING_RESCHEDULE_SETTLEMENT);


/*
 * A booking not picked up yet whose vehicle was put under maintenance over
 * its dates (Booking.maintenanceConflict). Admins see it as Detected, then
 * send the customer the options (AwaitingCustomer): move to another vehicle
 * for the same dates, or cancel with a full refund. Left unanswered past
 * respondBy, it's cancelled and refunded in full automatically. Cleared when
 * the maintenance no longer overlaps the booking (ended early or shortened).
 */
/*
 * Booking.maintenanceConflict is a "vehicle conflict": the booked vehicle
 * won't be ready for a booking not picked up yet. Its `cause` says why —
 * maintenance over its dates, or the previous renter returning it late.
 * Both share the statuses and the customer's options (another vehicle or
 * a full refund); a late return adds Waiting (the customer chose to wait).
 */
export const BOOKING_MAINTENANCE_CONFLICT_STATUS = {
    DETECTED: "Detected",
    AWAITING_CUSTOMER: "AwaitingCustomer",
    // Late return only: the customer chose to wait for the vehicle.
    WAITING: "Waiting",
    VEHICLE_CHANGED: "VehicleChanged",
    REFUNDED: "Refunded",
    CLEARED: "Cleared",
};

export const BOOKING_MAINTENANCE_CONFLICT_STATUS_VALUES =
    Object.values(BOOKING_MAINTENANCE_CONFLICT_STATUS);

export const BOOKING_MAINTENANCE_CONFLICT_ACTIVE_STATUSES = Object.freeze([
    BOOKING_MAINTENANCE_CONFLICT_STATUS.DETECTED,
    BOOKING_MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
    BOOKING_MAINTENANCE_CONFLICT_STATUS.WAITING,
]);

export const BOOKING_VEHICLE_CONFLICT_CAUSE = {
    MAINTENANCE: "Maintenance",
    LATE_RETURN: "LateReturn",
};

export const BOOKING_VEHICLE_CONFLICT_CAUSE_VALUES =
    Object.values(BOOKING_VEHICLE_CONFLICT_CAUSE);

/*
 * Late returns (services/lateReturnConflictService.js):
 * - heads-up: once the previous rental is overdue, bookings of that vehicle
 *   whose pickup is within HEADS_UP_HOURS are flagged and their customers
 *   warned;
 * - options: once the vehicle can no longer be back and turned around by
 *   the pickup time, the customer is sent their options automatically and
 *   has until the pickup time + the no-show grace to choose;
 * - waiting: a customer who chose to wait is refunded in full if the
 *   vehicle still isn't back WAIT_MAX_HOURS after pickup (or by the booked
 *   return, if sooner).
 */
export const LATE_RETURN_HEADS_UP_HOURS = 24;

export const LATE_RETURN_WAIT_MAX_HOURS = 24;

// Never less than this to choose, even when detected at the last minute.
export const LATE_RETURN_MIN_RESPONSE_MINUTES = 60;

/*
 * The customer's deadline to choose: this long after the options are sent,
 * but no later than RESPONSE_BEFORE_PICKUP_HOURS before pickup — and never
 * less than MIN_RESPONSE_HOURS from now (capped at the pickup time itself).
 */
export const BOOKING_MAINTENANCE_CONFLICT_RESPONSE_HOURS = 48;

export const BOOKING_MAINTENANCE_CONFLICT_RESPONSE_BEFORE_PICKUP_HOURS = 24;

export const BOOKING_MAINTENANCE_CONFLICT_MIN_RESPONSE_HOURS = 2;


export const BOOKING_EXTENSION_PRICING_METHOD = {
    FIXED_RATE: "Fixed Rate",
    PER_HOUR: "Per Hour",
};

export const BOOKING_EXTENSION_PRICING_METHOD_VALUES =
    Object.values(
        BOOKING_EXTENSION_PRICING_METHOD
    );


export const BOOKING_CODE_PREFIX = "BK-";


/*
 * How long a customer has to pay the reservation fee after creating a booking
 * before the reservation is auto-released, and how many hours before that
 * deadline the "complete your payment" reminder is sent.
 */
export const BOOKING_RESERVATION_PAYMENT_WINDOW_HOURS = 24;

export const BOOKING_RESERVATION_PAYMENT_REMINDER_HOURS = 6;

/*
 * Bookings store the pickup date AND time the customer chose (Philippine
 * time, UTC+8, no DST); the return is the same time on the return date, so
 * rentals stay whole days. "Hours before pickup" (cancellation, no-show,
 * reschedule notice) is measured from that stored time.
 *
 * This hour is the default pickup time — and what older, date-only bookings
 * are read as: a bare date such as "2026-10-10" parses as UTC midnight, which
 * is exactly 8:00 AM in Manila.
 */
export const BOOKING_PICKUP_REFERENCE_HOUR = 8;

export const BOOKING_TIMEZONE_OFFSET_HOURS = 8;

/*
 * Pickup times a customer can choose, in minutes after Manila midnight, in
 * 30-minute steps. The window is admin-configurable (Settings → Bookings →
 * Pickup Hours, bookingSettings.pickupHours); these are its defaults, 8:00 AM
 * to 6:00 PM. Read the live window through resolvePickupHours /
 * getPickupSlotMinutes (utils/bookingHours.js). Mirrored on the client in
 * utils/pickupTime.js.
 */
export const BOOKING_PICKUP_EARLIEST_MINUTE = 8 * 60;

export const BOOKING_PICKUP_LATEST_MINUTE = 18 * 60;

export const BOOKING_PICKUP_STEP_MINUTES = 30;

export const DEFAULT_PICKUP_HOURS = Object.freeze({
    earliestTime: "08:00",
    latestTime: "18:00",
});

/*
 * The earliest a vehicle can be released ahead of the booked pickup time.
 * Mirrored on the client in constants/bookingStatus.js.
 */
export const BOOKING_EARLY_PICKUP_MAX_HOURS = 12;

/*
 * A new (or rescheduled) booking's pickup must be at least this far away, so
 * there's time to pay the reservation fee and for an admin to approve.
 * Mirrored on the client in utils/pickupTime.js.
 */
export const BOOKING_MIN_LEAD_HOURS = 2;

/*
 * Booking hours (Settings → Bookings): when staff are around to approve new
 * bookings. When enabled, the minimum notice above only counts while they're
 * open, so a booking made overnight can't be picked up first thing in the
 * morning before anyone could approve it. Times are "HH:mm" Manila, in
 * 30-minute steps, open before close. Off by default. Mirrored on the client
 * in utils/pickupTime.js.
 */
export const DEFAULT_BOOKING_HOURS = Object.freeze({
    enabled: false,
    openTime: "08:00",
    closeTime: "20:00",
});

export const BOOKING_HOURS_STEP_MINUTES = 30;

/*
 * Admins are alerted when a paid booking is this close to its pickup time
 * and still not approved (and again once the pickup time has passed).
 */
export const BOOKING_APPROVAL_ALERT_HOURS = 2;

/*
 * Turnaround buffer: the minimum gap between one rental's due-back time and
 * the next pickup of the same vehicle (or driver), for cleaning and
 * inspection. Admin-configurable in Settings → Bookings, never below 2 hours.
 * Mirrored on the client in constants/bookingStatus.js.
 */
export const DEFAULT_TURNAROUND_BUFFER_MINUTES = 120;

export const MIN_TURNAROUND_BUFFER_MINUTES = 120;

export const MAX_TURNAROUND_BUFFER_MINUTES = 24 * 60;

export const TURNAROUND_BUFFER_STEP_MINUTES = 30;

/*
 * No-shows: an admin may mark an Approved booking as a no-show once this many
 * hours have passed since the pickup reference time (default; editable in
 * Settings → Refunds). Bookings still not picked up by the end of their start
 * date are marked automatically.
 */
export const DEFAULT_NO_SHOW_GRACE_HOURS = 4;

export const MAX_NO_SHOW_GRACE_HOURS = 16;