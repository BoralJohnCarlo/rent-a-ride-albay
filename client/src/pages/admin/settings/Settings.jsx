import {
    AlertTriangle,
    ArrowRight,
    Car,
    FileText,
    Fingerprint,
    MapPin,
    MapPinned,
    MessageSquareQuote,
    Palette,
    Percent,
    ReceiptText,
    RefreshCw,
    Timer,
    UserCog,
    UserRound,
} from "lucide-react";

import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

import NoResults from "../../../components/common/NoResults";
import PillSearch from "../../../components/common/PillSearch";


const COLOR_STYLES = {
    blue: {
        icon: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
        ring: "hover:border-blue-200 dark:hover:border-blue-900",
        arrow: "text-blue-600 dark:text-blue-400",
    },
    red: {
        icon: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
        ring: "hover:border-red-200 dark:hover:border-red-900",
        arrow: "text-red-600 dark:text-red-400",
    },
    emerald: {
        icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
        ring: "hover:border-emerald-200 dark:hover:border-emerald-900",
        arrow: "text-emerald-600 dark:text-emerald-400",
    },
    violet: {
        icon: "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
        ring: "hover:border-violet-200 dark:hover:border-violet-900",
        arrow: "text-violet-600 dark:text-violet-400",
    },
    amber: {
        icon: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
        ring: "hover:border-amber-200 dark:hover:border-amber-900",
        arrow: "text-amber-600 dark:text-amber-400",
    },
    rose: {
        icon: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
        ring: "hover:border-rose-200 dark:hover:border-rose-900",
        arrow: "text-rose-600 dark:text-rose-400",
    },
    indigo: {
        icon: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400",
        ring: "hover:border-indigo-200 dark:hover:border-indigo-900",
        arrow: "text-indigo-600 dark:text-indigo-400",
    },
    teal: {
        icon: "bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
        ring: "hover:border-teal-200 dark:hover:border-teal-900",
        arrow: "text-teal-600 dark:text-teal-400",
    },
    sky: {
        icon: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
        ring: "hover:border-sky-200 dark:hover:border-sky-900",
        arrow: "text-sky-600 dark:text-sky-400",
    },
    orange: {
        icon: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
        ring: "hover:border-orange-200 dark:hover:border-orange-900",
        arrow: "text-orange-600 dark:text-orange-400",
    },
    yellow: {
        icon: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400",
        ring: "hover:border-yellow-200 dark:hover:border-yellow-900",
        arrow: "text-yellow-600 dark:text-yellow-400",
    },
};

const SETTINGS_ITEMS = [
    {
        key: "bookings",
        keywords: ["turnaround", "buffer", "cleaning", "time between rentals", "back-to-back", "availability", "schedule"],
        label: "Bookings",
        description:
            "Set the turnaround buffer: the minimum time between one rental's return and the next pickup.",
        icon: Timer,
        path: "/admin/settings/bookings",
        color: "orange",
    },
    {
        key: "service-locations",
        keywords: ["pickup", "return", "delivery", "drop-off", "distance fee", "address", "map", "branch"],
        label: "Service Locations",
        description:
            "Manage pickup/return locations, distance-based fees, and related policies.",
        icon: MapPin,
        path: "/admin/settings/service-locations",
        color: "blue",
    },
    {
        key: "penalties",
        keywords: ["late return", "late fee", "overdue", "grace period", "fines", "charges"],
        label: "Penalty Settings",
        description:
            "Configure late-return penalty rules, rates, and grace periods.",
        icon: AlertTriangle,
        path: "/admin/settings/penalties",
        color: "red",
    },
    {
        key: "refunds",
        keywords: ["cancellation", "cancel fee", "tiered refund", "no-show", "reservation fee", "paymongo"],
        label: "Refund Settings",
        description:
            "Configure refund policies, default reasons, and processing rules.",
        icon: RefreshCw,
        path: "/admin/settings/refunds",
        color: "emerald",
    },
    {
        key: "driver-settings",
        keywords: ["chauffeur", "with driver", "driver fee", "assignment"],
        label: "Driver Settings",
        description:
            "Configure driver assignment policies and preferences.",
        icon: UserRound,
        path: "/admin/settings/driver-settings",
        color: "violet",
    },
    {
        key: "valid-id-renewal",
        keywords: ["identification", "id expiry", "verification", "reminders"],
        label: "Valid ID Renewal",
        description:
            "Configure renewal attempts, validity periods, and reminders.",
        icon: Fingerprint,
        path: "/admin/settings/valid-id-renewal",
        color: "amber",
    },
    {
        key: "commission",
        keywords: ["consignment", "operator", "owner", "split", "earnings", "payout", "percentage"],
        label: "Commission & Payout",
        description:
            "Configure the commission split and payout rules for consignment operators.",
        icon: Percent,
        path: "/admin/settings/commission",
        color: "rose",
    },
    {
        key: "vehicle-registration",
        keywords: ["or cr", "lto", "registration expiry", "renewal", "operator"],
        label: "Vehicle Registration",
        description:
            "Configure registration expiration reminders and operator renewal limits.",
        icon: Car,
        path: "/admin/settings/vehicle-registration",
        color: "indigo",
    },
    {
        key: "customer-settings",
        keywords: ["booking limit", "concurrent bookings", "driver's license", "license expiry"],
        label: "Customer Settings",
        description:
            "Limit concurrent bookings per customer and control the license-based booking restriction.",
        icon: UserCog,
        path: "/admin/settings/customer-settings",
        color: "teal",
    },
    {
        key: "registration",
        keywords: ["sign up", "register", "proof of billing", "billing address", "utility bill", "documents", "partner", "customer"],
        label: "Registration",
        description:
            "Choose whether customers and partners must upload a proof of billing address when they register.",
        icon: ReceiptText,
        path: "/admin/settings/registration",
        color: "yellow",
    },
    {
        key: "legal",
        keywords: ["terms", "conditions", "t&c", "terms of service", "partner terms", "consignment terms", "policy", "privacy", "agreement", "version"],
        label: "Terms & Policies",
        description:
            "Edit and publish the Terms & Conditions, Partner Terms and Terms of Service. Each booking keeps the version its customer accepted.",
        icon: FileText,
        path: "/admin/settings/legal",
        color: "indigo",
    },
    {
        key: "themes",
        keywords: ["christmas", "seasonal", "dark mode", "navbar", "pill navbar", "hero", "video", "background", "image", "display"],
        label: "Themes & Display",
        description:
            "Configure the seasonal Christmas theme and how the public site's navbar looks.",
        icon: Palette,
        path: "/admin/settings/themes",
        color: "sky",
    },
    {
        key: "testimonials",
        keywords: ["reviews", "homepage", "feedback", "ratings"],
        label: "Testimonials",
        description:
            "Add, hide, or remove homepage testimonials — write your own or feature a customer's booking review.",
        icon: MessageSquareQuote,
        path: "/admin/settings/testimonials",
        color: "yellow",
    },
    {
        key: "destinations",
        keywords: ["explore albay", "places", "tourist spots", "trip tips", "photos", "home widget"],
        label: "Destinations",
        description:
            "Manage the Explore Albay page — places, trip tips, photos, and which three appear in the home page widget.",
        icon: MapPinned,
        path: "/admin/settings/destinations",
        color: "emerald",
    },
];

/* Every search word has to appear somewhere in the item's name, description
   or keywords, so "late fee" finds Penalty Settings. */
const matchesSearch = (item, query) => {
    const haystack = [item.label, item.description, ...(item.keywords || [])]
        .join(" ")
        .toLowerCase();

    return query
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .every((word) => haystack.includes(word));
};

const Settings = () => {
    const location = useLocation();
    const isRoot = location.pathname === "/admin/settings";
    const [search, setSearch] = useState("");

    if (!isRoot) {
        return <Outlet />;
    }

    const visibleItems = SETTINGS_ITEMS.filter((item) =>
        matchesSearch(item, search)
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <PillSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search settings, e.g. late fee, refunds, christmas..."
                    label="Search settings"
                />
            </div>

            {visibleItems.length === 0 && (
                <NoResults
                    title="No settings found"
                    description={`Nothing matches "${search.trim()}". Try another word, like a fee, feature, or page name.`}
                />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const styles = COLOR_STYLES[item.color];

                    return (
                        <Link
                            key={item.key}
                            to={item.path}
                            className={`
                                group
                                flex
                                flex-col
                                gap-4
                                rounded-2xl
                                border
                                border-gray-200
                                bg-white
                                p-6
                                shadow-sm
                                transition-all
                                duration-200
                                hover:-translate-y-0.5
                                hover:shadow-md
                                dark:border-gray-800
                                dark:bg-gray-900
                                ${styles.ring}
                            `}
                        >
                            <div
                                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}
                            >
                                <Icon
                                    size={22}
                                    strokeWidth={1.8}
                                />
                            </div>

                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                    {item.label}
                                </h3>

                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {item.description}
                                </p>
                            </div>

                            <div
                                className={`flex items-center gap-1.5 text-sm font-semibold ${styles.arrow}`}
                            >
                                Manage
                                <ArrowRight
                                    size={15}
                                    className="transition-transform duration-200 group-hover:translate-x-1"
                                />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
};

export default Settings;
