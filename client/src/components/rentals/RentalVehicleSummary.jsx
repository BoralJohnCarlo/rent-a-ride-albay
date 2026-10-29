import {
    CarFront,
    Hash,
    MapPin,
} from "lucide-react";

import StatusChip from "../common/StatusChip";

const getVehicleName = (vehicle) => {
    if (!vehicle) {
        return "Unknown Vehicle";
    }

    const name = [
        vehicle.brand,
        vehicle.model,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        name ||
        vehicle.name ||
        vehicle.vehicleCode ||
        "Unknown Vehicle"
    );
};

const RentalVehicleSummary = ({
    vehicle,
    vehicleOutcome = null,
}) => {
    if (!vehicle) {
        return (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <CarFront size={19} />
                    </div>

                    <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            Vehicle
                        </p>

                        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                            No vehicle information available.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    const vehicleName = getVehicleName(vehicle);

    const plateNumber =
        vehicle.plateNumber ||
        vehicle.plate ||
        null;

    const vehicleCode =
        vehicle.vehicleCode ||
        null;

    const status =
        vehicle.status ||
        null;

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <CarFront size={20} />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Vehicle
                            </p>

                            <h3 className="mt-1 truncate text-base font-semibold text-gray-900 dark:text-white">
                                {vehicleName}
                            </h3>
                        </div>

                        {status && (
                            <StatusChip
                                status={status}
                                size="sm"
                            />
                        )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {vehicleCode && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <Hash
                                    size={15}
                                    className="shrink-0 text-gray-400"
                                />

                                <span className="truncate">
                                    {vehicleCode}
                                </span>
                            </div>
                        )}

                        {plateNumber && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                <MapPin
                                    size={15}
                                    className="shrink-0 text-gray-400"
                                />

                                <span className="truncate">
                                    {plateNumber}
                                </span>
                            </div>
                        )}
                    </div>

                    {vehicleOutcome && (
                        <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                Vehicle Outcome
                            </p>

                            <p className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                                {typeof vehicleOutcome ===
                                "string"
                                    ? vehicleOutcome
                                    : vehicleOutcome.status ||
                                      vehicleOutcome.condition ||
                                      "Recorded"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default RentalVehicleSummary;