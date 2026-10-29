import { Bell } from "lucide-react";

import {
    adminNavigation,
    operatorNavigation,
    customerNavigation,
} from "./navigation";

const navigationGroups = [
    adminNavigation,
    operatorNavigation,
    customerNavigation,
];

// Pages reached from the header (not the sidebar) that still need a title.
const extraPages = [
    {
        path: "/admin/notifications",
        title: "Notifications",
        icon: Bell,
    },
    {
        path: "/operator/notifications",
        title: "Notifications",
        icon: Bell,
    },
];

// Dashboard roots would prefix-match every page of their role.
const ROOT_PATHS = new Set(["/admin", "/operator"]);

const findNavigationItem = (pathname) => {
    for (const navigation of navigationGroups) {
        const item = navigation.find(
            (item) => item.path === pathname
        );

        if (item) {
            return item;
        }
    }

    return (
        extraPages.find((page) => page.path === pathname) ?? null
    );
};

/*
 * Nested pages (e.g. /admin/settings/bookings) take their section's title
 * and icon — the longest sidebar path they sit under.
 */
const findSectionItem = (pathname) => {
    let best = null;

    for (const navigation of navigationGroups) {
        for (const item of navigation) {
            if (
                !ROOT_PATHS.has(item.path) &&
                pathname.startsWith(`${item.path}/`) &&
                (!best || item.path.length > best.path.length)
            ) {
                best = item;
            }
        }
    }

    return best;
};

export const getNavigationItem = (pathname) => {
    return (
        findNavigationItem(pathname) ?? findSectionItem(pathname)
    );
};

export const getPageTitle = (pathname) => {
    return (
        getNavigationItem(pathname)?.title ??
        "Dashboard"
    );
};

export const getBreadcrumb = (pathname) => {
    return (
        findNavigationItem(pathname)?.breadcrumb ?? [
            {
                label: "Dashboard",
                active: true,
            },
        ]
    );
};
