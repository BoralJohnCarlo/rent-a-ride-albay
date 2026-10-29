import DriverQuickDetails from "../driver/DriverQuickDetails";

import DataTable from "./DataTable";

import useDriverTableColumns from "../../hooks/tables/useDriverTableColumns";

const DriverTable = ({
    drivers = [],
    loading = false,

    leavingRowId,

    compact = false,
    showActions = true,

    expandedRows,
    onExpandedRowsChange,

    isArchivedView = false,

    onView,
    onEdit,
    onArchive,
    onRestore,
    onStatusChange,
}) => {
    const columns = useDriverTableColumns({
        compact,
        showActions,

        isArchivedView,

        onView,
        onEdit,
        onArchive,
        onRestore,
        onStatusChange,
    });

    return (
        <DataTable
            columns={columns}
            data={drivers}
            loading={loading}
            compact={compact}
            caption="Driver management table"
            emptyMessage="No drivers match the current search."
            leavingRowId={leavingRowId}
            expandable
            expandedRows={expandedRows}
            onExpandedRowsChange={
                onExpandedRowsChange    
            }
            getRowId={(driver) =>
                driver._id
            }
            renderDetails={(driver) => (
                <DriverQuickDetails
                    driver={driver}
                />
            )}
        />
    );
};

export default DriverTable;