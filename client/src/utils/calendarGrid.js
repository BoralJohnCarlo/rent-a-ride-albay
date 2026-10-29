export const toISODate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

/* "YYYY-MM-DD" (or a longer ISO string) → local-midnight Date, or null. */
export const parseISODay = (iso) => {
    if (!iso) return null;
    const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
};

/*
 * Splits a calendar month into weeks of 7 cells (nulls for the leading/
 * trailing days outside the month) so the grid always lines up under the
 * weekday header.
 */
export const buildMonthWeeks = (year, month) => {
    const firstOfMonth = new Date(year, month, 1);

    const startWeekday = firstOfMonth.getDay();

    const daysInMonth = new Date(
        year,
        month + 1,
        0
    ).getDate();

    const cells = [];

    for (let i = 0; i < startWeekday; i += 1) {
        cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(new Date(year, month, day));
    }

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    const weeks = [];

    for (let i = 0; i < cells.length; i += 7) {
        weeks.push(cells.slice(i, i + 7));
    }

    return weeks;
};

/*
 * Collapses a set of individually-selected ISO dates into consecutive
 * {startDate, endDate} ranges (exclusive end — the day after the last
 * selected day in a run), matching the exclusive-end convention the server
 * uses for blocked date ranges.
 */
export const buildDateRangesFromSelection = (
    selectedDates
) => {
    const sorted = Array.from(selectedDates).sort();
    const ranges = [];

    let rangeStart = null;
    let previous = null;

    const pushRange = () => {
        const end = new Date(previous);
        end.setDate(end.getDate() + 1);

        ranges.push({
            startDate: rangeStart.toISOString(),
            endDate: end.toISOString(),
        });
    };

    for (const iso of sorted) {
        const date = new Date(`${iso}T00:00:00`);

        if (rangeStart && previous) {
            const expectedNext = new Date(previous);
            expectedNext.setDate(
                expectedNext.getDate() + 1
            );

            if (
                date.getTime() ===
                expectedNext.getTime()
            ) {
                previous = date;
                continue;
            }

            pushRange();
        }

        rangeStart = date;
        previous = date;
    }

    if (rangeStart) {
        pushRange();
    }

    return ranges;
};
