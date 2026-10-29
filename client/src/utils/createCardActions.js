const createCardActions = ({
    item,
    onView,
    onEdit,
    onArchive,
    onApprove,
    showApproval = false,
    approved = false,
    additionalActions = [],
}) => {
    const actions = [];

    if (onView) {
        actions.push({
            label: "View",
            onClick: () => onView(item),
        });
    }

    if (onEdit) {
        actions.push({
            label: "Edit",
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
            onClick: () =>
                onApprove(item),
        });
    }

    if (
        Array.isArray(
            additionalActions
        )
    ) {
        actions.push(
            ...additionalActions
        );
    }

    if (onArchive) {
        actions.push({
            label: "Archive",
            variant: "danger",
            onClick: () =>
                onArchive(item),
        });
    }

    return actions;
};

export default createCardActions;