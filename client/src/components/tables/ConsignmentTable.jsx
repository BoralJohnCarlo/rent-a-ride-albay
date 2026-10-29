import DataTable from "./DataTable";

import ConsignmentQuickDetails from "../consignments/ConsignmentQuickDetails";

import useConsignmentTableColumns from "../../hooks/tables/useConsignmentTableColumns";

const ConsignmentTable = ({
    consignments = [],
    loading = false,

    compact = false,
    showActions = true,

    expandedRows,
    onExpandedRowsChange,

    onView,
    onEdit,
    onSubmit,
    onWithdraw,
    onReview,
    onInspect,
    onApprove,
    onReject,
    onRequestRevision,
    onArchive,
    onRestore,
    onReviewReschedule,
}) => {
    const columns =
        useConsignmentTableColumns({
            compact,
            showActions,

            onView,
            onEdit,
            onSubmit,
            onWithdraw,
            onReview,
            onInspect,
            onApprove,
            onReject,
            onRequestRevision,
            onArchive,
            onRestore,
            onReviewReschedule,
        });

    return (
        <DataTable
            data={consignments}
            loading={loading}
            columns={columns}
            keyField="_id"
            expandedRows={expandedRows}
            onExpandedRowsChange={
                onExpandedRowsChange
            }
            renderDetails={(
                consignment
            ) => (
                <ConsignmentQuickDetails
                    consignment={
                        consignment
                    }
                />
            )}
            emptyTitle="No consignments found"
            emptyDescription="There are no consignment applications matching the current filters."
        />
    );
};

export default ConsignmentTable;