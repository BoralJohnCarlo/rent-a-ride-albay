import {
    AnimatePresence,
    motion,
} from "framer-motion";

const renderCell = (column, row, state) =>
    column.render
        ? column.render(row, state)
        : row[column.key];

/**
 * One DataTable row as a card, for phones (the table scrolls sideways
 * there and hides most columns).
 */
const DataTableCard = ({
    row,
    slots,
    expandable = false,
    expanded = false,
    renderDetails,
    onToggle,
    onRowClick,
    isLeaving = false,
}) => {
    const state = { expanded, expandable };
    const clickable = expandable || onRowClick;

    const handleClick = () => {
        if (expandable) {
            onToggle?.(row);
        }

        onRowClick?.(row);
    };

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{
                opacity: isLeaving ? 0 : 1,
                y: isLeaving ? -12 : 0,
                scale: isLeaving ? 0.98 : 1,
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
            <div
                onClick={handleClick}
                className={`p-4 text-sm text-gray-700 dark:text-gray-200 ${
                    clickable
                        ? "cursor-pointer transition-colors active:bg-gray-50 dark:active:bg-gray-800"
                        : ""
                }`}
            >
                {(slots.lead.length > 0 || slots.title) && (
                    <div className="flex items-start gap-2">
                        {slots.lead.map((column) => (
                            <div
                                key={column.key}
                                className="shrink-0"
                            >
                                {renderCell(column, row, state)}
                            </div>
                        ))}

                        {slots.title && (
                            <div className="min-w-0 flex-1">
                                {renderCell(slots.title, row, state)}
                            </div>
                        )}
                    </div>
                )}

                {slots.fields.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                        {slots.fields.map((column) => (
                            <div
                                key={column.key}
                                className={`min-w-0 ${
                                    column.mobile === "full"
                                        ? "col-span-2"
                                        : ""
                                }`}
                            >
                                <dt className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                    {column.header}
                                </dt>
                                <dd className="min-w-0 break-words">
                                    {renderCell(column, row, state)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}

                {slots.footer.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                        {slots.footer.map((column) => (
                            <div key={column.key}>
                                {renderCell(column, row, state)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <AnimatePresence initial={false}>
                {expandable && renderDetails && expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden border-t border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                    >
                        <div className="p-4">
                            {renderDetails(row)}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.li>
    );
};

export default DataTableCard;
