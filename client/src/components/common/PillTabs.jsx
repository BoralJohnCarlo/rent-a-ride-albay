import { motion } from "framer-motion";

/*
 * Centred pill switch with a sliding active highlight. Pages stack these in
 * stepping-down sizes: "md" (or the roomier "lg") for section tabs, "sm" for secondary modes, "xs"
 * for quick filters.
 *
 * `countTone` - "amber" shows a count only when it's above zero (an alert
 * cue); "muted" always shows it as a quiet tally, zero included.
 *
 * `tone` - "blue" (admin/partner screens) or "brand" (the yellow used on
 * public and customer pages).
 */
const PILL_SIZES = {
    lg: { shell: "gap-1 p-1", button: "h-9 gap-2 px-7 text-sm", icon: 15 },
    md: { shell: "gap-1 p-1", button: "h-9 gap-2 px-4 text-sm", icon: 15 },
    sm: { shell: "gap-0.5 p-0.5", button: "h-7 gap-1.5 px-3 text-xs", icon: 13 },
    xs: { shell: "gap-0.5 p-0.5", button: "h-6 gap-1 px-2.5 text-[11px]", icon: 12 },
};

const PILL_TONES = {
    blue: {
        activeText: "text-white",
        highlight: "bg-blue-600 shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/20",
        mutedCount: "text-blue-100",
        badgeCount: "bg-white/25 text-white",
    },
    brand: {
        activeText: "text-gray-950",
        highlight: "bg-yellow-400 shadow-md shadow-yellow-500/25 dark:shadow-yellow-400/15",
        mutedCount: "text-gray-800",
        badgeCount: "bg-gray-950/15 text-gray-950",
    },
};

const PillTabs = ({
    value,
    onChange,
    options,
    size = "md",
    layoutId,
    label,
    countTone = "amber",
    tone = "blue",
}) => {
    const sz = PILL_SIZES[size] ?? PILL_SIZES.md;
    const tn = PILL_TONES[tone] ?? PILL_TONES.blue;

    return (
        <div
            role="tablist"
            aria-label={label}
            className={`flex w-full max-w-full items-center overflow-x-auto rounded-full border border-gray-200/80 bg-white/80 shadow-sm backdrop-blur-xl [scrollbar-width:none] dark:border-gray-800 dark:bg-gray-900/80 [&::-webkit-scrollbar]:hidden sm:w-fit ${sz.shell}`}
        >
            {options.map((option) => {
                const active = option.value === value;
                const Icon = option.icon;
                const showCount =
                    typeof option.count === "number" &&
                    (countTone === "muted" || option.count > 0);

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(option.value)}
                        className={`relative inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold transition-colors ${sz.button} ${
                            active
                                ? tn.activeText
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        }`}
                    >
                        {active && (
                            <motion.span
                                layoutId={layoutId}
                                className={`absolute inset-0 rounded-full ${tn.highlight}`}
                                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                            />
                        )}
                        {Icon && <Icon size={sz.icon} className="relative" />}
                        <span className="relative">{option.label}</span>
                        {showCount &&
                            (countTone === "muted" ? (
                                <span
                                    className={`relative font-medium ${
                                        active
                                            ? tn.mutedCount
                                            : "text-gray-400 dark:text-gray-500"
                                    }`}
                                >
                                    {option.count}
                                </span>
                            ) : (
                                <span
                                    className={`relative rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                        active
                                            ? tn.badgeCount
                                            : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                    }`}
                                >
                                    {option.count}
                                </span>
                            ))}
                    </button>
                );
            })}
        </div>
    );
};

export default PillTabs;
