import {
    useEffect,
    useState,
} from "react";

import Modal from "../common/Modal";
import VehicleForm from "../forms/VehicleForm";

import useToast from "../../hooks/toast/useToast";
import useVehicle from "../../hooks/vehicles/useVehicle";

const VehicleDialogs = ({
    open,
    mode = "create",
    vehicle = null,
    onClose,
}) => {
    const isEditMode =
        mode === "edit";

    const isViewMode =
        mode === "view";

    const toast = useToast();

    const {
        createVehicle,
        updateVehicle,
        loading,
    } = useVehicle();

    const [
        backendErrors,
        setBackendErrors,
    ] = useState([]);

    useEffect(() => {
        if (!open) {
            setBackendErrors([]);
        }
    }, [open]);

    const handleSubmit = async (
        formData
    ) => {
        setBackendErrors([]);

        try {
            if (
                isEditMode &&
                vehicle
            ) {
                await updateVehicle(
                    vehicle._id,
                    formData
                ).unwrap();

                toast.success(
                    "Vehicle updated successfully."
                );
            } else {
                await createVehicle(
                    formData
                ).unwrap();

                toast.success(
                    "Vehicle created successfully."
                );
            }

            onClose?.();
        } catch (error) {
            const validationErrors =
                Array.isArray(error?.errors)
                    ? error.errors
                    : [];

            if (
                validationErrors.length > 0
            ) {
                setBackendErrors(
                    validationErrors
                );
            }

            toast.error(
                error?.message ||
                    "Unable to save vehicle."
            );
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={
                isViewMode
                    ? "Vehicle Details"
                    : isEditMode
                    ? "Edit Vehicle"
                    : "Add New Vehicle"
            }
            size="xl"
        >
            <VehicleForm
                key={open ? "open" : "closed"}
                mode={mode}
                vehicle={vehicle}
                loading={loading}
                errors={backendErrors}
                onSubmit={handleSubmit}
                onCancel={onClose}
            />
        </Modal>
    );
};

export default VehicleDialogs;