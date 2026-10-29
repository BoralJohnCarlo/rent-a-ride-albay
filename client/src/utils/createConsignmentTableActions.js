import {
    Archive,
    CalendarClock,
    Check,
    Eye,
    Pencil,
    RotateCcw,
    Search,
    Send,
    Undo2,
    X,
} from "lucide-react";

const createConsignmentTableActions = ({
    item,

    onView,
    onEdit,
    onSubmit,
    onWithdraw,
    onReview,
    onApprove,
    onReject,
    onRequestRevision,
    onArchive,
    onRestore,
    onReviewReschedule,
}) => {
    const application =
        item?.application ?? {};

    const status =
        application.status ??
        "Draft";

    const normalizedStatus =
        status.toLowerCase();

    const inspectionStatus =
        application.inspection?.status?.toLowerCase();

    const isArchived =
        item?.archive?.isArchived ??
        false;

    const isEditable =
        normalizedStatus === "draft" ||
        normalizedStatus === "revision requested";

    const actions = [];

    if (onView) {
        actions.push({
            label: "View",
            variant: "outline",
            color: "blue",
            icon: Eye,
            onClick: () => onView(item),
        });
    }

    if (isEditable && onEdit) {
    actions.push({
        label: "Edit",
        variant: "primary",
        color: "blue",
        icon: Pencil,
        onClick: () => onEdit(item),
    });
}

    if (isEditable && onSubmit) {
        actions.push({
            label:
                normalizedStatus === "revision requested"
                    ? "Resubmit"
                    : "Submit",
            variant: "success",
            color: "green",
            icon: Send,
            onClick: () =>
                onSubmit(item),
        });
    }

    if (
        [
            "pending",
            "under review",
            "revision requested",
        ].includes(normalizedStatus) &&
        onWithdraw
    ) {
        actions.push({
            label: "Withdraw",
            variant: "danger",
            color: "red",
            icon: Undo2,
            onClick: () =>
                onWithdraw(item),
        });
    }

    if (
        normalizedStatus === "pending" &&
    onReview
    ) {
        actions.push({
        label: "Start Review",
        variant: "primary",
        color: "blue",
        icon: Search,
        onClick: () =>
            onReview(item),
    });
}

    if (
        normalizedStatus ===
            "under review" &&
        [
            "passed",
            "conditional pass",
        ].includes(inspectionStatus) &&
        onApprove
    ) {
        actions.push({
            label: "Approve",
            variant: "success",
            color: "green",
            icon: Check,
            onClick: () =>
                onApprove(item),
        });
    }

    if (
        [
            "pending",
            "under review",
        ].includes(normalizedStatus) &&
        onReject
    ) {
        actions.push({
            label: "Reject",
            variant: "danger",
            color: "red",
            icon: X,
            onClick: () =>
                onReject(item),
        });
    }

    if (
        [
            "pending",
            "under review",
        ].includes(normalizedStatus) &&
        onRequestRevision
    ) {
        actions.push({
            label: "Request Revision",
            variant: "warning",
            color: "orange",
            icon: Undo2,
            onClick: () =>
                onRequestRevision(
                    item
                ),
        });
    }

    if (
    ["approved", "rejected", "withdrawn"].includes(
        normalizedStatus
    ) &&
    !isArchived &&
    onArchive
) {
    actions.push({
        label: "Archive",
        variant: "secondary",
        color: "gray",
        icon: Archive,
        onClick: () =>
            onArchive(item),
    });
}

    if (
    isArchived &&
    onRestore
) {
    actions.push({
        label: "Restore",
        variant: "secondary",
        color: "blue",
        icon: RotateCcw,
        onClick: () =>
            onRestore(item),
    });
}

    if (
        item?.reschedule?.status === "Pending" &&
        onReviewReschedule
    ) {
        actions.push({
            label: "Review Reschedule",
            variant: "warning",
            color: "orange",
            icon: CalendarClock,
            onClick: () =>
                onReviewReschedule(item),
        });
    }

    return actions;
};

export default createConsignmentTableActions;