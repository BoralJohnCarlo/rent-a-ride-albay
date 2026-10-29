import { SlidersHorizontal } from "lucide-react";

const STATUS_OPTIONS = [
    "All",
    "Draft",
    "Pending",
    "Under Review",
    "Revision Requested",
    "Approved",
    "Rejected",
    "Withdrawn",
    "Archived",
];

/*
 * Status filter for consignment applications. Rendered as pill chips (not tabs)
 * so it reads clearly as a filter next to the page's section navigation.
 */
const ConsignmentFilters = ({
    status = "All",
    onStatusChange,
    statusCounts,
    excludeStatuses = [],
    className = "",
}) => {
    const showCounts =
        statusCounts &&
        Object.keys(statusCounts).length > 0;

    const visibleOptions = STATUS_OPTIONS.filter(
        (value) => !excludeStatuses.includes(value)
    );

    return (
        <div
            className={[
                "flex items-center gap-2 overflow-x-auto pb-1",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filter
            </span>

            {visibleOptions.map((value) => {
                const active = value === status;
                const count = statusCounts?.[value] ?? 0;

                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => onStatusChange?.(value)}
                        className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            active
                                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:text-gray-100"
                        }`}
                    >
                        {value}

                        {showCounts && (
                            <span
                                className={`rounded-full px-1.5 text-[10px] font-bold leading-4 ${
                                    active
                                        ? "bg-white/25 text-white"
                                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                            >
                                {count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
};

export default ConsignmentFilters;
