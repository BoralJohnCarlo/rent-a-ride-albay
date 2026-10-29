import { motion } from "framer-motion";

const WithdrawReasonCard = ({
    value,
    title,
    description,
    selected = false,
    disabled = false,
    onSelect,
}) => {
    const handleSelect = () => {
        if (disabled) {
            return;
        }

        onSelect?.(value);
    };

    return (
        <motion.label
            whileHover={
                disabled
                    ? undefined
                    : {
                          y: -2,
                      }
            }
            whileTap={
                disabled
                    ? undefined
                    : {
                          scale: 0.99,
                      }
            }
            className={[
                "group relative block overflow-hidden rounded-xl border p-5 shadow-sm transition-all duration-200",
                "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2",
                disabled
                    ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900"
                    : "cursor-pointer",
                selected
                    ? "border-blue-500 bg-blue-50 shadow-md dark:border-blue-400 dark:bg-blue-950/40"
                    : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-700",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <input
                type="radio"
                className="sr-only"
                value={value}
                checked={selected}
                disabled={disabled}
                onChange={handleSelect}
            />

            <div className="flex items-start gap-4">
                <motion.div
                    animate={{
                        borderColor: selected
                            ? "#3B82F6"
                            : "#D1D5DB",
                        backgroundColor: selected
                            ? "#DBEAFE"
                            : "transparent",
                    }}
                    transition={{
                        duration: 0.2,
                    }}
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
                >
                    <motion.div
                        initial={false}
                        animate={{
                            scale: selected ? 1 : 0,
                            opacity: selected ? 1 : 0,
                        }}
                        transition={{
                            duration: 0.18,
                        }}
                        className="h-2.5 w-2.5 rounded-full bg-blue-600"
                    />
                </motion.div>

                <div className="min-w-0 flex-1">
                    <h3
                        className={[
                            "text-sm font-semibold transition-colors",
                            selected
                                ? "text-blue-700 dark:text-blue-300"
                                : "text-gray-900 dark:text-white",
                        ].join(" ")}
                    >
                        {title}
                    </h3>

                    {description && (
                        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                            {description}
                        </p>
                    )}
                </div>
            </div>

            {selected && (
                <motion.div
                    layoutId="withdrawReasonIndicator"
                    className="absolute inset-y-0 left-0 w-1 rounded-r bg-blue-500"
                />
            )}
        </motion.label>
    );
};

export default WithdrawReasonCard;