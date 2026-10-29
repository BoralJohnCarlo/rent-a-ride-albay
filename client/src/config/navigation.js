import {
    Users,
    LayoutDashboard,
    Car,
    CarFront,
    Tags,
    UserRound,
    FileCheck2,
    IdCard,
    CalendarCheck,
    CreditCard,
    BarChart3,
    Settings,
    /*
    FileText,
    Star,
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
        label: "Vehicle Owners",
        title: "Vehicle Owner Management",
        path: "/admin/vehicle-owners",
        icon: UserRound,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Vehicle Owner Management",
                active: true,
            },
        ],
    },

    {
        label: "Vehicles",
        title: "Vehicle Management",
        path: "/admin/vehicles",
        icon: Car,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Vehicle Management",
                active: true,
            },
        ],
    },

    {
        label: "Categories",
        title: "Vehicle Categories",
        path: "/admin/categories",
        icon: Tags,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Vehicle Categories",
                active: true,
            },
        ],
    },

    {
        label: "Consignments",
        title: "Consignment Management",
        path: "/admin/consignments",
        icon: FileCheck2,
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
    label: "Rentals",
    title: "Rental Management",
    path: "/admin/rentals",
    icon: CarFront,
    breadcrumb: [
        {
            label: "Dashboard",
            active: false,
        },
        {
            label: "Rental Management",
            active: true,
        },
    ],
},

{
    label: "Payments",
    title: "Payment Management",
    path: "/admin/payments",
    icon: CreditCard,
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
        label: "Statistics",
        title: "Statistics & Analytics",
        path: "/admin/statistics",
        icon: BarChart3,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },

            {
                label: "Statistics & Analytics",
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
        title: "Operator Dashboard",
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
        label: "Rentals",
        title: "My Rentals",
        path: "/operator/rentals",
        icon: CarFront,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "My Rentals",
                active: true,
            },
        ],
    },

    {
        label: "Statistics",
        title: "Statistics",
        path: "/operator/statistics",
        icon: BarChart3,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Statistics",
                active: true,
            },
        ],
    },

    /*
    Future Operator Features

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

    {
        label: "Bookings",
        title: "Bookings",
        path: "/operator/bookings",
        icon: CalendarCheck,
        breadcrumb: [
            {
                label: "Dashboard",
                active: false,
            },
            {
                label: "Bookings",
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