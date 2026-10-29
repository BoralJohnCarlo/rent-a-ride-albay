/*
 * Due-back vs actual return for a returned booking. At return the booking's
 * endDate moves to the actual return time and the due-back time is kept in
 * dueBackDate (see the server's processReturn); returns recorded before that
 * fall back to the rental's late/early-return record.
 */

export const getDueBackAt = (booking) =>
    booking?.dueBackDate ??
    booking?.rental?.lateReturn?.expectedReturnAt ??
    booking?.rental?.earlyReturn?.expectedReturnAt ??
    null;

/* 90 → "1 hr 30 min", 1500 → "1 day 1 hr". */
const formatDurationMinutes = (totalMinutes) => {
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;

    return [
        days && `${days} day${days === 1 ? "" : "s"}`,
        hours && `${hours} hr`,
        !days && minutes && `${minutes} min`,
    ]
        .filter(Boolean)
        .join(" ");
};

/*
 * { label: "1 hr 30 min late", status: "late" | "early" | "onTime" }, or
 * null when either time is missing.
 */
export const describeReturnTiming = (dueBackAt, returnedAt) => {
    const due = new Date(dueBackAt).getTime();
    const returned = new Date(returnedAt).getTime();

    if (!dueBackAt || !returnedAt || !Number.isFinite(due) || !Number.isFinite(returned)) {
        return null;
    }

    const diffMinutes = Math.round((returned - due) / (60 * 1000));

    if (diffMinutes === 0) {
        return { label: "on time", status: "onTime" };
    }

    return {
        label: `${formatDurationMinutes(Math.abs(diffMinutes))} ${
            diffMinutes > 0 ? "late" : "early"
        }`,
        status: diffMinutes > 0 ? "late" : "early",
    };
};

export const RETURN_TIMING_TEXT_CLASS = {
    late: "text-red-600 dark:text-red-400",
    early: "text-blue-600 dark:text-blue-400",
    onTime: "text-green-600 dark:text-green-400",
};
