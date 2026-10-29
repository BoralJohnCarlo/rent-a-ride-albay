import {
    CalendarCheck,
    CarFront,
    CircleHelp,
    Heart,
    House,
} from "lucide-react";

/*
 * The phone bottom tab bar's destinations (CustomerTabBar). The menu sheet
 * leaves these out of its links so nothing is offered twice. The fifth slot
 * is always the Menu button.
 */
export const CUSTOMER_TABS = [
    {
        label: "Home",
        path: "/customer/home",
        icon: House,
    },
    {
        label: "Vehicles",
        path: "/vehicles",
        icon: CarFront,
    },
    {
        label: "Bookings",
        path: "/customer/bookings",
        icon: CalendarCheck,
    },
    {
        label: "Saved",
        path: "/customer/favorites",
        icon: Heart,
    },
];

/* Logged out: Bookings asks them to log in, then opens My Bookings. */
export const GUEST_TABS = [
    {
        label: "Home",
        path: "/",
        icon: House,
        end: true,
    },
    {
        label: "Vehicles",
        path: "/vehicles",
        icon: CarFront,
    },
    {
        label: "Bookings",
        path: "/login?redirect=/customer/bookings",
        icon: CalendarCheck,
        // Keep Bookings selected while signing in for this destination.
        // Paths this tab covers, for leaving them out of the menu links.
        covers: ["/customer/bookings"],
    },
    {
        label: "Help",
        path: "/faq",
        icon: CircleHelp,
    },
];

export const CUSTOMER_TAB_PATHS = new Set(
    CUSTOMER_TABS.map((tab) => tab.path)
);

export const GUEST_TAB_PATHS = new Set(
    GUEST_TABS.flatMap((tab) => [tab.path, ...(tab.covers ?? [])])
);

/*
 * Screens that bring their own bottom UI: vehicle details (its Book bar),
 * the support chat (its message box) and checkout. The tab bar hides there,
 * and the navbars show a small top menu button instead.
 */
const TAB_BAR_HIDDEN_ON = [
    /^\/vehicles\/[^/]+/,
    /^\/customer\/customer-service/,
    /^\/customer\/checkout\//,
];

export const isTabBarHidden = (pathname) =>
    TAB_BAR_HIDDEN_ON.some((pattern) => pattern.test(pathname));
