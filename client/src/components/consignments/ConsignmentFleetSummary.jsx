import {
    CalendarCheck,
    Car,
    Clock3,
    ShieldAlert,
    Wrench,
} from "lucide-react";

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
        icon: CalendarCheck,
        color: "yellow",
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
        color: "orange",
    },
    {
        key: "expiredRegistration",
        label: "Registration Expired",
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
    orange: {
        icon: "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400",
        value: "text-orange-600 dark:text-orange-400",
    },
    red: {
        icon: "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400",
        value: "text-red-600 dark:text-red-400",
    },
};

const defaultSummary = {
    available: 0,
    reserved: 0,
    rented: 0,
    maintenance: 0,
    expiredRegistration: 0,
};

const ConsignmentFleetSummary = ({
    summary = defaultSummary,
    loading = false,
    className = "",
    title = "Fleet Summary",
    description = "Overview of your approved vehicles and their current availability.",
    onItemClick,
}) => {
    if (loading) {
        return (
            <section
                className={`
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    p-6
                    shadow-sm
                    animate-pulse
                    dark:border-gray-800
                    dark:bg-gray-900
                    ${className}
                `}
            >
                <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />

                <div className="mt-2 h-4 w-64 rounded bg-gray-100 dark:bg-gray-800/70" />

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((item) => (
                        <div
                            key={item}
                            className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800/70"
                        />
                    ))}
                </div>
            </section>
        );
    }

    return (
            <section
                className={`
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
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {title}
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                {summaryItems.map((item) => {
                    const Icon = item.icon;

                    const colors =
                        colorClasses[item.color];

                    return (
                        <div
                            key={item.key}
                            onClick={() =>
                                onItemClick?.(
                                    item.key
                                )
                            }
                            className={`
                                rounded-xl
                                border
                                border-gray-200
                                p-4
                                transition
                                dark:border-gray-800
                                ${
                                    onItemClick
                                        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                                        : ""
                                }
                            `}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {
                                            item.label
                                        }
                                    </p>

                                    <h3
                                        className={`mt-1 text-2xl font-bold ${colors.value}`}
                                    >
                                        {
                                            summary[
                                                item
                                                    .key
                                            ]
                                        }
                                    </h3>
                                </div>

                                <div
                                    className={`
                                        flex
                                        h-12
                                        w-12
                                        items-center
                                        justify-center
                                        rounded-xl
                                        ${colors.icon}
                                    `}
                                >
                                    <Icon
                                        size={22}
                                    />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default ConsignmentFleetSummary;