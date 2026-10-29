import {
    Archive,
    Check,
    Eye,
    Pencil,
    RotateCcw,
    UserRoundCheck,
    UserRoundX,
} from "lucide-react";

const createTableActions = ({
    item,
    onView,
    onEdit,
    onArchive,
    onApprove,
    showApproval = false,
    approved = true,
    beforeArchiveActions = [],
    additionalActions = [],
}) => {
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

    if (onEdit) {
        actions.push({
            label: "Edit",
            variant: "primary",
            color: "orange",
            icon: Pencil,
            onClick: () => onEdit(item),
        });
    }

    if (
        showApproval &&
        !approved &&
        onApprove
    ) {
        actions.push({
            label: "Approve",
            variant: "success",
            color: "green",
            icon: Check,
            onClick: () => onApprove(item),
        });
    }

    if (
        Array.isArray(beforeArchiveActions) &&
        beforeArchiveActions.length > 0
    ) {
        actions.push(...beforeArchiveActions);
    }

    if (
        Array.isArray(additionalActions) &&
        additionalActions.length > 0
    ) {
        actions.push(
            ...additionalActions.map(
                (action) => {
                    let defaultIcon =
                        RotateCcw;

                    if (
                        action.label ===
                        "Suspend"
                    ) {
                        defaultIcon =
                            UserRoundX;
                    }

                    if (
                        action.label ===
                        "Activate"
                    ) {
                        defaultIcon =
                            UserRoundCheck;
                    }

                    return {
                        variant:
                            "success",
                        color: "green",
                        icon: defaultIcon,
                        ...action,
                    };
                }
            )
        );
    }

    if (onArchive) {
        actions.push({
            label: "Archive",
            variant: "danger",
            color: "red",
            icon: Archive,
            onClick: () => onArchive(item),
        });
    }

    return actions;
};

export default createTableActions;