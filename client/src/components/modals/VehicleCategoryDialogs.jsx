import {
    useEffect,
    useState,
} from "react";

import Modal from "../common/Modal";
import VehicleCategoryForm from "../forms/VehicleCategoryForm";

import useToast from "../../hooks/toast/useToast";
import useVehicleCategory from "../../hooks/categories";

const VehicleCategoryDialogs = ({
    open = false,
    mode = "create",
    vehicleCategory = null,
    onClose,
}) => {
    const toast = useToast();

    const {
        loading,
        createVehicleCategory,
        updateVehicleCategory,
    } = useVehicleCategory();

    const [submitting, setSubmitting] =
        useState(false);

    useEffect(() => {
        if (!open) {
            setSubmitting(false);
        }
    }, [open]);

    const handleSubmit = async (
        categoryData
    ) => {
        setSubmitting(true);

        try {
            if (mode === "create") {
                await createVehicleCategory(
                    categoryData
                ).unwrap();

                toast.success(
                    "Vehicle category created successfully."
                );
            } else {
                await updateVehicleCategory(
                    vehicleCategory._id,
                    categoryData
                ).unwrap();

                toast.success(
                    "Vehicle category updated successfully."
                );
            }

            onClose?.();
        } catch (error) {
            toast.error(
                error ||
                    "Unable to save vehicle category."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={
                mode === "create"
                    ? "Create Vehicle Category"
                    : "Edit Vehicle Category"
            }
        >
            <VehicleCategoryForm
                mode={mode}
                vehicleCategory={
                    vehicleCategory
                }
                loading={
                    loading ||
                    submitting
                }
                onSubmit={handleSubmit}
                onCancel={onClose}
            />
        </Modal>
    );
};

export default VehicleCategoryDialogs;