import { useEffect, useMemo, useState } from "react";

import useVehicle from "../../hooks/vehicles/useVehicle";
import useVerifiedPayoutSettings from "../../hooks/payouts/useVerifiedPayoutSettings";
import Button from "../../components/common/Button";
import VehicleCardList from "../../components/vehicle/VehicleCardList";
import EmptyState from "../../components/common/EmptyState";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import PillSearch from "../../components/common/PillSearch";

/*
 * A partner's own fleet — the vehicles that came out of an approved
 * consignment. Read-only: no edit/archive here, since the platform (admin)
 * manages the live listing, including archiving. Only the active fleet is
 * shown - there's no Archived view, since an operator has no action to take
 * on an archived vehicle anyway. Uses the same expandable-card gallery as
 * admin's Fleet page, just without the table view or any mutation actions.
 */
const Vehicles = () => {
    const {
        vehicles = [],
        loading = false,
        error = null,
        getMyVehicles,
    } = useVehicle();

    const {
        settings: payoutSettings,
        error: settingsError,
        loading: settingsLoading,
        retry: retrySettings,
    } = useVerifiedPayoutSettings();

    const platformCommissionRate =
        payoutSettings?.platformCommissionRate ?? null;

    const [search, setSearch] = useState("");

    useEffect(() => {
        getMyVehicles();
    }, [getMyVehicles]);

    const filteredVehicles = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        if (!keyword) {
            return vehicles;
        }

        return vehicles.filter((vehicle) => {
            const searchable = [
                vehicle.vehicleCode,
                vehicle.brand,
                vehicle.model,
                vehicle.plateNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return searchable.includes(keyword);
        });
    }, [vehicles, search]);

    const hasFilters = Boolean(search.trim());

    return (
        <div className="space-y-6">
            <div className="flex justify-center">
                <PillSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by brand, model, plate..."
                    label="Search vehicles"
                />
            </div>

            {settingsLoading && <p role="status" className="text-sm text-gray-500">Loading commission settings...</p>}
            {settingsError && (
                <div role="alert" className="flex flex-col gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:bg-red-950/30 dark:text-red-400">
                    <p className="min-w-0 break-words">{settingsError} Platform commission rate unavailable.</p>
                    <Button size="sm" variant="outline" onClick={retrySettings} className="w-full shrink-0 sm:w-auto">Retry commission settings</Button>
                </div>
            )}
            {error && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                    <span>
                        {typeof error === "string"
                            ? error
                            : "Unable to load your vehicles."}
                    </span>
                    <button
                        type="button"
                        onClick={() => getMyVehicles()}
                        className="font-semibold underline underline-offset-2"
                    >
                        Retry
                    </button>
                </div>
            )}

            {loading ? (
                <LoadingSpinner fullScreen={false} />
            ) : filteredVehicles.length === 0 ? (
                <EmptyState
                    title="No Vehicles Yet"
                    description={
                        hasFilters
                            ? "No vehicles match your search."
                            : "Approved consignment applications will show up here as your live fleet."
                    }
                />
            ) : (
                <VehicleCardList
                    vehicles={filteredVehicles}
                    partnerView
                    platformCommissionRate={
                        platformCommissionRate
                    }
                />
            )}
        </div>
    );
};

export default Vehicles;
