import {
    VEHICLE_STATUS,
    VEHICLE_MAINTENANCE_MODE,
    MAX_VEHICLE_MAINTENANCE_DAYS,
} from "../constants/vehicleConstants.js";
import { BUSINESS_TIMEZONE } from "./businessTime.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * A vehicle's maintenance window as epoch ms [start, end) — end Infinity for
 * off road — or null when nothing currently blocks it. Every availability
 * check (booking, approval, reschedule, extension, pickup, calendars, browse)
 * reads it from here, so the vehicle stays listed and only these dates are
 * refused. A window that has already ended counts as none, even if the
 * Maintenance status hasn't been cleared by the sweep yet.
 */
export const getMaintenanceWindow = (vehicle, now = Date.now()) => {
    if (!vehicle) {
        return null;
    }

    const maintenance = vehicle.maintenance || {};

    if (maintenance.mode) {
        const start = maintenance.startedAt
            ? new Date(maintenance.startedAt).getTime()
            : 0;

        const end =
            maintenance.mode === VEHICLE_MAINTENANCE_MODE.OFF_ROAD ||
            !maintenance.until
                ? Infinity
                : new Date(maintenance.until).getTime();

        if (end <= now) {
            return null;
        }

        return {
            mode: maintenance.mode,
            start,
            end,
            until: Number.isFinite(end) ? new Date(end) : null,
        };
    }

    // Put under maintenance before modes existed: no end date.
    if (vehicle.status === VEHICLE_STATUS.MAINTENANCE) {
        return {
            mode: VEHICLE_MAINTENANCE_MODE.OFF_ROAD,
            start: 0,
            end: Infinity,
            until: null,
        };
    }

    return null;
};

export const overlapsMaintenance = (vehicle, startDate, endDate) => {
    const window = getMaintenanceWindow(vehicle);

    if (!window) {
        return false;
    }

    return (
        new Date(startDate).getTime() < window.end &&
        new Date(endDate).getTime() > window.start
    );
};

export const formatMaintenanceDate = (value) =>
    new Date(value).toLocaleString("en-PH", {
        timeZone: BUSINESS_TIMEZONE,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/*
 * Customer-facing reason a booking can't use the vehicle for these dates.
 * With the off-road notice turned off (Settings → Bookings → Off-Road
 * Vehicles), an off-road vehicle reads like any blocked dates.
 */
export const describeMaintenanceBlock = (
    window,
    { showOffRoadNotice = true } = {}
) => {
    if (window && Number.isFinite(window.end)) {
        return `This vehicle is under maintenance until ${formatMaintenanceDate(
            window.end
        )}. Please choose dates after that, or another vehicle.`;
    }

    return showOffRoadNotice
        ? "This vehicle is temporarily off the road for maintenance and can't be booked right now. Please choose another vehicle."
        : "This vehicle can't be booked because its dates are blocked. Please choose another vehicle.";
};

/*
 * When maintenance of this kind, starting at `from`, ends (null: no end).
 * Throws on a bad mode or day count.
 */
export const computeMaintenanceUntil = (
    mode,
    from,
    { days = null, bufferMs = 0 } = {}
) => {
    const fromMs = new Date(from).getTime();

    if (mode === VEHICLE_MAINTENANCE_MODE.TURNAROUND) {
        return new Date(fromMs + bufferMs);
    }

    if (mode === VEHICLE_MAINTENANCE_MODE.EXTENDED) {
        const count = Number(days);

        if (
            !Number.isInteger(count) ||
            count < 1 ||
            count > MAX_VEHICLE_MAINTENANCE_DAYS
        ) {
            const error = new Error(
                `Maintenance must last between 1 and ${MAX_VEHICLE_MAINTENANCE_DAYS} days.`
            );
            error.statusCode = 400;
            throw error;
        }

        return new Date(fromMs + count * DAY_MS);
    }

    if (mode === VEHICLE_MAINTENANCE_MODE.OFF_ROAD) {
        return null;
    }

    const error = new Error("Invalid maintenance type.");
    error.statusCode = 400;
    throw error;
};

/* The maintenance details safe to show anyone (no reason, no admin). */
export const toPublicMaintenance = (vehicle) => {
    const window = getMaintenanceWindow(vehicle);

    return window
        ? {
              active: true,
              mode: window.mode,
              until: window.until,
          }
        : null;
};
