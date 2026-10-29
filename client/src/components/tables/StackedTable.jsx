import { useLayoutEffect, useRef } from "react";

/*
 * Copies each header cell's text onto the body cells of its column as
 * data-label, which styles/stack-table.css shows as the field label when
 * the table stacks into cards on phones.
 */
const labelCells = (table) => {
    const labels = [...table.querySelectorAll(":scope > thead th")].map(
        (th) => th.textContent.trim()
    );

    table
        .querySelectorAll(":scope > tbody > tr")
        .forEach((row) => {
            [...row.children].forEach((cell, index) => {
                const label = labels[index];

                if (label && cell.dataset.label !== label) {
                    cell.dataset.label = label;
                }
            });
        });
};

/**
 * A drop-in <table> that stacks into labelled cards below md.
 */
const StackedTable = ({ className = "", children, ...props }) => {
    const tableRef = useRef(null);

    useLayoutEffect(() => {
        const table = tableRef.current;

        if (!table) return undefined;

        labelCells(table);

        // Rows come and go with filters, paging and loading states.
        const observer = new MutationObserver(() => labelCells(table));

        observer.observe(table, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return (
        <table
            ref={tableRef}
            className={`stack-table ${className}`}
            {...props}
        >
            {children}
        </table>
    );
};

export default StackedTable;
