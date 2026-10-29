import {
    CalendarClock,
    Car,
    Clock3,
    KeyRound,
    ShieldAlert,
    Wrench,
} from "lucide-react";

/* Every non-archived vehicle status, so the tiles add up to the fleet. */
const summaryItems = [
    {
        key: "available",
        label: "Available",
        icon: Car,
        color: "green",
    },
    {
        key: "reserved",
        label: "Reserved",
        icon: CalendarClock,
        color: "sky",
    },
    {
        key: "pickupInProgress",
        label: "In Pickup",
        icon: KeyRound,
        color: "violet",
    },
    {
        key: "rented",
        label: "Rented",
        icon: Clock3,
        color: "blue",
    },
    {
        key: "maintenance",
        label: "Maintenance",
        icon: Wrench,
        color: "yellow",
    },
    {
        key: "expiredRegistration",
        label: "Reg. Expired",
        icon: ShieldAlert,
        color: "red",
    },
];

const colorClasses = {
    green: {
        icon: "bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400",
        value: "text-green-600 dark:text-green-400",
    },

    blue: {
        icon: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
        value: "text-blue-600 dark:text-blue-400",
    },

    yellow: {
        icon: "bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400",
        value: "text-yellow-600 dark:text-yellow-400",
    },

    red: {
        icon: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
        value: "text-red-600 dark:text-red-400",
    },

    sky: {
        icon: "bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400",
        value: "text-sky-600 dark:text-sky-400",
    },

    violet: {
        icon: "bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400",
        value: "text-violet-600 dark:text-violet-400",
    },
};

const FleetSummary = ({
    summary = {},
    loading = false,
    className = "",
}) => {
    const fleetTotal = summaryItems.reduce(
        (total, item) => total + Number(summary[item.key] || 0),
        0
    );

    if (loading) {
        return (
            <div
                className={`
                    min-w-0
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    p-5
                    shadow-sm
                    dark:border-gray-800
                    dark:bg-gray-900
                    ${className}
                `}
            >
                <div className="h-6 w-40 max-w-full rounded bg-gray-200 dark:bg-gray-800" />

                <div className="mt-2 h-4 w-56 max-w-full rounded bg-gray-100 dark:bg-gray-800/70" />

                <div className="@container mt-6">
                <div className="grid min-w-0 grid-cols-2 gap-2 @md:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((item) => (
                        <div
                            key={item}
                            className="h-[76px] min-w-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/70"
                        />
                    ))}
                </div>
                </div>
            </div>
        );
    }

    return (
        <section
            className={`
                min-w-0
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-white
                p-5
                shadow-sm
                dark:border-gray-800
                dark:bg-gray-900
                ${className}
            `}
        >
            <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold text-gray-900 dark:text-white">
                    Fleet Summary
                </h2>

                <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500 dark:text-gray-400">
                    Where all {fleetTotal} active vehicle
                    {fleetTotal === 1 ? "" : "s"} stand right now.
                </p>
            </div>

            <div className="@container mt-6">
            <div className="grid min-w-0 grid-cols-2 gap-2 @md:grid-cols-3">
                {summaryItems.map((item) => {
                    const Icon = item.icon;
                    const colors = colorClasses[item.color];

                    return (
                        <div
                            key={item.key}
                            className="
                                min-w-0
                                overflow-hidden
                                rounded-xl
                                border
                                border-gray-200
                                p-3
                                transition
                                duration-200
                                hover:shadow-sm
                                dark:border-gray-800
                            "
                        >
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-1.5">
                                    <div
                                        className={`
                                            flex
                                            h-7
                                            w-7
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-lg
                                            ${colors.icon}
                                        `}
                                    >
                                        <Icon size={15} />
                                    </div>

                                    <p
                                        className="
                                            min-w-0
                                            truncate
                                            text-xs
                                            font-medium
                                            text-gray-500
                                            dark:text-gray-400
                                        "
                                        title={item.label}
                                    >
                                        {item.label}
                                    </p>
                                </div>

                                <h3
                                    className={`
                                        mt-2
                                        text-2xl
                                        font-bold
                                        leading-none
                                        ${colors.value}
                                    `}
                                >
                                    {summary[item.key] ?? 0}
                                </h3>
                            </div>
                        </div>
                    );
                })}
            </div>
            </div>
        </section>
    );
};

export default FleetSummary;