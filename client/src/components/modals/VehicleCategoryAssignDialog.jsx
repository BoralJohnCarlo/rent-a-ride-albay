import { useMemo } from "react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Badge from "../common/Badge";

const VehicleCategoryAssignDialog = ({
    isOpen,
    category,

    vehicles = [],
    loading = false,

    search,
    onSearch,

    selectedVehicles = [],
    onSelectionChange,

    onClose,
    onConfirm,
}) => {
    const filteredVehicles = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) {
            return vehicles;
        }

        return vehicles.filter((vehicle) =>
            [
                vehicle.vehicleCode,
                vehicle.plateNumber,
                vehicle.brand,
                vehicle.model,
                vehicle.year,
            ]
                .filter(Boolean)
                .some((value) =>
                    value
                        .toString()
                        .toLowerCase()
                        .includes(keyword)
                )
        );
    }, [vehicles, search]);

    const toggleVehicle = (vehicle) => {
    if (
        vehicle.category?._id === category?._id
    ) {
        return;
    }

    if (
        selectedVehicles.includes(vehicle._id)
    ) {
        onSelectionChange(
            selectedVehicles.filter(
                (id) => id !== vehicle._id
            )
        );

        return;
    }

    onSelectionChange([
        ...selectedVehicles,
        vehicle._id,
    ]);
};

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Assign Vehicles"
            size="xl"
        >
            <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Vehicle Category
                    </p>

                    <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                        {category?.name ?? "-"}
                    </h3>

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {category?.vehicleType}
                    </p>
                </div>

                <Input
                    value={search}
                    onChange={(event) =>
                        onSearch(
                            event.target.value
                        )
                    }
                    placeholder="Search by vehicle code, plate number, brand, model, or year..."
                />

                <div className="max-h-96 space-y-3 overflow-y-auto">
                    {!filteredVehicles.length && (
                        <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            No vehicles found.
                        </div>
                    )}

                    {filteredVehicles.map(
                        (vehicle) => {
                            const checked = selectedVehicles.includes(
                        vehicle._id
                        );

                            const assigned = Boolean(
                        vehicle.category
                        );

                            const alreadyAssigned =
                        vehicle.category?._id === category?._id;

                            return (
                                <label
                                    key={
                                        vehicle._id
                                    }
                                    className={`
                                        flex
                                        items-center
                                        gap-4
                                        rounded-lg
                                        border
                                        p-4
                                        transition
                                    ${
                                        alreadyAssigned
                                    ? "cursor-not-allowed border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/30"
                                    : "cursor-pointer border-gray-200 hover:border-primary-500 dark:border-gray-800 dark:hover:border-gray-600"
                                    }
                                `}
                                >
                                <input
                                    type="checkbox"
                                    checked={
                                alreadyAssigned || checked
                                }
                                    disabled={alreadyAssigned}
                                    onChange={() =>
                                toggleVehicle(vehicle)
                                }
                            />

                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {vehicle.year
                                                ? `${vehicle.year} `
                                                : ""}
                                            {
                                                vehicle.brand
                                            }{" "}
                                            {
                                                vehicle.model
                                            }
                                        </p>

                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Vehicle
                                            Code:{" "}
                                            {
                                                vehicle.vehicleCode
                                            }
                                        </p>

                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Plate
                                            Number:{" "}
                                            {
                                                vehicle.plateNumber
                                            }
                                        </p>

                                        {alreadyAssigned ? (
                                    <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                                        Already belongs to this category
                                    </p>
                                        ) : assigned ? (
                                    <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                                        Assigned to{" "}
                                        {vehicle.category?.name ??
                                        "Category"}
                                    </p>
                                    ) : null}
                                    </div>

                                    <Badge
                                        variant={
                                    alreadyAssigned
                                        ? "success"
                                        : checked
                                        ? "primary"
                                        : assigned
                                        ? "warning"
                                        : "secondary"
                                    }
                                >
                                    {alreadyAssigned
                                        ? "Already Assigned"
                                        : checked
                                        ? "Selected"
                                        : assigned
                                        ? "Assigned"
                                        : "Available"}
                                    </Badge>
                                </label>
                            );
                        }
                    )}
                </div>

                <div className="flex items-center justify-between border-t pt-4 dark:border-gray-800">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        Selected:{" "}
                        {
                            selectedVehicles.length
                        }{" "}
                        vehicle
                        {selectedVehicles.length !==
                            1 && "s"}
                    </span>

                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </Button>

                        <Button
                            onClick={onConfirm}
                            loading={loading}
                        >
                            Assign Vehicles
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VehicleCategoryAssignDialog;