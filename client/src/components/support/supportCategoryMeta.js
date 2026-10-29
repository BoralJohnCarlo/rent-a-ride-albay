import {
    CalendarDays,
    Car,
    CreditCard,
    MessageCircle,
    UserRound,
    Wrench,
} from "lucide-react";

import { SUPPORT_TICKET_CATEGORY_VALUES } from "../../constants/supportTicketConstants";

const META = {
    Booking: {
        icon: CalendarDays,
        hint: "Dates, pickup, changes",
        tint: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    },
    Vehicle: {
        icon: Car,
        hint: "Condition, features, issues",
        tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    Payment: {
        icon: CreditCard,
        hint: "Charges, refunds, receipts",
        tint: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    },
    Account: {
        icon: UserRound,
        hint: "Profile, ID, license",
        tint: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    Technical: {
        icon: Wrench,
        hint: "Something isn't working",
        tint: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    },
    General: {
        icon: MessageCircle,
        hint: "Anything else",
        tint: "bg-gray-100 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200",
    },
};

export const categoryMeta = (category) => META[category] ?? META.General;

export const SUPPORT_CATEGORIES = SUPPORT_TICKET_CATEGORY_VALUES.map(
    (value) => ({ value, ...categoryMeta(value) })
);

// Dot + text colours per conversation status, shared by both inboxes.
export const STATUS_STYLE = {
    Open: {
        dot: "bg-amber-500",
        text: "text-amber-700 dark:text-amber-300",
        chip: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
    },
    "In Progress": {
        dot: "bg-blue-500",
        text: "text-blue-700 dark:text-blue-300",
        chip: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30",
    },
    Resolved: {
        dot: "bg-emerald-500",
        text: "text-emerald-700 dark:text-emerald-300",
        chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
    },
    Closed: {
        dot: "bg-gray-400",
        text: "text-gray-500 dark:text-gray-400",
        chip: "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700",
    },
};

export const statusStyle = (status) => STATUS_STYLE[status] ?? STATUS_STYLE.Open;
