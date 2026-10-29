import ConfirmDialog from "../common/ConfirmDialog";
import Modal from "../common/Modal";

import ServiceLocationForm from "../forms/ServiceLocationForm";

const ServiceLocationDialogs = ({
    mode = null,
    location = null,
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
                        ? "Add Service Location"
                        : mode === "edit"
                        ? "Edit Service Location"
                        : "Service Location Details"
                }
                size="xl"
                closeOnOverlayClick={!loading}
                closeOnEscape={!loading}
            >
                <ServiceLocationForm
                    mode={mode}
                    location={location}
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
                    onSubmit?.(location)
                }
                loading={loading}
                title={
                    isDisabling
                        ? "Disable Service Location"
                        : "Enable Service Location"
                }
                message={
                    isDisabling
                        ? `Are you sure you want to disable "${location?.name}"? It will no longer be available for customers to select.`
                        : `Are you sure you want to enable "${location?.name}"?`
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
                    onSubmit?.(location)
                }
                loading={loading}
                title="Delete Service Location"
                message={
                    `Are you sure you want to delete "${location?.name}"? This will disable the location but preserve its data for historical bookings.`
                }
                confirmText="Delete"
                confirmVariant="danger"
            />
        );
    }

    return null;
};

export default ServiceLocationDialogs;
