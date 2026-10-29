import { DEFAULT_CHRISTMAS_WINDOW } from "../config/theme";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export const MONTH_OPTIONS = MONTH_NAMES.map(
    (label, index) => ({
        value: String(index + 1),
        label,
    })
);

// Fills gaps (older cached copies, partial server responses) from the
// default window.
export const normalizeChristmasWindow = (window) => ({
    ...DEFAULT_CHRISTMAS_WINDOW,
    ...(window ?? {}),
});

// Feb 29 stays legal - the window repeats every year, so it can't be
// pinned to a leap or non-leap one. 2024 is just a leap-year reference.
export const getDaysInMonth = (month) =>
    new Date(2024, Number(month), 0).getDate();

export const isValidMonthDay = (month, day) => {
    const m = Number(month);
    const d = Number(day);

    return (
        Number.isInteger(m) &&
        m >= 1 &&
        m <= 12 &&
        Number.isInteger(d) &&
        d >= 1 &&
        d <= getDaysInMonth(m)
    );
};

export const formatMonthDay = (month, day) =>
    `${MONTH_NAMES[Number(month) - 1]?.slice(0, 3) ?? "?"} ${day}`;

/*
 * Whether `date` falls inside the yearly window. Compares month*100+day so
 * the year never matters. A window that ends before it starts (the default
 * Sep 1 -> Jan 1) wraps the new year. Both ends are inclusive.
 */
export const isWithinSeasonWindow = (
    window,
    date = new Date()
) => {
    const {
        startMonth,
        startDay,
        endMonth,
        endDay,
    } = normalizeChristmasWindow(window);

    const start = startMonth * 100 + startDay;
    const end = endMonth * 100 + endDay;
    const today = (date.getMonth() + 1) * 100 + date.getDate();

    return start <= end
        ? today >= start && today <= end
        : today >= start || today <= end;
};

export const isChristmasAvailable = (window, date = new Date()) => {
    const resolved = normalizeChristmasWindow(window);

    return (
        Boolean(resolved.enabled) &&
        isWithinSeasonWindow(resolved, date)
    );
};
