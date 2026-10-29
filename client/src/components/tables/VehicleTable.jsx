import VehicleQuickDetails from "../vehicle/VehicleQuickDetails";

import DataTable from "./DataTable";

import useVehicleTableColumns from "../../hooks/tables/useVehicleTableColumns";

const VehicleTable = ({
    vehicles = [],
    loading = false,

    leavingRowId,

    compact = false,
    dense = false,
    showApproval = false,
    showActions = true,

    expandedRows,
    onExpandedRowsChange,

    isArchivedView = false,
    platformCommissionRate = null,

    pinnedIds,
    onTogglePin,
    bookingSchedule,

    onView,
    onEdit,
    onApprove,
    onArchive,
    onRestore,
    onRenewRegistration,
    onManageAvailability,
    onOffRoad,
}) => {
    const columns =
        useVehicleTableColumns({
            compact,
            dense,
            showApproval,
            showActions,

            isArchivedView,

            pinnedIds,
            onTogglePin,
            bookingSchedule,

            onView,
            onEdit,
            onApprove,
            onArchive,
            onRestore,
            onRenewRegistration,
            onManageAvailability,
            onOffRoad,
        });

    return (
        <DataTable
            columns={columns}
            data={vehicles}
            loading={loading}
            compact={compact}
            dense={dense}
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
                    platformCommissionRate={
                        platformCommissionRate
                    }
                />
            )}
        />
    );
};

export default VehicleTable;