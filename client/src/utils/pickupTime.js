/*
 * Pickup times, always in Philippine time (UTC+8, no DST) whatever the
 * viewer's own timezone. A booking's pickup is the date + time the customer
 * chose; the return is the same time on the return date. Mirrors the server
 * (BOOKING_PICKUP_* in bookingConstants.js, validatePickupSchedule).
 */

const MANILA_OFFSET = "+08:00";
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// The default pickup window (Settings → Bookings → Pickup Hours can change
// it; read the live one from usePublicRefundSettings().pickupHours).
export const PICKUP_EARLIEST_MINUTE = 8 * 60;
export const PICKUP_LATEST_MINUTE = 18 * 60;
export const PICKUP_STEP_MINUTES = 30;

export const DEFAULT_PICKUP_HOURS = Object.freeze({
    earliestTime: "08:00",
    latestTime: "18:00",
});

// Also how older, date-only bookings read.
export const DEFAULT_PICKUP_TIME = "08:00";

/* "14:30" → "2:30 PM". */
export const formatPickupTime = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);

    return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${
        hour < 12 ? "AM" : "PM"
    }`;
};

const minuteToTime = (minute) =>
    `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(
        minute % 60
    ).padStart(2, "0")}`;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseTime = (time) => {
    const match = TIME_PATTERN.exec(String(time ?? ""));

    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/*
 * Every bookable pickup time for a pickup window ({ earliestTime,
 * latestTime }, from the public settings), as { value: "14:30", label:
 * "2:30 PM" }. A missing or invalid window uses the default, as the server
 * does (resolvePickupHours).
 */
export const getPickupTimeOptions = (pickupHours = null) => {
    let earliest = parseTime(pickupHours?.earliestTime);
    let latest = parseTime(pickupHours?.latestTime);

    if (
        earliest === null ||
        latest === null ||
        earliest > latest ||
        earliest % PICKUP_STEP_MINUTES !== 0 ||
        latest % PICKUP_STEP_MINUTES !== 0
    ) {
        earliest = PICKUP_EARLIEST_MINUTE;
        latest = PICKUP_LATEST_MINUTE;
    }

    const options = [];

    for (
        let minute = earliest;
        minute <= latest;
        minute += PICKUP_STEP_MINUTES
    ) {
        const value = minuteToTime(minute);

        options.push({ value, label: formatPickupTime(value) });
    }

    return options;
};

/* The default window's times (before the live settings load). */
export const PICKUP_TIME_OPTIONS = getPickupTimeOptions(DEFAULT_PICKUP_HOURS);

/*
 * A calendar day's limited pickup times ({ from, until } from the
 * availability calendar) as "pickup from 12:00 PM" / "pickup until 10:00 AM"
 * / "pickup only at 8:00 AM", relative to the pickup window.
 */
export const describeLimitedPickupTimes = (
    { from, until },
    pickupHours = null
) => {
    const options = getPickupTimeOptions(pickupHours);

    if (from === until) {
        return `pickup only at ${formatPickupTime(from)}`;
    }

    if (until === options.at(-1).value) {
        return `pickup from ${formatPickupTime(from)}`;
    }

    if (from === options[0].value) {
        return `pickup until ${formatPickupTime(until)}`;
    }

    return `pickup ${formatPickupTime(from)} – ${formatPickupTime(until)}`;
};

/* "8:00 AM – 6:00 PM" for a pickup window. */
export const formatPickupHours = (pickupHours = null) => {
    const options = getPickupTimeOptions(pickupHours);

    return `${options[0].label} – ${options.at(-1).label}`;
};

/* The instant a Manila date ("YYYY-MM-DD") + time ("HH:mm") refers to. */
export const toPickupDateTime = (dateKey, time = DEFAULT_PICKUP_TIME) =>
    dateKey ? new Date(`${dateKey}T${time}:00${MANILA_OFFSET}`) : null;

/*
 * Mirrors the server's BOOKING_MIN_LEAD_HOURS: a new or rescheduled pickup
 * must be at least this far away (time to pay and get approved).
 */
export const MIN_BOOKING_LEAD_HOURS = 2;

/*
 * Booking hours (Settings → Bookings, public settings): when enabled, the
 * minimum notice only counts while staff are open to approve bookings.
 * Mirrors the server's utils/bookingHours.js — keep the two in step.
 */
export const DEFAULT_BOOKING_HOURS = Object.freeze({
    enabled: false,
    openTime: "08:00",
    closeTime: "20:00",
});

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

const timeToMinute = (time) => {
    const [hour, minute] = String(time).split(":").map(Number);

    return hour * 60 + minute;
};

/*
 * The earliest pickup a booking made at `nowMs` may have. With 8:00 AM –
 * 8:00 PM booking hours: booked 3:00 PM → 5:00 PM; 7:30 PM → 9:30 AM next
 * day; 11:00 PM or 6:00 AM → 10:00 AM.
 */
export const getEarliestPickupMs = (nowMs, bookingHours = null) => {
    const leadMs = MIN_BOOKING_LEAD_HOURS * 60 * MINUTE_MS;

    if (!bookingHours?.enabled) {
        return nowMs + leadMs;
    }

    const openMs = timeToMinute(bookingHours.openTime) * MINUTE_MS;
    const closeMs = timeToMinute(bookingHours.closeTime) * MINUTE_MS;

    if (!(openMs < closeMs)) {
        return nowMs + leadMs;
    }

    let remainingMs = leadMs;
    let cursor = nowMs;

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

/* Whether a pickup at dateKey + time is sooner than the minimum notice. */
export const isPickupTooSoon = (dateKey, time, nowMs, bookingHours = null) =>
    toPickupDateTime(dateKey, time).getTime() <
    getEarliestPickupMs(nowMs, bookingHours);

/*
 * The first pickup time on `dateKey` that still meets the minimum notice,
 * or null if none is left that day.
 */
export const getNextPickupTime = (
    dateKey,
    nowMs,
    bookingHours = null,
    options = PICKUP_TIME_OPTIONS
) =>
    options.find(
        ({ value }) => !isPickupTooSoon(dateKey, value, nowMs, bookingHours)
    )?.value ?? null;

/* The Manila "YYYY-MM-DD" a stored date falls on. */
export const getManilaDateKey = (value) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? ""
        : new Date(date.getTime() + MANILA_OFFSET_MS)
              .toISOString()
              .slice(0, 10);
};

/* Shift a "YYYY-MM-DD" key by whole days. */
export const addDaysToDateKey = (dateKey, days) => {
    const date = new Date(`${dateKey}T00:00:00Z`);

    date.setUTCDate(date.getUTCDate() + days);

    return date.toISOString().slice(0, 10);
};

/* The Manila "HH:mm" of a stored date, e.g. a booking's startDate. */
export const getPickupTimeOf = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return DEFAULT_PICKUP_TIME;
    }

    return new Date(date.getTime() + MANILA_OFFSET_MS)
        .toISOString()
        .slice(11, 16);
};
