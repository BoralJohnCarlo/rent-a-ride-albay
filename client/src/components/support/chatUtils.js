const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Consecutive messages from one sender this close together share a bubble
// group (one name label, one avatar, tighter spacing).
const GROUP_WINDOW_MS = 5 * MINUTE;

export const fullName = (person, fallback = "") =>
    [person?.firstName, person?.lastName]
        .filter(Boolean)
        .join(" ") || fallback;

const toDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const formatClock = (value) => {
    const date = toDate(value);

    return date
        ? date.toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
          })
        : "";
};

export const formatDayLabel = (value) => {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    const days = Math.round(
        (startOfDay(new Date()) - startOfDay(date)) / DAY
    );

    if (days === 0) {
        return "Today";
    }

    if (days === 1) {
        return "Yesterday";
    }

    return date.toLocaleDateString("en-PH", {
        weekday: days < 7 ? "long" : undefined,
        month: "short",
        day: "numeric",
        year:
            date.getFullYear() === new Date().getFullYear()
                ? undefined
                : "numeric",
    });
};

// Inbox-row timestamp: "now", "12m", "3h", "Yesterday", "Oct 3".
export const formatRelative = (value) => {
    const date = toDate(value);

    if (!date) {
        return "";
    }

    const elapsed = Date.now() - date.getTime();

    if (elapsed < MINUTE) {
        return "now";
    }

    if (elapsed < HOUR) {
        return `${Math.floor(elapsed / MINUTE)}m`;
    }

    if (elapsed < DAY && startOfDay(date).getTime() === startOfDay(new Date()).getTime()) {
        return `${Math.floor(elapsed / HOUR)}h`;
    }

    if (formatDayLabel(date) === "Yesterday") {
        return "Yesterday";
    }

    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
    });
};

// "4m", "2h 10m", "3d" - how long a customer has been waiting.
export const formatDuration = (ms) => {
    if (ms < HOUR) {
        return `${Math.max(1, Math.floor(ms / MINUTE))}m`;
    }

    if (ms < DAY) {
        const hours = Math.floor(ms / HOUR);
        const minutes = Math.floor((ms % HOUR) / MINUTE);
        return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
    }

    return `${Math.floor(ms / DAY)}d`;
};

/*
 * When the customer spoke last on a live conversation, how long they've
 * been waiting for a staff reply (ms) - else null.
 */
export const waitingMs = (ticket) => {
    if (
        !ticket ||
        ticket.lastMessageRole !== "customer" ||
        ticket.status === "Resolved" ||
        ticket.status === "Closed"
    ) {
        return null;
    }

    const since = toDate(ticket.lastMessageAt || ticket.updatedAt);

    return since ? Date.now() - since.getTime() : null;
};

const senderKey = (entry) =>
    entry.senderRole === "customer"
        ? "customer"
        : `${entry.senderRole}:${entry.sender?._id || entry.sender || ""}`;

/*
 * Flattens messages into what the thread renders: day separators, system
 * events, and messages flagged with their position in a sender group.
 */
export const buildTimeline = (messages = []) => {
    const items = [];
    let lastDay = null;

    messages.forEach((entry, index) => {
        const date = toDate(entry.createdAt);
        const dayKey = date ? startOfDay(date).getTime() : null;

        if (dayKey !== null && dayKey !== lastDay) {
            items.push({
                type: "day",
                key: `day-${dayKey}`,
                label: formatDayLabel(date),
            });
            lastDay = dayKey;
        }

        if (entry.senderRole === "system") {
            items.push({
                type: "system",
                key: entry._id || `system-${index}`,
                entry,
            });
            return;
        }

        const previous = messages[index - 1];
        const next = messages[index + 1];

        const continues = (other) =>
            other &&
            other.senderRole !== "system" &&
            senderKey(other) === senderKey(entry) &&
            Math.abs(new Date(other.createdAt) - date) < GROUP_WINDOW_MS &&
            startOfDay(new Date(other.createdAt)).getTime() === dayKey;

        items.push({
            type: "message",
            key: entry._id || `message-${index}`,
            entry,
            firstInGroup: !continues(previous),
            lastInGroup: !continues(next),
        });
    });

    return items;
};

export const errorText = (error, fallback) =>
    (typeof error === "string" && error) ||
    error?.message ||
    fallback;

export const lastMessageOf = (ticket) => {
    const messages = ticket?.messages || [];

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        if (messages[index].senderRole !== "system") {
            return messages[index];
        }
    }

    return null;
};
