import { FileSpreadsheet, LoaderCircle } from "lucide-react";

/*
 * Rounded "Export to Excel" button that sits beside the pill toolbars on
 * admin list pages, same glass surface. `size` matches the neighbour's
 * height: "md" for PillSearch (h-11), "pill" for the Fleet search pill
 * (h-10 input + p-1 = h-12), "lg" for the Bookings toolbar (h-13).
 */
const HEIGHTS = {
    md: "h-11",
    pill: "h-12",
    lg: "h-13",
};

const ExportExcelPill = ({
    onClick,
    loading = false,
    disabled = false,
    label = "Export to Excel",
    size = "md",
    className = "",
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        aria-busy={loading}
        title={label}
        className={`inline-flex ${HEIGHTS[size] ?? HEIGHTS.md} shrink-0 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 text-sm font-semibold text-emerald-700 shadow-sm backdrop-blur-xl transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:bg-gray-900/80 dark:text-emerald-400 dark:hover:bg-emerald-500/10 ${className}`}
    >
        {loading ? (
            <LoaderCircle size={17} className="animate-spin" />
        ) : (
            <FileSpreadsheet size={17} />
        )}
        <span className="hidden sm:inline">
            {loading ? "Preparing…" : label}
        </span>
    </button>
);

export default ExportExcelPill;
