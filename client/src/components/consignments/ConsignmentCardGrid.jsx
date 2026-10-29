import ConsignmentCard from "./ConsignmentCard";

const ConsignmentCardGrid = ({
    consignments = [],
    onSelect,
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
    onBookInspection,
    onReviewReschedule,
    className = "",
}) => {
    return (
        <div
            className={[
                "grid",
                "grid-cols-1",
                "gap-6",
                "sm:grid-cols-2",
                "xl:grid-cols-3",
                "2xl:grid-cols-4",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {consignments.map(
                (consignment) => (
                    <ConsignmentCard
                        key={consignment._id}
                        consignment={consignment}
                        onSelect={onSelect}
                        onView={onView}
                        onEdit={onEdit}
                        onSubmit={onSubmit}
                        onWithdraw={onWithdraw}
                        onReview={onReview}
                        onInspect={onInspect}
                        onApprove={onApprove}
                        onReject={onReject}
                        onRequestRevision={
                onRequestRevision
                }
                        onArchive={onArchive}
                        onRestore={onRestore}
                        onBookInspection={onBookInspection}
                        onReviewReschedule={onReviewReschedule}
                    />
                )
            )}
        </div>
    );
};

export default ConsignmentCardGrid;