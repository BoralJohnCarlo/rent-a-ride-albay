import { useEffect, useMemo, useState } from "react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Input from "../common/Input";
import Badge from "../common/Badge";

const vehicleLabel = (vehicle) => {
    const name = [vehicle?.brand, vehicle?.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle?.vehicleCode || "Vehicle";
};

/*
 * One tracker, one vehicle - unlike VehicleCategoryAssignDialog (multi-
 * select), this is a single radio-style pick. Calling the existing
 * PATCH /trackers/:id/assign endpoint again with a different vehicle also
 * covers "reassign" - the backend allows re-targeting an already-assigned
 * tracker (and resolves the previous vehicle's active alerts). Clearing an
 * assignment is the separate Unassign action in TrackerTable. Callers pass
 * only non-archived vehicles, since archived ones can't take a tracker.
 */
const TrackerAssignDialog = ({
    isOpen,
    tracker,
    vehicles = [],
    trackers = [],
    loading = false,
    onClose,
    onConfirm,
}) => {
    const [search, setSearch] = useState("");
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setSelectedVehicleId(
                tracker?.vehicle ? String(tracker.vehicle) : null
            );
            setSearch("");
        }
    }, [isOpen, tracker]);

    const trackerByVehicleId = useMemo(() => {
        const map = new Map();

        trackers.forEach((item) => {
            if (item.vehicle) {
                map.set(String(item.vehicle), item);
            }
        });

        return map;
    }, [trackers]);

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
            ]
                .filter(Boolean)
                .some((value) =>
                    value.toString().toLowerCase().includes(keyword)
                )
        );
    }, [vehicles, search]);

    const currentVehicleId = tracker?.vehicle
        ? String(tracker.vehicle)
        : null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Assign Tracker to Vehicle"
            size="lg"
        >
            <div className="space-y-6">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/40">
                    <p className="text-xs tracking-wide text-gray-500 uppercase dark:text-gray-400">
                        Tracker
                    </p>

                    <h3 className="mt-1 font-mono text-lg font-semibold text-gray-900 dark:text-white">
                        {tracker?.imei}
                    </h3>
                </div>

                <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by vehicle code, plate number, brand, or model..."
                />

                <div className="max-h-96 space-y-3 overflow-y-auto">
                    {!filteredVehicles.length && (
                        <div className="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            No vehicles found.
                        </div>
                    )}

                    {filteredVehicles.map((vehicle) => {
                        const existingTracker =
                            trackerByVehicleId.get(vehicle._id);
                        const isCurrentTracker =
                            existingTracker &&
                            existingTracker._id === tracker?._id;
                        const isBlocked =
                            existingTracker && !isCurrentTracker;
                        const isSelected =
                            selectedVehicleId === vehicle._id;

                        return (
                            <label
                                key={vehicle._id}
                                className={`flex items-center gap-4 rounded-lg border p-4 transition ${
                                    isBlocked
                                        ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900"
                                        : isSelected
                                          ? "cursor-pointer border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                                          : "cursor-pointer border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-600"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="assign-vehicle"
                                    checked={isSelected}
                                    disabled={isBlocked}
                                    onChange={() =>
                                        setSelectedVehicleId(vehicle._id)
                                    }
                                />

                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-900 dark:text-white">
                                        {vehicleLabel(vehicle)}
                                    </p>

                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        {vehicle.plateNumber}
                                    </p>

                                    {isBlocked && (
                                        <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                                            Already has a tracker (
                                            {existingTracker.imei})
                                        </p>
                                    )}
                                </div>

                                <Badge
                                    variant={
                                        isBlocked
                                            ? "warning"
                                            : isCurrentTracker
                                              ? "success"
                                              : isSelected
                                                ? "primary"
                                                : "secondary"
                                    }
                                >
                                    {isBlocked
                                        ? "Unavailable"
                                        : isCurrentTracker
                                          ? "Current"
                                          : isSelected
                                            ? "Selected"
                                            : "Available"}
                                </Badge>
                            </label>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between border-t pt-4 dark:border-gray-800">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        {currentVehicleId
                            ? "Currently assigned to a vehicle above."
                            : "Not currently assigned."}
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
                            onClick={() => onConfirm(selectedVehicleId)}
                            loading={loading}
                            disabled={
                                !selectedVehicleId ||
                                selectedVehicleId === currentVehicleId
                            }
                        >
                            Assign
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TrackerAssignDialog;
