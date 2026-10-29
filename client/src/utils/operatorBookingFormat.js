/* Shared formatting for the partner (operator) Bookings page and its
   detail modal. */

export const peso = (value) =>
    `₱${(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

export const formatBookingDate = (value, options = {}) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        ...options,
    });
};

/* "Mar 4 – Mar 7, 2026", dropping the repeated year when both match. */
export const formatDateRange = (start, end) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return "—";
    }

    const sameYear = startDate.getFullYear() === endDate.getFullYear();

    const startText = startDate.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
    });

    return `${startText} – ${formatBookingDate(end)}`;
};

/* Days, or (for a late return) minutes rendered as "2h 15m" / "1d 3h". */
export const formatDuration = (days, minutes = null) => {
    if (minutes !== null) {
        const total = Math.round(Number(minutes) || 0);
        const d = Math.floor(total / 1440);
        const h = Math.floor((total % 1440) / 60);
        const m = total % 60;

        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    const count = Number(days);

    if (!Number.isFinite(count) || count <= 0) {
        return "—";
    }

    return `${count} ${count === 1 ? "day" : "days"}`;
};

/* The server sends partners a first name + surname initial only. */
export const getRenterName = (customer) => {
    const first = customer?.firstName?.trim();
    const initial = customer?.lastInitial;

    if (!first && !initial) {
        return "—";
    }

    return [first, initial ? `${initial}.` : ""].filter(Boolean).join(" ");
};
