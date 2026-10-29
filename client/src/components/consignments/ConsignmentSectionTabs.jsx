import { motion } from "framer-motion";

import { ACTIVE_PILL_SPRING } from "../../constants/animations";

/*
 * Primary section navigation for the consignment page. Distinct from the status
 * filter chips: this is icon-led navigation between views.
 * `sections` is a list of { value, label, icon, count? }.
 *
 * variant="underline" (default) — tabs on a baseline with a sliding
 * underline. variant="pill" — every tab inside one rounded capsule with a
 * sliding filled pill for the active one (admin page).
 */
const ConsignmentSectionTabs = ({
    value,
    onChange,
    sections = [],
    variant = "underline",
    // Pill only: "sm" is a tighter, smaller capsule.
    size = "md",
}) => {
    if (variant === "pill") {
        const compact = size === "sm";

        return (
            <div className="flex justify-center">
                <div
                    role="tablist"
                    aria-label="Consignment sections"
                    className={`flex max-w-full overflow-x-auto rounded-full border border-gray-200/80 bg-white/80 shadow-sm ${compact ? "gap-0.5 p-0.5" : "gap-1 p-1"} backdrop-blur-xl [scrollbar-width:none] dark:border-gray-800 dark:bg-gray-900/80 [&::-webkit-scrollbar]:hidden`}
                >
                    {sections.map((section) => {
                        const Icon = section.icon;
                        const active = section.value === value;

                        return (
                            <button
                                key={section.value}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => onChange?.(section.value)}
                                className={`relative flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold transition-colors ${
                                    compact
                                        ? "gap-1 px-2.5 py-1 text-[11px]"
                                        : "gap-2 px-4 py-2 text-sm"
                                } ${
                                    active
                                        ? "text-white"
                                        : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                                }`}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="consignment-section-pill"
                                        className="absolute inset-0 rounded-full bg-blue-600 shadow-md shadow-blue-600/25 dark:bg-blue-500 dark:shadow-blue-500/20"
                                        transition={ACTIVE_PILL_SPRING}
                                    />
                                )}

                                {Icon && (
                                    <Icon
                                        className={`relative ${
                                            compact ? "h-3 w-3" : "h-4 w-4"
                                        }`}
                                    />
                                )}

                                <span className="relative">{section.label}</span>

                                {typeof section.count === "number" &&
                                    section.count > 0 && (
                                        <span
                                            className={`relative rounded-full px-1.5 py-0.5 font-bold leading-none ${
                                                compact ? "px-1 text-[9px]" : "text-[11px]"
                                            } ${
                                                active
                                                    ? "bg-white/25 text-white"
                                                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                            }`}
                                        >
                                            {section.count}
                                        </span>
                                    )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="border-b border-gray-200 dark:border-gray-800">
            <div className="-mb-px flex gap-1 overflow-x-auto">
                {sections.map((section) => {
                    const Icon = section.icon;
                    const active = section.value === value;

                    return (
                        <button
                            key={section.value}
                            type="button"
                            onClick={() => onChange?.(section.value)}
                            className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors ${
                                active
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            }`}
                        >
                            {Icon && <Icon className="h-4 w-4" />}

                            {section.label}

                            {typeof section.count === "number" &&
                                section.count > 0 && (
                                    <span
                                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${
                                            active
                                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300"
                                                : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                        }`}
                                    >
                                        {section.count}
                                    </span>
                                )}

                            {active && (
                                <motion.span
                                    layoutId="consignment-section-underline"
                                    className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400"
                                    transition={ACTIVE_PILL_SPRING}
                                />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ConsignmentSectionTabs;
