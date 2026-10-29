/*
 * Calendar days as the business sees them: Albay runs on Philippine time,
 * which is a fixed UTC+8 with no daylight saving. Anything that buckets or
 * bounds data by "day" (dashboard trends, "this month", "last 7 days") should
 * go through these helpers so it doesn't depend on the server machine's own
 * timezone or fall back to UTC days (where 00:00–07:59 Manila lands on the
 * previous date).
 */
export const BUSINESS_TIMEZONE = "Asia/Manila";

const BUSINESS_UTC_OFFSET = "+08:00";
const BUSINESS_OFFSET_MS = 8 * 60 * 60 * 1000;

/* Minutes since Manila midnight for a moment, e.g. 2:30 PM → 870. */
export const getBusinessMinuteOfDay = (date) => {
    const shifted = new Date(new Date(date).getTime() + BUSINESS_OFFSET_MS);

    return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
};

/* "YYYY-MM-DD" of the Manila calendar day a moment falls on. */
export const toBusinessDateKey = (date = new Date()) =>
    new Date(new Date(date).getTime() + BUSINESS_OFFSET_MS)
        .toISOString()
        .slice(0, 10);

/* The instant a Manila calendar day ("YYYY-MM-DD") starts. */
export const businessDayStart = (dateKey) =>
    new Date(`${dateKey}T00:00:00${BUSINESS_UTC_OFFSET}`);

/* Shift a "YYYY-MM-DD" key by whole days (negative goes back). */
export const addDaysToDateKey = (dateKey, days) => {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

/* Every "YYYY-MM-DD" key from `fromKey` to `toKey`, inclusive. */
export const listDateKeys = (fromKey, toKey) => {
    const keys = [];

    for (
        let key = fromKey;
        key <= toKey;
        key = addDaysToDateKey(key, 1)
    ) {
        keys.push(key);
    }

    return keys;
};
