import {
    ArrowDownRight,
    ArrowUpRight,
} from "lucide-react";

const colorVariants = {
    blue: {
        icon: "bg-blue-100 text-blue-600",
        value: "text-blue-600",
    },
    green: {
        icon: "bg-green-100 text-green-600",
        value: "text-green-600",
    },
    yellow: {
        icon: "bg-yellow-100 text-yellow-600",
        value: "text-yellow-600",
    },
    red: {
        icon: "bg-red-100 text-red-600",
        value: "text-red-600",
    },
    purple: {
        icon: "bg-purple-100 text-purple-600",
        value: "text-purple-600",
    },
    indigo: {
        icon: "bg-indigo-100 text-indigo-600",
        value: "text-indigo-600",
    },
};

const StatCard = ({
    title,
    value,
    subtitle,
    icon,
    color = "blue",
    trend,
    loading = false,
    onClick,
    className = "",
}) => {
    const variant =
        colorVariants[color] || colorVariants.blue;

    return (
        <div
            onClick={onClick}
            className={`
                rounded-xl
                border
                border-gray-200
                bg-white
                p-5
                shadow-sm
                transition
                ${
                    onClick
                        ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                        : ""
                }
                ${className}
            `}
        >
            {loading ? (
                <div className="space-y-3 animate-pulse">
                    <div className="h-4 w-28 rounded bg-gray-200" />

                    <div className="h-8 w-20 rounded bg-gray-300" />

                    <div className="h-3 w-32 rounded bg-gray-200" />
                </div>
            ) : (
                <>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                {title}
                            </p>

                            <h3
                                className={`mt-2 text-3xl font-bold ${variant.value}`}
                            >
                                {value}
                            </h3>
                        </div>

                        {icon && (
                            <div
                                className={`
                                    flex
                                    h-12
                                    w-12
                                    items-center
                                    justify-center
                                    rounded-xl
                                    ${variant.icon}
                                `}
                            >
                                {icon}
                            </div>
                        )}
                    </div>

                    {(subtitle || trend !== undefined) && (
                        <div className="mt-5 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                                {subtitle}
                            </p>

                            {trend !== undefined && (
                                <div
                                    className={`
                                        flex
                                        items-center
                                        gap-1
                                        text-sm
                                        font-medium
                                        ${
                                            trend >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                        }
                                    `}
                                >
                                    {trend >= 0 ? (
                                        <ArrowUpRight size={16} />
                                    ) : (
                                        <ArrowDownRight size={16} />
                                    )}

                                    <span>
                                        {Math.abs(trend)}%
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StatCard;