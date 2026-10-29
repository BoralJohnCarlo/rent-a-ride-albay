import ConfirmDialog from "../common/ConfirmDialog";
import Modal from "../common/Modal";

import DistanceFeeRuleForm from "../forms/DistanceFeeRuleForm";

const DistanceFeeRuleDialogs = ({
    mode = null,
    rule = null,
    isOpen = false,
    loading = false,
    errors = null,
    onClose,
    onSubmit,
}) => {
    const isFormMode =
        mode === "create" ||
        mode === "edit" ||
        mode === "view";

    if (!isOpen || !mode) {
        return null;
    }

    if (isFormMode) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={
                    mode === "create"
                        ? "Add Distance Fee Rule"
                        : mode === "edit"
                        ? "Edit Distance Fee Rule"
                        : "Distance Fee Rule Details"
                }
                size="lg"
                closeOnOverlayClick={!loading}
                closeOnEscape={!loading}
            >
                <DistanceFeeRuleForm
                    mode={mode}
                    rule={rule}
                    loading={loading}
                    errors={errors}
                    onSubmit={onSubmit}
                    onCancel={onClose}
                />
            </Modal>
        );
    }

    if (mode === "disable" || mode === "enable") {
        const isDisabling =
            mode === "disable";

        return (
            <ConfirmDialog
                isOpen={isOpen}
                onClose={onClose}
                onConfirm={() =>
                    onSubmit?.(rule)
                }
                loading={loading}
                title={
                    isDisabling
                        ? "Disable Distance Fee Rule"
                        : "Enable Distance Fee Rule"
                }
                message={
                    isDisabling
                        ? `Are you sure you want to disable the ${formatRange(rule)} km rule? It will no longer be used for distance fee calculations.`
                        : `Are you sure you want to enable the ${formatRange(rule)} km rule?`
                }
                confirmText={
                    isDisabling
                        ? "Disable"
                        : "Enable"
                }
                confirmVariant={
                    isDisabling
                        ? "danger"
                        : "success"
                }
            />
        );
    }

    if (mode === "delete") {
        return (
            <ConfirmDialog
                isOpen={isOpen}
                onClose={onClose}
                onConfirm={() =>
                    onSubmit?.(rule)
                }
                loading={loading}
                title="Delete Distance Fee Rule"
                message={
                    `Are you sure you want to delete the ${formatRange(rule)} km rule? This will disable the rule but preserve its data.`
                }
                confirmText="Delete"
                confirmVariant="danger"
            />
        );
    }

    return null;
};

function formatRange(rule) {
    if (!rule) {
        return "";
    }

    return `${rule.minDistanceKm}–${rule.maxDistanceKm}`;
}

export default DistanceFeeRuleDialogs;
