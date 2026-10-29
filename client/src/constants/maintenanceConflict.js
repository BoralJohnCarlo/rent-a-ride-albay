/*
 * A booking not picked up yet whose vehicle won't be ready for it
 * (booking.maintenanceConflict): it went under maintenance over its dates,
 * or the previous renter is returning it late (`cause`). Mirrors the
 * server's BOOKING_MAINTENANCE_CONFLICT_STATUS / BOOKING_VEHICLE_CONFLICT_CAUSE.
 */
export const MAINTENANCE_CONFLICT_STATUS = {
    DETECTED: "Detected",
    AWAITING_CUSTOMER: "AwaitingCustomer",
    // Late return only: the customer chose to wait for the vehicle.
    WAITING: "Waiting",
    VEHICLE_CHANGED: "VehicleChanged",
    REFUNDED: "Refunded",
    CLEARED: "Cleared",
};

export const VEHICLE_CONFLICT_CAUSE = {
    MAINTENANCE: "Maintenance",
    LATE_RETURN: "LateReturn",
};

const UNPICKED_BOOKING_STATUSES = ["Pending", "Payment Received", "Approved"];

const OPEN_STATUSES = [
    MAINTENANCE_CONFLICT_STATUS.DETECTED,
    MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
    MAINTENANCE_CONFLICT_STATUS.WAITING,
];

export const isLateReturnConflict = (booking) =>
    booking?.maintenanceConflict?.cause === VEHICLE_CONFLICT_CAUSE.LATE_RETURN;

/* Still needs resolving: flagged, awaiting the customer or waiting. */
export const hasOpenMaintenanceConflict = (booking) =>
    OPEN_STATUSES.includes(booking?.maintenanceConflict?.status) &&
    UNPICKED_BOOKING_STATUSES.includes(booking?.status);

/* The customer can choose now (options sent, or waiting and may change). */
export const isAwaitingCustomerChoice = (booking) =>
    hasOpenMaintenanceConflict(booking) &&
    [
        MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER,
        MAINTENANCE_CONFLICT_STATUS.WAITING,
    ].includes(booking.maintenanceConflict.status);

const LABELS = {
    [MAINTENANCE_CONFLICT_STATUS.DETECTED]: "Options not sent yet",
    [MAINTENANCE_CONFLICT_STATUS.AWAITING_CUSTOMER]: "Waiting for the customer",
    [MAINTENANCE_CONFLICT_STATUS.WAITING]: "Customer is waiting for the vehicle",
    [MAINTENANCE_CONFLICT_STATUS.VEHICLE_CHANGED]: "Moved to another vehicle",
    [MAINTENANCE_CONFLICT_STATUS.REFUNDED]: "Cancelled — full refund",
    [MAINTENANCE_CONFLICT_STATUS.CLEARED]: "Resolved — vehicle ready in time",
};

const LATE_RETURN_LABELS = {
    ...LABELS,
    [MAINTENANCE_CONFLICT_STATUS.DETECTED]: "At risk — customer warned",
    [MAINTENANCE_CONFLICT_STATUS.CLEARED]: "Resolved — vehicle returned",
};

export const MAINTENANCE_CONFLICT_LABELS = LABELS;

export const getConflictLabel = (conflict) =>
    (conflict?.cause === VEHICLE_CONFLICT_CAUSE.LATE_RETURN
        ? LATE_RETURN_LABELS
        : LABELS)[conflict?.status] ?? conflict?.status;

export const getConflictCauseLabel = (conflict) =>
    conflict?.cause === VEHICLE_CONFLICT_CAUSE.LATE_RETURN
        ? "Late return"
        : "Maintenance";

export const formatConflictDateTime = (value) =>
    value
        ? new Date(value).toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
          })
        : "";

/* "3 hr 20 min" between two instants (or until now). */
export const formatLateness = (from, to = Date.now()) => {
    const minutes = Math.max(
        0,
        Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)
    );
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const rest = minutes % 60;

    return (
        [
            days ? `${days} day${days === 1 ? "" : "s"}` : null,
            hours ? `${hours} hr` : null,
            rest && !days ? `${rest} min` : null,
        ]
            .filter(Boolean)
            .join(" ") || "under a minute"
    );
};
