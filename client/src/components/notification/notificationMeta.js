import {
    Bell,
    Boxes,
    CalendarDays,
    Car,
    CarFront,
    CreditCard,
    FileSignature,
    FileText,
    HandCoins,
    LifeBuoy,
    MessageSquare,
    Star,
    Tag,
    Ticket,
    Undo2,
    UserCog,
    UserRound,
} from "lucide-react";

/*
 * Icon, label and colour per notification category (the server stores these
 * PascalCase; keys here are lowercase). `tile` tints the icon square, `text`
 * colours the icon itself.
 */
export const CATEGORY_META = {
    booking: {
        label: "Bookings",
        icon: CalendarDays,
        text: "text-blue-600 dark:text-blue-400",
        tile: "bg-blue-50 ring-blue-100 dark:bg-blue-500/10 dark:ring-blue-500/20",
    },
    rental: {
        label: "Rentals",
        icon: Car,
        text: "text-indigo-600 dark:text-indigo-400",
        tile: "bg-indigo-50 ring-indigo-100 dark:bg-indigo-500/10 dark:ring-indigo-500/20",
    },
    payment: {
        label: "Payments",
        icon: CreditCard,
        text: "text-emerald-600 dark:text-emerald-400",
        tile: "bg-emerald-50 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20",
    },
    refund: {
        label: "Refunds",
        icon: Undo2,
        text: "text-rose-600 dark:text-rose-400",
        tile: "bg-rose-50 ring-rose-100 dark:bg-rose-500/10 dark:ring-rose-500/20",
    },
    payout: {
        label: "Payouts",
        icon: HandCoins,
        text: "text-amber-600 dark:text-amber-400",
        tile: "bg-amber-50 ring-amber-100 dark:bg-amber-500/10 dark:ring-amber-500/20",
    },
    consignment: {
        label: "Consignments",
        icon: Boxes,
        text: "text-teal-600 dark:text-teal-400",
        tile: "bg-teal-50 ring-teal-100 dark:bg-teal-500/10 dark:ring-teal-500/20",
    },
    vehicle: {
        label: "Vehicles",
        icon: CarFront,
        text: "text-cyan-600 dark:text-cyan-400",
        tile: "bg-cyan-50 ring-cyan-100 dark:bg-cyan-500/10 dark:ring-cyan-500/20",
    },
    review: {
        label: "Reviews",
        icon: Star,
        text: "text-yellow-600 dark:text-yellow-400",
        tile: "bg-yellow-50 ring-yellow-100 dark:bg-yellow-500/10 dark:ring-yellow-500/20",
    },
    user: {
        label: "Users",
        icon: UserRound,
        text: "text-sky-600 dark:text-sky-400",
        tile: "bg-sky-50 ring-sky-100 dark:bg-sky-500/10 dark:ring-sky-500/20",
    },
    document: {
        label: "Documents",
        icon: FileText,
        text: "text-orange-600 dark:text-orange-400",
        tile: "bg-orange-50 ring-orange-100 dark:bg-orange-500/10 dark:ring-orange-500/20",
    },
    account: {
        label: "Account",
        icon: UserCog,
        text: "text-slate-600 dark:text-slate-300",
        tile: "bg-slate-100 ring-slate-200 dark:bg-slate-500/10 dark:ring-slate-500/20",
    },
    promo: {
        label: "Promos",
        icon: Ticket,
        text: "text-pink-600 dark:text-pink-400",
        tile: "bg-pink-50 ring-pink-100 dark:bg-pink-500/10 dark:ring-pink-500/20",
    },
    support: {
        label: "Support",
        icon: LifeBuoy,
        text: "text-violet-600 dark:text-violet-400",
        tile: "bg-violet-50 ring-violet-100 dark:bg-violet-500/10 dark:ring-violet-500/20",
    },
    agreement: {
        label: "Agreements",
        icon: FileSignature,
        text: "text-purple-600 dark:text-purple-400",
        tile: "bg-purple-50 ring-purple-100 dark:bg-purple-500/10 dark:ring-purple-500/20",
    },
    dispute: {
        label: "Disputes",
        icon: MessageSquare,
        text: "text-red-600 dark:text-red-400",
        tile: "bg-red-50 ring-red-100 dark:bg-red-500/10 dark:ring-red-500/20",
    },
    system: {
        label: "System",
        icon: Bell,
        text: "text-gray-600 dark:text-gray-300",
        tile: "bg-gray-100 ring-gray-200 dark:bg-gray-500/10 dark:ring-gray-500/20",
    },
};

export const FALLBACK_CATEGORY_META = {
    label: "Other",
    icon: Tag,
    text: "text-gray-500 dark:text-gray-400",
    tile: "bg-gray-100 ring-gray-200 dark:bg-gray-500/10 dark:ring-gray-500/20",
};

export const getCategoryMeta = (category) =>
    CATEGORY_META[(category || "").toLowerCase()] ||
    FALLBACK_CATEGORY_META;

/*
 * The categories the server actually sends to each role (see the notify*
 * calls under server/services). Keep in sync when a new kind of
 * notification is added, so every role only gets filters that can match.
 */
export const ROLE_CATEGORIES = {
    admin: [
        "booking",
        "rental",
        "payment",
        "refund",
        "payout",
        "consignment",
        "vehicle",
        "user",
        "document",
        "review",
        "support",
    ],
    operator: [
        "booking",
        "rental",
        "payout",
        "consignment",
        "vehicle",
        "review",
        "document",
        "account",
    ],
    customer: [
        "booking",
        "rental",
        "payment",
        "refund",
        "promo",
        "document",
        "support",
        "account",
    ],
};

/*
 * Where a click on a notification lands, per role. Every path here is a real
 * route in AppRoutes; categories without a sensible page (or not sent to that
 * role) resolve to null and the click just marks the notification read.
 */
const ROLE_ROUTES = {
    admin: {
        booking: "/admin/bookings",
        rental: "/admin/bookings",
        review: "/admin/bookings",
        payment: "/admin/payments",
        refund: "/admin/payments?tab=refunds",
        payout: "/admin/consignments",
        consignment: "/admin/consignments",
        vehicle: "/admin/vehicles",
        user: "/admin/users",
        document: "/admin/users",
        support: "/admin/customer-service",
    },
    operator: {
        booking: "/operator/bookings",
        rental: "/operator/bookings",
        payout: "/operator/earnings",
        consignment: "/operator/consignments",
        vehicle: "/operator/vehicles",
        review: "/operator/vehicles",
        document: "/operator/profile",
        account: "/operator/profile",
    },
    customer: {
        booking: "/customer/bookings",
        rental: "/customer/bookings",
        payment: "/customer/bookings",
        refund: "/customer/bookings",
        promo: "/customer/profile",
        document: "/customer/profile",
        account: "/customer/profile",
        support: "/customer/customer-service",
    },
};

export const resolveNotificationPath = (notification, role) => {
    const routes = ROLE_ROUTES[role];

    if (!routes) {
        return null;
    }

    const category = (notification?.category || "").toLowerCase();
    const { relatedModel, relatedId } = notification?.metadata || {};

    // Deep-link to the exact record where the page supports it.
    if (role === "customer" && relatedModel === "Booking" && relatedId) {
        return `/customer/bookings/${relatedId}`;
    }

    if (relatedModel === "SupportTicket" && relatedId && routes.support) {
        return `${routes.support}?ticket=${relatedId}`;
    }

    if (role === "admin" && relatedModel === "User" && relatedId) {
        return `/admin/users?userId=${relatedId}`;
    }

    return routes[category] || null;
};
