import { motion } from "framer-motion";

const FilterTabs = ({
    value,
    options = [],
    onChange,
    className = "",
}) => {
    return (
        <div
            className={[
                "overflow-x-auto",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="flex items-center gap-1">
                {options.map(
                    ({
                        value: optionValue,
                        label,
                        count,
                    }) => {
                        const active =
                            optionValue === value;

                        return (
                            <button
                                key={optionValue}
                                type="button"
                                onClick={() =>
                                    onChange?.(
                                        optionValue
                                    )
                                }
                                className="
                                    relative
                                    flex
                                    items-center
                                    gap-2
                                    whitespace-nowrap
                                    rounded-lg
                                    px-4
                                    py-2
                                    text-sm
                                    font-medium
                                    transition-colors
                                "
                            >
                                {active && (
                                    <motion.div
                                        layoutId="filter-tab"
                                        className="
                                            absolute
                                            inset-0
                                            rounded-lg
                                            bg-white
                                            shadow-sm
                                            dark:bg-gray-800
                                            dark:shadow-gray-950/30
                                        "
                                        transition={{
                                            type: "spring",
                                            stiffness: 450,
                                            damping: 35,
                                        }}
                                    />
                                )}

                                <span
                                    className={[
                                        "relative",
                                        active
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-gray-600 dark:text-gray-400",
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    {label}
                                </span>

                                {typeof count ===
                                    "number" && (
                                    <span
                                        className={[
                                            "relative",
                                            "rounded-full",
                                            "px-2",
                                            "py-0.5",
                                            "text-xs",
                                            active
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                                        ]
                                            .filter(
                                                Boolean
                                            )
                                            .join(" ")}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    }
                )}
            </div>
        </div>
    );
};

export default FilterTabs;