import {
    useEffect,
    useState,
} from "react";

import Input from "../common/Input";
import Select from "../common/Select";
import Textarea from "../common/Textarea";
import Button from "../common/Button";

const vehicleTypeOptions = [
    {
        label: "Car",
        value: "Car",
    },
    {
        label: "Motorcycle",
        value: "Motorcycle",
    },
];

const statusOptions = [
    {
        label: "Active",
        value: "Active",
    },
    {
        label: "Inactive",
        value: "Inactive",
    },
];

const initialFormData = {
    name: "",
    description: "",
    vehicleType: "",
    status: "Active",
};

const VehicleCategoryForm = ({
    mode = "create",
    vehicleCategory = null,
    loading = false,
    onSubmit,
    onCancel,
}) => {
    const [formData, setFormData] =
        useState(initialFormData);

    useEffect(() => {
        if (
            mode === "edit" &&
            vehicleCategory
        ) {
            setFormData({
                name:
                    vehicleCategory.name || "",

                description:
                    vehicleCategory.description ||
                    "",

                vehicleType:
                    vehicleCategory.vehicleType ||
                    "",

                status:
                    vehicleCategory.status ||
                    "Active",
            });
        } else {
            setFormData(initialFormData);
        }
    }, [
        mode,
        vehicleCategory,
    ]);
    const handleChange = (event) => {
        const {
            name,
            value,
        } = event.target;

         setFormData((previous) => ({
        ...previous,
        [name]: value,
        }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (onSubmit) {
            onSubmit(formData);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-8"
        >
            <section className="space-y-6">

                <h2 className="text-lg font-semibold">
                    Basic Information
                </h2>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                    <Input
                        label="Category Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />

                    <Select
                        label="Vehicle Type"
                        name="vehicleType"
                        value={formData.vehicleType}
                        options={vehicleTypeOptions}
                        onChange={handleChange}
                        required
                    />

                    <Select
                        label="Status"
                        name="status"
                        value={formData.status}
                        options={statusOptions}
                        onChange={handleChange}
                    />
                </div>

                <Textarea
                    label="Description"
                    name="description"
                    value={
                        formData.description
                    }
                    onChange={handleChange}
                    rows={4}
                />

            </section>

            <div className="flex justify-end gap-4 pt-4">

                <Button
                    type="button"
                    variant="secondary"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancel
                </Button>

                <Button
                    type="submit"
                    disabled={loading}
                >
                    {loading
                        ? "Saving..."
                        : mode === "edit"
                        ? "Update Category"
                        : "Create Category"}
                </Button>

            </div>

        </form>
    );
};

export default VehicleCategoryForm;