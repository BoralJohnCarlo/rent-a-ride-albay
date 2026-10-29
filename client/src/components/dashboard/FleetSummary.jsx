import {
    Car,
    Clock3,
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
];

const colorClasses = {
    green: {
        icon: "bg-green-100 text-green-600",
        value: "text-green-600",
    },

    blue: {
        icon: "bg-blue-100 text-blue-600",
        value: "text-blue-600",
    },

    yellow: {
        icon: "bg-yellow-100 text-yellow-600",
        value: "text-yellow-600",
    },
};

const FleetSummary = ({
    summary = {
        available: 0,
        rented: 0,
        maintenance: 0,
    },
    loading = false,
    className = "",
}) => {
    if (loading) {
        return (
            <div
                className={`
                    rounded-xl
                    border
                    border-gray-200
                    bg-white
                    p-5
                    shadow-sm
                    ${className}
                `}
            >
                <div className="h-6 w-40 rounded bg-gray-200" />

                <div className="mt-2 h-4 w-56 rounded bg-gray-100" />

            <div className="mt-5 grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map((item) => (
                        <div
                            key={item}
                            className="h-24 rounded-xl bg-gray-100"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <section
            className={`
                rounded-xl
                border
                border-gray-200
                bg-white
                p-6
                shadow-sm
                ${className}
            `}
        >
            <div>
                <h2 className="text-xl font-semibold text-gray-900">
                    Fleet Summary
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                    Current vehicle availability across the fleet.
                </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
                {summaryItems.map((item) => {
                    const Icon = item.icon;

                    const colors =
                        colorClasses[item.color];

                    return (
                        <div
                            key={item.key}
                            className="
                                rounded-xl
                                border
                                border-gray-200
                                p-4
                            "
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500">
                                        {item.label}
                                    </p>

                                <h3
                                    className={`mt-1 text-2xl font-bold ${colors.value}`}
                                >
                                        {summary[item.key]}
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
                                    <Icon size={22} />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default FleetSummary;