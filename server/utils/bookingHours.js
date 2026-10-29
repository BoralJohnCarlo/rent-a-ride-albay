import {
    BOOKING_HOURS_STEP_MINUTES,
    BOOKING_MIN_LEAD_HOURS,
    BOOKING_PICKUP_STEP_MINUTES,
    DEFAULT_BOOKING_HOURS,
    DEFAULT_PICKUP_HOURS,
} from "../constants/bookingConstants.js";

/*
 * Booking hours (Settings → Bookings): the minimum notice for a new booking
 * only counts while staff are open to approve it. Pure functions, mirrored on
 * the client in utils/pickupTime.js — keep the two in step.
 */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/* "20:30" → 1230, or null if it isn't a valid "HH:mm". */
export const parseBookingHoursTime = (value) => {
    const match = TIME_PATTERN.exec(String(value ?? ""));

    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/* Why a booking-hours setting can't be saved, or null if it's fine. */
export const getBookingHoursError = (bookingHours) => {
    if (typeof bookingHours?.enabled !== "boolean") {
        return "Booking hours must be turned on or off.";
    }

    const open = parseBookingHoursTime(bookingHours.openTime);
    const close = parseBookingHoursTime(bookingHours.closeTime);

    if (open === null || close === null) {
        return "Booking hours need an opening and a closing time (HH:mm).";
    }

    if (
        open % BOOKING_HOURS_STEP_MINUTES !== 0 ||
        close % BOOKING_HOURS_STEP_MINUTES !== 0
    ) {
        return `Booking hours must be on the hour or half hour.`;
    }

    if (open >= close) {
        return "Booking hours must close after they open, on the same day.";
    }

    return null;
};

/* The stored setting, complete and valid (falls back to the default). */
export const resolveBookingHours = (bookingHours) => {
    const merged = {
        ...DEFAULT_BOOKING_HOURS,
        ...(bookingHours ?? {}),
    };

    return getBookingHoursError(merged)
        ? { ...DEFAULT_BOOKING_HOURS }
        : {
              enabled: merged.enabled,
              openTime: merged.openTime,
              closeTime: merged.closeTime,
          };
};

/* Why a pickup-hours setting can't be saved, or null if it's fine. */
export const getPickupHoursError = (pickupHours) => {
    const earliest = parseBookingHoursTime(pickupHours?.earliestTime);
    const latest = parseBookingHoursTime(pickupHours?.latestTime);

    if (earliest === null || latest === null) {
        return "Pickup hours need a first and a last pickup time (HH:mm).";
    }

    if (
        earliest % BOOKING_PICKUP_STEP_MINUTES !== 0 ||
        latest % BOOKING_PICKUP_STEP_MINUTES !== 0
    ) {
        return "Pickup hours must be on the hour or half hour.";
    }

    if (earliest > latest) {
        return "The last pickup time can't be earlier than the first.";
    }

    return null;
};

/* The stored pickup window, complete and valid (falls back to the default). */
export const resolvePickupHours = (pickupHours) => {
    const merged = {
        ...DEFAULT_PICKUP_HOURS,
        ...(pickupHours ?? {}),
    };

    return getPickupHoursError(merged)
        ? { ...DEFAULT_PICKUP_HOURS }
        : {
              earliestTime: merged.earliestTime,
              latestTime: merged.latestTime,
          };
};

/*
 * Every pickup time a customer can choose, as minutes after Manila midnight
 * (480, 510, … for 8:00, 8:30, …). Unset/invalid hours use the default.
 */
export const getPickupSlotMinutes = (pickupHours) => {
    const resolved = resolvePickupHours(pickupHours);
    const earliest = parseBookingHoursTime(resolved.earliestTime);
    const latest = parseBookingHoursTime(resolved.latestTime);

    const minutes = [];

    for (
        let minute = earliest;
        minute <= latest;
        minute += BOOKING_PICKUP_STEP_MINUTES
    ) {
        minutes.push(minute);
    }

    return minutes;
};

/*
 * The earliest pickup a booking made at `nowMs` may have: the minimum notice
 * after now, counting only open booking hours when they're enabled. For
 * example, with 8:00 AM – 8:00 PM and 2 hours' notice: booked 3:00 PM → 5:00
 * PM; 7:30 PM → 9:30 AM next day (30 minutes tonight, 90 tomorrow); 11:00 PM
 * or 6:00 AM → 10:00 AM.
 */
export const getEarliestPickupMs = (
    nowMs,
    bookingHours,
    leadHours = BOOKING_MIN_LEAD_HOURS
) => {
    const leadMs = leadHours * 60 * MINUTE_MS;

    if (!bookingHours?.enabled) {
        return nowMs + leadMs;
    }

    const openMs = parseBookingHoursTime(bookingHours.openTime) * MINUTE_MS;
    const closeMs = parseBookingHoursTime(bookingHours.closeTime) * MINUTE_MS;

    let remainingMs = leadMs;
    let cursor = nowMs;

    // Each pass ends a day; the window is at least 30 minutes, so the notice
    // is always used up well within this bound.
    for (let day = 0; day < 60; day += 1) {
        const midnight =
            Math.floor((cursor + MANILA_OFFSET_MS) / DAY_MS) * DAY_MS -
            MANILA_OFFSET_MS;

        const opensAt = midnight + openMs;
        const closesAt = midnight + closeMs;

        if (cursor < opensAt) {
            cursor = opensAt;
        }

        if (cursor < closesAt) {
            const openLeftMs = closesAt - cursor;

            if (remainingMs <= openLeftMs) {
                return cursor + remainingMs;
            }

            remainingMs -= openLeftMs;
        }

        cursor = midnight + DAY_MS + openMs;
    }

    return cursor + remainingMs;
};
