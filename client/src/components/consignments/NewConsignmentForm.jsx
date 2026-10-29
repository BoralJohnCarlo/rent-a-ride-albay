import { useEffect, useMemo, useState } from "react";

import Input from "../common/Input";
import Select from "../common/Select";
import Switch from "../common/Switch";

import useVehicleCategory from "../../hooks/categories";
import { VEHICLE_BRANDS } from "../../utils/vehicleBrands";
import {
    VEHICLE_TYPE_OPTIONS,
    TRANSMISSION_OPTIONS,
    FUEL_TYPE_OPTIONS,
} from "../../constants/vehicleConstants";

/*
 * The applicant is whichever operator is logged in — their profile is
 * snapshotted onto the consignment automatically server-side, so this form
 * only collects the vehicle being submitted (same scope as the "Vehicle
 * Information" step of operator registration). Covers just the vehicle
 * info + specs step of the New Consignment wizard — photos/description and
 * the inspection appointment are separate steps (NewConsignmentMediaForm /
 * InspectionAppointmentCalendar).
 */
const NewConsignmentForm = ({
    form,
    errors,

    onNestedChange,
}) => {
    const {
        vehicleCategories,
        getVehicleCategories,
    } = useVehicleCategory();

    useEffect(() => {
        getVehicleCategories();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const vehicleType = form.snapshots.vehicle.vehicleType;
    const brand = form.snapshots.vehicle.brand;
    const model = form.snapshots.vehicle.model;

    /*
     * A draft saved before this dropdown existed (or a brand/model VEHICLE_BRANDS
     * doesn't cover) may hold a value outside the known list — default to the
     * free-text fields in that case instead of silently hiding it behind a
     * dropdown that can't represent it.
     */
    const [isCustom, setIsCustom] = useState(() => {
        if (!brand) {
            return false;
        }

        const knownBrands =
            vehicleType && VEHICLE_BRANDS[vehicleType]
                ? Object.keys(VEHICLE_BRANDS[vehicleType])
                : [];

        return !knownBrands.includes(brand);
    });

    const brandOptions = useMemo(() => {
        const brands =
            vehicleType && VEHICLE_BRANDS[vehicleType]
                ? Object.keys(VEHICLE_BRANDS[vehicleType])
                : [];

        const hasCurrent = brand && !brands.includes(brand);

        return [
            {
                label: vehicleType
                    ? "Select Brand"
                    : "Select Vehicle Type First",
                value: "",
            },
            ...brands.map((value) => ({
                label: value,
                value,
            })),
            ...(hasCurrent
                ? [{ label: brand, value: brand }]
                : []),
        ];
    }, [vehicleType, brand]);

    const modelOptions = useMemo(() => {
        const models =
            vehicleType && brand && VEHICLE_BRANDS[vehicleType]?.[brand]
                ? VEHICLE_BRANDS[vehicleType][brand]
                : [];

        const hasCurrent = model && !models.includes(model);

        return [
            {
                label: brand ? "Select Model" : "Select Brand First",
                value: "",
            },
            ...models.map((value) => ({
                label: value,
                value,
            })),
            ...(hasCurrent
                ? [{ label: model, value: model }]
                : []),
        ];
    }, [vehicleType, brand, model]);

    const handleCustomToggle = (event) => {
        const checked = event.target.checked;

        setIsCustom(checked);

        if (!checked) {
            onNestedChange("snapshots.vehicle.brand", "");
            onNestedChange("snapshots.vehicle.model", "");
        }
    };

    const categoryOptions =
        useMemo(() => {
            const options =
                vehicleCategories
                    .filter(
                        (category) =>
                            category.status ===
                                "Active" &&
                            category.vehicleType ===
                                form.snapshots
                                    .vehicle
                                    .vehicleType
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

            return [
                {
                    label:
                        form.snapshots.vehicle
                            .vehicleType
                            ? "Select Category"
                            : "Select Vehicle Type First",
                    value: "",
                },
                ...options,
            ];
        }, [
            vehicleCategories,
            form.snapshots.vehicle
                .vehicleType,
        ]);

    return (
        <form className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Vehicle Information
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Basic details about the vehicle being submitted for
                        consignment.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Select
                        label="Vehicle Type"
                        value={form.snapshots.vehicle.vehicleType}
                        error={errors["snapshots.vehicle.vehicleType"]}
                        required
                        options={VEHICLE_TYPE_OPTIONS}
                        onChange={(event) => {
                            onNestedChange(
                                "snapshots.vehicle.vehicleType",
                                event.target.value
                            );

                            onNestedChange(
                                "snapshots.vehicle.category",
                                ""
                            );

                            onNestedChange(
                                "snapshots.vehicle.brand",
                                ""
                            );

                            onNestedChange(
                                "snapshots.vehicle.model",
                                ""
                            );
                        }}
                    />

                    {!isCustom ? (
                        <Select
                            label="Brand"
                            value={brand}
                            error={errors["snapshots.vehicle.brand"]}
                            required
                            options={brandOptions}
                            disabled={!vehicleType}
                            onChange={(event) => {
                                onNestedChange(
                                    "snapshots.vehicle.brand",
                                    event.target.value
                                );

                                onNestedChange(
                                    "snapshots.vehicle.model",
                                    ""
                                );
                            }}
                        />
                    ) : (
                        <Input
                            label="Brand"
                            placeholder="Enter brand name"
                            value={brand}
                            error={errors["snapshots.vehicle.brand"]}
                            required
                            onChange={(event) =>
                                onNestedChange(
                                    "snapshots.vehicle.brand",
                                    event.target.value
                                )
                            }
                        />
                    )}

                    {!isCustom ? (
                        <Select
                            label="Model"
                            value={model}
                            error={errors["snapshots.vehicle.model"]}
                            required
                            options={modelOptions}
                            disabled={!brand}
                            onChange={(event) =>
                                onNestedChange(
                                    "snapshots.vehicle.model",
                                    event.target.value
                                )
                            }
                        />
                    ) : (
                        <Input
                            label="Model"
                            placeholder="Enter model name"
                            value={model}
                            error={errors["snapshots.vehicle.model"]}
                            required
                            onChange={(event) =>
                                onNestedChange(
                                    "snapshots.vehicle.model",
                                    event.target.value
                                )
                            }
                        />
                    )}

                    <div className="md:col-span-2">
                        <Switch
                            id="consignment-vehicle-custom-brand"
                            label="Brand or model not listed?"
                            helperText="Turn this on to type the brand and model manually."
                            checked={isCustom}
                            onChange={handleCustomToggle}
                            disabled={!vehicleType}
                        />
                    </div>

                    <Input
                        label="Variant"
                        value={form.snapshots.vehicle.variant}
                        error={errors["snapshots.vehicle.variant"]}
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.variant",
                                event.target.value
                            )
                        }
                    />

                    <Input
                        label="Year"
                        type="number"
                        min="1900"
                        max={new Date().getFullYear() + 1}
                        value={form.snapshots.vehicle.year}
                        error={errors["snapshots.vehicle.year"]}
                        required
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.year",
                                event.target.value
                            )
                        }
                    />

                    <Select
                        label="Vehicle Category"
                        value={form.snapshots.vehicle.category}
                        error={errors["snapshots.vehicle.category"]}
                        options={categoryOptions}
                        disabled={!form.snapshots.vehicle.vehicleType}
                        helperText={
                            form.snapshots.vehicle.vehicleType
                                ? "Only active categories matching the selected vehicle type are displayed."
                                : "Select a vehicle type first."
                        }
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.category",
                                event.target.value
                            )
                        }
                    />

                </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Vehicle Specifications
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Technical specifications of the vehicle.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Select
                        label="Transmission"
                        value={
                            form.snapshots.vehicle.specifications
                                .transmission
                        }
                        error={
                            errors[
                                "snapshots.vehicle.specifications.transmission"
                            ]
                        }
                        required
                        options={TRANSMISSION_OPTIONS}
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.specifications.transmission",
                                event.target.value
                            )
                        }
                    />

                    <Select
                        label="Fuel Type"
                        value={
                            form.snapshots.vehicle.specifications.fuelType
                        }
                        error={
                            errors[
                                "snapshots.vehicle.specifications.fuelType"
                            ]
                        }
                        required
                        options={FUEL_TYPE_OPTIONS}
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.specifications.fuelType",
                                event.target.value
                            )
                        }
                    />

                    <Input
                        label="Seating Capacity"
                        type="number"
                        min="1"
                        value={
                            form.snapshots.vehicle.specifications
                                .seatingCapacity
                        }
                        error={
                            errors[
                                "snapshots.vehicle.specifications.seatingCapacity"
                            ]
                        }
                        required
                        onChange={(event) =>
                            onNestedChange(
                                "snapshots.vehicle.specifications.seatingCapacity",
                                event.target.value
                            )
                        }
                    />

                </div>
            </section>
        </form>
    );
};

export default NewConsignmentForm;
