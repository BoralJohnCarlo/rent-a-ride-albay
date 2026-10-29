import VehicleQuickDetails from "../vehicle/VehicleQuickDetails";

import DataTable from "./DataTable";

import useVehicleTableColumns from "../../hooks/tables/useVehicleTableColumns";

const VehicleTable = ({
    vehicles = [],
    loading = false,

    leavingRowId,

    compact = false,
    showApproval = false,
    showActions = true,

    expandedRows,
    onExpandedRowsChange,

    isArchivedView = false,

    onView,
    onEdit,
    onApprove,
    onArchive,
    onRestore,
}) => {
    const columns =
        useVehicleTableColumns({
            compact,
            showApproval,
            showActions,

            isArchivedView,

            onView,
            onEdit,
            onApprove,
            onArchive,
            onRestore,
        });

    return (
        <DataTable
            columns={columns}
            data={vehicles}
            loading={loading}
            compact={compact}
            caption="Vehicle management table"
            emptyMessage="No vehicles match the current search."
            leavingRowId={leavingRowId}
            expandable
            expandedRows={
                expandedRows
            }
            onExpandedRowsChange={
                onExpandedRowsChange
            }
            getRowId={(vehicle) =>
                vehicle._id
            }
            renderDetails={(vehicle) => (
                <VehicleQuickDetails
                    vehicle={vehicle}
                />
            )}
        />
    );
};

export default VehicleTable;