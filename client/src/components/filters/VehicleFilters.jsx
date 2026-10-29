import { useEffect, useMemo } from "react";

import Button from "../common/Button";
import Select from "../common/Select";

import useVehicleCategory from "../../hooks/categories";

const VehicleFilters = ({
    filters = {},
    onChange,
    onReset,
}) => {
    const {
        vehicleCategories,
        getVehicleCategories,
    } = useVehicleCategory();

    useEffect(() => {
        getVehicleCategories();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const categoryOptions = useMemo(() => {
        return vehicleCategories
            .filter(
                (category) =>
                    category.status === "Active" &&
                    (!filters.vehicleType ||
                        category.vehicleType ===
                            filters.vehicleType)
            )
            .sort(
                (a, b) =>
                    a.displayOrder -
                    b.displayOrder
            )
            .map((category) => ({
                label: category.name,
                value: category._id,
            }));
    }, [
        vehicleCategories,
        filters.vehicleType,
    ]);

    const handleFilterChange = (
        field,
        value
    ) => {
        onChange?.({
            ...filters,
            [field]: value,
        });
    };

    return (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

                <Select
                    label="Vehicle Type"
                    value={
                        filters.vehicleType ??
                        ""
                    }
                    onChange={(event) =>
                        handleFilterChange(
                            "vehicleType",
                            event.target.value
                        )
                    }
                    options={[
                        {
                            label: "Car",
                            value: "Car",
                        },
                        {
                            label: "Motorcycle",
                            value:
                                "Motorcycle",
                        },
                    ]}
                    placeholder="All Types"
                />

                <Select
                    label="Status"
                    value={
                        filters.status ??
                        ""
                    }
                    onChange={(event) =>
                        handleFilterChange(
                            "status",
                            event.target.value
                        )
                    }
                    options={[
                        {
                            label: "Available",
                            value:
                                "Available",
                        },
                        {
                            label: "Reserved",
                            value:
                                "Reserved",
                        },
                        {
                            label: "Rented",
                            value: "Rented",
                        },
                        {
                            label:
                                "Maintenance",
                            value:
                                "Maintenance",
                        },
                        {
                            label:
                                "Registration Expired",
                            value:
                                "RegistrationExpired",
                        },
                        {
                            label:
                                "Archived",
                            value:
                                "Archived",
                        },
                    ]}
                    placeholder="All Statuses"
                />

                <Select
                    label="Condition"
                    value={
                        filters.condition ??
                        ""
                    }
                    onChange={(event) =>
                        handleFilterChange(
                            "condition",
                            event.target.value
                        )
                    }
                    options={[
                        {
                            label:
                                "Excellent",
                            value:
                                "Excellent",
                        },
                        {
                            label: "Good",
                            value: "Good",
                        },
                        {
                            label: "Fair",
                            value: "Fair",
                        },
                        {
                            label:
                                "Needs Maintenance",
                            value:
                                "Needs Maintenance",
                        },
                    ]}
                    placeholder="All Conditions"
                />

                <Select
                    label="Category"
                    value={
                        filters.category ??
                        ""
                    }
                    onChange={(event) =>
                        handleFilterChange(
                            "category",
                            event.target.value
                        )
                    }
                    options={
                        categoryOptions
                    }
                    placeholder="All Categories"
                    disabled={
                        !!filters.vehicleType &&
                        categoryOptions.length ===
                            0
                    }
                />

                <Select
                    label="Featured"
                    value={
                        filters.isFeatured ??
                        ""
                    }
                    onChange={(event) =>
                        handleFilterChange(
                            "isFeatured",
                            event.target.value
                        )
                    }
                    options={[
                        {
                            label:
                                "Featured",
                            value: "true",
                        },
                        {
                            label:
                                "Not Featured",
                            value: "false",
                        },
                    ]}
                    placeholder="All Vehicles"
                />

                <Select
                    label="Booking"
                    value={
                        filters.bookingEnabled ??
                        ""
                    }
                    onChange={(event) =>
                        handleFilterChange(
                            "bookingEnabled",
                            event.target.value
                        )
                    }
                    options={[
                        {
                            label:
                                "Enabled",
                            value: "true",
                        },
                        {
                            label:
                                "Disabled",
                            value: "false",
                        },
                    ]}
                    placeholder="All Booking Status"
                />

            </div>

            <div className="mt-6 flex justify-end">

                <Button
                    type="button"
                    variant="outline"
                    onClick={onReset}
                >
                    Reset Filters
                </Button>

            </div>

        </div>
    );
};

export default VehicleFilters;