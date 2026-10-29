import { useState } from "react";
import { motion } from "framer-motion";

import EmptyState from "../common/EmptyState";
import LoadingSpinner from "../common/LoadingSpinner";
import useMediaQuery from "../../hooks/ui/useMediaQuery";

import { getCardSlots } from "./cardSlots";
import DataTableCard from "./DataTableCard";
import DataTableRow from "./DataTableRow";

const ALIGNMENT = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
};

const DataTable = ({
    columns = [],
    data = [],
    loading = false,
    leavingRowId,
    compact = false,
    // Tighter padding and smaller header text, for tables with many columns.
    dense = false,
    emptyMessage = "No records found.",
    // Optional element (e.g. a help button) shown under the empty message.
    emptyAction,
    onRowClick,
    caption,
    className = "",
    expandable = false,
    renderDetails,
    expandedRows,
    onExpandedRowsChange,
    getRowId = (row) =>
        row?._id ?? row?.id,
    // Keep the table on phones too (default: rows become cards there).
    noCards = false,
}) => {
    const isPhone = useMediaQuery("(width < 48rem)");

    const headerPadding = dense
        ? "px-3 py-2.5"
        : compact
          ? "px-6 py-3"
          : "px-6 py-4";

    const headerText = dense
        ? "text-[11px] font-bold uppercase tracking-wider"
        : "text-sm font-semibold uppercase tracking-wide";

    const [
        internalExpandedRows,
        setInternalExpandedRows,
    ] = useState([]);

    const activeExpandedRows =
        expandedRows ?? internalExpandedRows;

    const setExpandedState =
        onExpandedRowsChange ??
        setInternalExpandedRows;

    const toggleRow = (row) => {
        const rowId = getRowId(row);

        setExpandedState((previous) => {
            const current =
                expandedRows ?? previous;

            if (current.includes(rowId)) {
                return current.filter(
                    (id) => id !== rowId
                );
            }

            return [
                ...current,
                rowId,
            ];
        });
    };

    if (loading) {
        return (
            <LoadingSpinner
                message="Loading data..."
            />
        );
    }

    if (!loading && !data.length) {
        return (
            <EmptyState
                title="No Results"
                description={
                    emptyMessage
                }
                action={emptyAction}
            />
        );
    }

    if (isPhone && !noCards) {
        const slots = getCardSlots(columns);

        return (
            <ul
                aria-label={caption}
                className={["space-y-3", className]
                    .filter(Boolean)
                    .join(" ")}
            >
                {data.map((row, index) => (
                    <DataTableCard
                        key={getRowId(row) ?? index}
                        row={row}
                        slots={slots}
                        isLeaving={
                            leavingRowId === getRowId(row)
                        }
                        expandable={expandable}
                        expanded={activeExpandedRows.includes(
                            getRowId(row)
                        )}
                        onToggle={toggleRow}
                        renderDetails={renderDetails}
                        onRowClick={onRowClick}
                    />
                ))}
            </ul>
        );
    }

    return (
        <div
            className={[
                "overflow-hidden rounded-xl border shadow-sm",
                "border-gray-200 bg-white",
                "dark:border-gray-700 dark:bg-gray-900",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="overflow-x-auto">
                <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
                    {caption && (
                        <caption className="sr-only">
                            {caption}
                        </caption>
                    )}

                    <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                            {columns.map(
                                (column) => (
                                    <th
                                        key={
                                            column.key
                                        }
                                        scope="col"
                                        className={[
                                            headerText,
                                            "text-gray-600 dark:text-gray-300",
                                            headerPadding,
                                            ALIGNMENT[
                                                column
                                                    .align
                                            ] ??
                                                ALIGNMENT.left,
                                            column.width,
                                            column.headerClassName,
                                        ]
                                            .filter(
                                                Boolean
                                            )
                                            .join(
                                                " "
                                            )}
                                    >
                                        {
                                            column.header
                                        }
                                    </th>
                                )
                            )}
                        </tr>
                    </thead>

                    <motion.tbody
                        layout
                        className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-900"
                    >
                        {data.map(
                            (
                                row,
                                index
                            ) => (
                                <DataTableRow
                                    key={
                                        getRowId(
                                            row
                                        ) ??
                                        index
                                    }
                                    row={row}
                                    isLeaving={
                                        leavingRowId ===
                                        getRowId(
                                            row
                                        )
                                    }
                                    columns={
                                        columns
                                    }
                                    compact={
                                        compact
                                    }
                                    dense={dense}
                                    expandable={
                                        expandable
                                    }
                                    expanded={activeExpandedRows.includes(
                                        getRowId(
                                            row
                                        )
                                    )}
                                    onToggle={
                                        toggleRow
                                    }
                                    renderDetails={
                                        renderDetails
                                    }
                                    onRowClick={
                                        onRowClick
                                    }
                                />
                            )
                        )}
                    </motion.tbody>
                </table>
            </div>
        </div>
    );
};

export default DataTable;