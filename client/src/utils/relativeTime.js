const relativeFormatter = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
});

const UNITS = [
    ["year", 365 * 24 * 3600],
    ["month", 30 * 24 * 3600],
    ["week", 7 * 24 * 3600],
    ["day", 24 * 3600],
    ["hour", 3600],
    ["minute", 60],
];

/* "3 months ago", "yesterday", "in 2 hours", "just now". */
export const formatRelative = (date) => {
    const seconds = (new Date(date).getTime() - Date.now()) / 1000;

    for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size) {
            return relativeFormatter.format(Math.round(seconds / size), unit);
        }
    }

    return "just now";
};
