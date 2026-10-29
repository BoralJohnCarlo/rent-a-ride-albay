import {
    AnimatePresence,
    motion,
} from "framer-motion";

const ALIGNMENT = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};

const DataTableRow = ({
    row,
    columns = [],
    compact = false,
    dense = false,
    expandable = false,
    expanded = false,
    renderDetails,
    onToggle,
    onRowClick,
    isLeaving = false,
}) => {
    const cellPadding = dense
        ? "px-3 py-2.5"
        : compact
          ? "px-5 py-2"
          : "px-5 py-3";

    const handleRowClick = () => {
        if (expandable) {
            onToggle?.(row);
        }

        onRowClick?.(row);
    };

    return (
        <>
            <motion.tr
                layout
                initial={{
                    opacity: 0,
                    y: 12,
                }}
                animate={{
                    opacity: isLeaving ? 0 : 1,
                    y: isLeaving ? -12 : 0,
                    scale: isLeaving ? 0.98 : 1,
                }}
                exit={{
                    opacity: 0,
                    y: -12,
                    scale: 0.98,
                }}
                transition={{
                    layout: {
                        duration: 0.3,
                        ease: "easeInOut",
                    },
                    duration: 0.25,
                    ease: "easeOut",
                }}
                onClick={handleRowClick}
                className={[
                    "transition-colors duration-200",
                    "bg-white dark:bg-gray-900",
                    "hover:bg-gray-50 dark:hover:bg-gray-800",
                    expandable || onRowClick
                        ? "cursor-pointer"
                        : "",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {columns.map((column) => (
                    <td
                        key={column.key}
                        className={[
                            "align-top text-sm",
                            "text-gray-700 dark:text-gray-200",
                            cellPadding,
                            ALIGNMENT[
                                column.align
                            ] ??
                                ALIGNMENT.left,
                            column.width,
                            column.cellClassName,
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        {column.render
                            ? column.render(row, {
                                  expanded,
                                  expandable,
                              })
                            : row[column.key]}
                    </td>
                ))}
            </motion.tr>

            <AnimatePresence initial={false}>
                {expandable &&
                    renderDetails &&
                    expanded && (
                        <motion.tr layout>
                            <td
                                colSpan={
                                    columns.length
                                }
                                className="bg-gray-50 p-0 dark:bg-gray-800"
                            >
                                <motion.div
                                    layout
                                    initial={{
                                        opacity: 0,
                                        height: 0,
                                    }}
                                    animate={{
                                        opacity: 1,
                                        height: "auto",
                                    }}
                                    exit={{
                                        opacity: 0,
                                        height: 0,
                                    }}
                                    transition={{
                                        layout: {
                                            duration: 0.3,
                                            ease: "easeInOut",
                                        },
                                        duration: 0.25,
                                        ease: "easeOut",
                                    }}
                                    className="overflow-hidden border-t border-gray-100 p-6 dark:border-gray-700"
                                >
                                    {renderDetails(
                                        row
                                    )}
                                </motion.div>
                            </td>
                        </motion.tr>
                    )}
            </AnimatePresence>
        </>
    );
};

export default DataTableRow;