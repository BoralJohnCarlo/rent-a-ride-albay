import { useEffect } from "react";

import PendingVehicleGrid from "../pendingVehicles/PendingVehicleGrid";
import Button from "../common/Button";

import usePendingVehicles from "../../hooks/pendingVehicles/usePendingVehicles";

const LIST_PARAMS = {
    sortBy: "createdAt",
    sortOrder: "desc",
    limit: 20,
};

/*
 * The vehicle an operator submits during registration becomes a
 * PendingVehicle, not a Consignment — a separate, older workflow that the
 * rest of the consignment system doesn't touch. This surfaces those
 * submissions on the operator's Consignments page too, since from their
 * point of view it's the same thing: "a vehicle I'm waiting on admin to
 * approve." Read-only — approve/reject stays admin-only.
 */
const OperatorPendingVehiclesPanel = () => {
    const {
        pendingVehicles,
        loading,
        error,
        loadMyPendingVehicles,
    } = usePendingVehicles();

    useEffect(() => {
        loadMyPendingVehicles(LIST_PARAMS);
    }, [loadMyPendingVehicles]);

    if (!loading && !error && pendingVehicles.length === 0) {
        return null;
    }

    return (
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4">
                <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Vehicle Submitted at Registration
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    The vehicle you submitted when you registered, awaiting
                    admin approval. This is separate from consignment
                    applications below.
                </p>
            </div>

            {error && (
                <div role="alert" className="mb-4 flex flex-col gap-3 text-sm text-red-600 sm:flex-row sm:items-center sm:justify-between dark:text-red-400">
                    <p className="min-w-0 break-words">{(typeof error === "string" ? error : error?.message) || "Unable to load your registration vehicle submission."}</p>
                    <Button size="sm" variant="outline" disabled={loading} onClick={() => loadMyPendingVehicles(LIST_PARAMS)} className="w-full shrink-0 sm:w-auto">Retry submission</Button>
                </div>
            )}
            {!error && <PendingVehicleGrid
                pendingVehicles={pendingVehicles}
                loading={loading}
            />}
        </div>
    );
};

export default OperatorPendingVehiclesPanel;
