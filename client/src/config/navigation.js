import {
    Users,
    User,
    LayoutDashboard,
    Car,
    FileCheck2,
    IdCard,
    CalendarCheck,
    CreditCard,
    Settings,
    Wallet,
    Info,
    MessageCircle,
    HelpCircle,
    LocateFixed,
    TicketPercent,
    /*
    FileText,
    Star,
    Mail,
    Search,
    */
} from "lucide-react";

export const adminNavigation = [
    {
        label: "Dashboard",
        title: "Dashboard",
        path: "/admin",
        icon: LayoutDashboard,
        breadcrumb: [
            {
                label: "Dashboard",
                active: true,
            },
        ],
    },

    {
        label: "Users",
        title: "User Management",
        path: "/admin/users",
        icon: Users,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "User Management",
                active: true,
            },
        ],
    },

    {
        label: "Fleet",
        title: "Fleet Management",
        path: "/admin/vehicles",
        icon: Car,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Fleet Management",
                active: true,
            },
        ],
    },

    {
        label: "Consignments",
        title: "Consignment Management",
        path: "/admin/consignments",
        icon: FileCheck2,
        badgeKey: "consignments",
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Consignment Management",
                active: true,
            },
        ],
    },

    {
        label: "GPS Tracking",
        title: "GPS Tracking",
        path: "/admin/gps",
        icon: LocateFixed,
        badgeKey: "gpsAlerts",
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "GPS Tracking",
                active: true,
            },
        ],
    },

    {
        label: "Drivers",
        title: "Driver Management",
        path: "/admin/drivers",
        icon: IdCard,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Driver Management",
                active: true,
            },
        ],
    },

    {
        label: "Bookings",
        title: "Booking Management",
        path: "/admin/bookings",
        icon: CalendarCheck,
        badgeKey: "bookings",
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Booking Management",
                active: true,
            },
        ],
    },

    {
        label: "Financials",
        title: "Financial Management",
        path: "/admin/payments",
        icon: CreditCard,
        badgeKey: "financials",
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Payment Management",
                active: true,
            },
        ],
    },

    {
        label: "Promotions",
        title: "Promotions",
        path: "/admin/promotions",
        icon: TicketPercent,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Promotions",
                active: true,
            },
        ],
    },

    {
        label: "Customer Service",
        title: "Customer Service Management",
        path: "/admin/customer-service",
        icon: MessageCircle,
        badgeKey: "support",
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Customer Service Management",
                active: true,
            },
        ],
    },

    {
        label: "Settings",
        title: "Settings",
        path: "/admin/settings",
        icon: Settings,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },

            {
                label: "Settings",
                active: true,
            },
        ],
    },

    /*
    Future Features

    {
        label: "Reviews",
        title: "Review Management",
        path: "/admin/reviews",
        icon: Star,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Payment Management",
                active: true,
            },
        ],
    },

    {
        label: "Reviews",
        title: "Review Management",
        path: "/admin/reviews",
        icon: Star,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Review Management",
                active: true,
            },
        ],
    },

    {
        label: "Reports",
        title: "Reports",
        path: "/admin/reports",
        icon: FileText,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Reports",
                active: true,
            },
        ],
    },
    */
];

export const operatorNavigation = [
    {
        label: "Dashboard",
        title: "Partner Dashboard",
        path: "/operator",
        icon: LayoutDashboard,
        breadcrumb: [
            {
                label: "Dashboard",
                active: true,
            },
        ],
    },

    {
        label: "Consignments",
        title: "My Consignments",
        path: "/operator/consignments",
        icon: FileCheck2,
        badgeKey: "consignments",
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "My Consignments",
                active: true,
            },
        ],
    },

    {
        label: "My Vehicles",
        title: "My Vehicles",
        path: "/operator/vehicles",
        icon: Car,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "My Vehicles",
                active: true,
            },
        ],
    },

    {
        label: "Live Tracking",
        title: "Live Tracking",
        path: "/operator/tracking",
        icon: LocateFixed,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Live Tracking",
                active: true,
            },
        ],
    },

    {
        label: "Earnings",
        title: "My Earnings",
        path: "/operator/earnings",
        icon: Wallet,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "My Earnings",
                active: true,
            },
        ],
    },

    {
        label: "Bookings & Rentals",
        title: "Bookings & Rentals",
        path: "/operator/bookings",
        icon: CalendarCheck,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Bookings & Rentals",
                active: true,
            },
        ],
    },

    {
        label: "My Profile",
        title: "My Profile",
        path: "/operator/profile",
        icon: User,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "My Profile",
                active: true,
            },
        ],
    },

    {
        label: "Settings",
        title: "Settings",
        path: "/operator/settings",
        icon: Settings,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Settings",
                active: true,
            },
        ],
    },

    /*
    Future Partner Features

    {
        label: "Fleet",
        title: "Fleet Management",
        path: "/operator/fleet",
        icon: Car,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Fleet Management",
                active: true,
            },
        ],
    },
    */
];

export const customerNavigation = [
    {
        label: "Home",
        title: "Home",
        path: "/customer/home",
        icon: LayoutDashboard,
        breadcrumb: [
            {
                label: "Home",
                active: true,
            },
        ],
    },
    {
        label: "My Bookings",
        title: "My Bookings",
        path: "/customer/bookings",
        icon: CalendarCheck,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "My Bookings",
                active: true,
            },
        ],
    },
];

export const publicNavigation = [
    {
        label: "Home",
        title: "Home",
        path: "/customer/home",
        icon: LayoutDashboard,
        enabled: true,
    },
    {
        label: "Vehicles",
        title: "Vehicles",
        path: "/vehicles",
        icon: Car,
        enabled: true,
    },
    {
        label: "About",
        title: "About",
        path: "/about",
        icon: Info,
        enabled: true,
    },
    {
        label: "Contact",
        title: "Contact",
        path: "/contact",
        icon: MessageCircle,
        enabled: true,
    },
    {
        label: "FAQ",
        title: "FAQ",
        path: "/faq",
        icon: HelpCircle,
        enabled: true,
    },
];
