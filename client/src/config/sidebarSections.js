/*
 * Visual grouping for the dashboard sidebars. These reference existing
 * navigation entries by path only — the nav items themselves (labels, icons,
 * routes) live in ./navigation.js and are not changed here. Any nav item not
 * listed in a section still renders, under a trailing "More" group.
 */

export const ADMIN_SIDEBAR_SECTIONS = [
    {
        title: "Main",
        paths: [
            "/admin",
            "/admin/users",
            "/admin/vehicles",
            "/admin/gps",
            "/admin/drivers",
            "/admin/consignments",
            "/admin/bookings",
        ],
    },
    {
        title: "Management",
        paths: [
            "/admin/payments",
            "/admin/promotions",
            "/admin/customer-service",
        ],
    },
    {
        title: "System",
        paths: ["/admin/settings"],
    },
];

export const OPERATOR_SIDEBAR_SECTIONS = [
    {
        title: "Main",
        paths: [
            "/operator",
            "/operator/consignments",
            "/operator/vehicles",
            "/operator/tracking",
            "/operator/bookings",
        ],
    },
    {
        title: "Finance",
        paths: ["/operator/earnings"],
    },
    {
        title: "Account",
        paths: ["/operator/profile", "/operator/settings"],
    },
];

export const buildSidebarGroups = (nav, sections) => {
    const claimed = new Set();

    const groups = sections
        .map((section) => {
            const items = nav.filter((item) =>
                section.paths.includes(item.path)
            );

            items.forEach((item) => claimed.add(item.path));

            return { title: section.title, items };
        })
        .filter((group) => group.items.length > 0);

    const leftovers = nav.filter(
        (item) => !claimed.has(item.path)
    );

    if (leftovers.length > 0) {
        groups.push({ title: "More", items: leftovers });
    }

    return groups;
};

// Same order as the sidebar's sections, flattened for the phone dock.
// `homePath` (the dashboard) only matches exactly.
export const buildDockItems = (nav, sections, homePath) =>
    buildSidebarGroups(nav, sections).flatMap((group) =>
        group.items.map((item) => ({
            ...item,
            end: item.path === homePath,
        }))
    );
