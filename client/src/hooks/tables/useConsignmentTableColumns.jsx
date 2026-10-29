import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import Price from "../../components/common/Price";
import StatusChip from "../../components/common/StatusChip";

import TableActions from "../../components/tables/TableActions";

import getConsignmentCardData from "../../utils/getConsignmentCardData";
import createConsignmentTableActions from "../../utils/createConsignmentTableActions";

const useConsignmentTableColumns = ({
    compact = false,
    showActions = true,

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
    const navigate = useNavigate();

    return useMemo(() => {
        const columns = [
            {
                key: "consignment",
                header: "Application",
                width: "w-[38%]",

                render: (consignment) => {
                    const item =
                        getConsignmentCardData(
                            consignment
                        );

                    return (
                        <div className="space-y-1">
                            <p className="font-semibold text-gray-900">
                                {item.title}
                            </p>

                            <p className="text-sm text-gray-500">
                                {item.consignmentCode}
                            </p>

                            <p className="text-xs text-gray-400">
                                {item.plateNumber ||
                                    "No Plate Number"}
                            </p>
                        </div>
                    );
                },
            },

            {
                key: "applicant",
                header: "Applicant",
                width: "w-[20%]",

                render: (consignment) => {
                    const item =
                        getConsignmentCardData(
                            consignment
                        );

                    const operatorId =
                        consignment.audit
                            ?.createdBy?._id ??
                        consignment.audit
                            ?.createdBy;

                    return (
                        <div>
                            <p className="font-medium text-gray-900">
                                {item.applicantName}
                            </p>

                            {operatorId && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(
                                            `/admin/users?userId=${operatorId}`
                                        );
                                    }}
                                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                                >
                                    View Profile
                                </button>
                            )}

                            <p className="text-sm text-gray-500">
                                {item.vehicleType}
                            </p>
                        </div>
                    );
                },
            },

            {
                key: "status",
                header: "Current Stage",
                width: "w-[14%]",
                align: "center",

                render: (consignment) => {
                    const item =
                        getConsignmentCardData(
                            consignment
                        );

                    return (
                        <StatusChip
                            status={
                                item.status
                            }
                        />
                    );
                },
            },

            {
                key: "rate",
                header: "Daily Rate",
                width: "w-[12%]",
                align: "right",

                render: (consignment) => {
                    const item =
                        getConsignmentCardData(
                            consignment
                        );

                    return (
                        <Price
                            value={
                                item.dailyRate
                            }
                            className="font-semibold"
                        />
                    );
                },
            },
        ];

        if (showActions) {
            columns.push({
                key: "actions",
                header: "Actions",
                width: "w-[16%]",
                align: "right",

                render: (
                    consignment
                ) => (
                    <TableActions
                        variant="icons"
                        actions={createConsignmentTableActions(
                            {
                                item:
                                    consignment,

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
                            }
                        )}
                    />
                ),
            });
        }

        return columns;
    }, [
        compact,
        showActions,
        navigate,

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
    ]);
};

export default useConsignmentTableColumns;