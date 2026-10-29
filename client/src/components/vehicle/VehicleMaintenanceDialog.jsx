import { useEffect, useState } from "react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import ConfirmDialog from "../common/ConfirmDialog";

import MaintenancePlanFields from "./MaintenancePlanFields";
import {
    EMPTY_MAINTENANCE_PLAN,
    toMaintenancePayload,
    validateMaintenancePlan,
} from "../../utils/maintenancePlan";

import MaintenanceConflictConfirmDialog from "./MaintenanceConflictConfirmDialog";

import {
    endVehicleMaintenance,
    previewVehicleMaintenance,
    setVehicleMaintenance,
} from "../../api/vehicleApi";
import {
    describeMaintenanceMode,
    getVehicleMaintenanceWindow,
    VEHICLE_MAINTENANCE_MODE,
} from "../../constants/vehicleConstants";
import useToast from "../../hooks/toast/useToast";

const vehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") || "Vehicle";

/*
 * Admin: put a vehicle under maintenance now (turnaround, a number of days,
 * or off road), change it, or put it back in service. The vehicle stays
 * listed throughout; only the maintenance window is unbookable, and the
 * bookings inside it are flagged as maintenance conflicts.
 *
 * `initialMode` preselects a maintenance type (the Vehicles page's off-road
 * button opens it on "Off road").
 */
const VehicleMaintenanceDialog = ({
    isOpen,
    onClose,
    vehicle,
    onDone,
    initialMode = null,
}) => {
    const toast = useToast();

    const [plan, setPlan] = useState(EMPTY_MAINTENANCE_PLAN);
    const [editing, setEditing] = useState(false);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);
    const [conflictPreview, setConflictPreview] = useState(null);

    const maintenanceWindow = getVehicleMaintenanceWindow(vehicle);

    useEffect(() => {
        if (isOpen) {
            setPlan({
                ...EMPTY_MAINTENANCE_PLAN,
                ...(initialMode ? { mode: initialMode } : {}),
            });
            setEditing(false);
            setError("");
            setConflictPreview(null);
        }
    }, [isOpen, vehicle?._id, initialMode]);

    const showForm = !maintenanceWindow || editing;

    /* Saves the plan; returns the bookings it flagged. */
    const applyMaintenance = async () => {
        const response = await setVehicleMaintenance(
            vehicle._id,
            toMaintenancePayload(plan)
        );

        toast.success(
            maintenanceWindow
                ? "Maintenance updated."
                : "Vehicle is under maintenance.",
            "Maintenance set"
        );

        return response?.data?.conflicts ?? [];
    };

    const finishConflicts = () => {
        setConflictPreview(null);
        onDone?.();
        onClose?.();
    };

    /*
     * Bookings in the way get their own confirmation step, where the admin
     * decides what each customer hears; otherwise it's saved straight away.
     */
    const save = async () => {
        const planError = validateMaintenancePlan(plan);

        if (planError) {
            setError(planError);
            return;
        }

        setSaving(true);
        setError("");

        try {
            const preview = await previewVehicleMaintenance(
                vehicle._id,
                toMaintenancePayload(plan)
            );

            if (preview?.data?.conflicts?.length) {
                setConflictPreview(preview.data);
                return;
            }

            const conflicts = await applyMaintenance();

            if (conflicts.length > 0) {
                // Booked between the check and the save.
                toast.warning(
                    `${conflicts.length} booking${
                        conflicts.length === 1 ? "" : "s"
                    } overlap this maintenance. Go to Bookings → Maintenance conflicts to send the customers their options.`,
                    "Bookings affected"
                );
            }

            onDone?.();
            onClose?.();
        } catch (saveError) {
            setError(
                saveError?.response?.data?.message ||
                    "Couldn't set maintenance."
            );
        } finally {
            setSaving(false);
        }
    };

    const endNow = async () => {
        setSaving(true);

        try {
            await endVehicleMaintenance(vehicle._id);
            toast.success(
                `${vehicleName(vehicle)} is back in service and bookable again.`,
                "Back in service"
            );
            setConfirmEnd(false);
            onDone?.();
            onClose?.();
        } catch (endError) {
            setConfirmEnd(false);
            setError(
                endError?.response?.data?.message ||
                    "Couldn't end maintenance."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen && !confirmEnd && !conflictPreview}
                onClose={saving ? undefined : onClose}
                title={`Maintenance · ${vehicleName(vehicle)}`}
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Close
                        </Button>
                        {maintenanceWindow && !editing && (
                            <>
                                <Button
                                    variant="outline"
                                    onClick={() => setEditing(true)}
                                    disabled={saving}
                                >
                                    Change
                                </Button>
                                <Button
                                    variant="success"
                                    onClick={() => setConfirmEnd(true)}
                                    disabled={saving}
                                >
                                    Back in service now
                                </Button>
                            </>
                        )}
                        {showForm && (
                            <Button onClick={save} loading={saving}>
                                {maintenanceWindow
                                    ? "Update maintenance"
                                    : plan.mode ===
                                        VEHICLE_MAINTENANCE_MODE.OFF_ROAD
                                      ? "Take off road"
                                      : "Put under maintenance"}
                            </Button>
                        )}
                    </>
                }
            >
                <div className="space-y-4">
                    {maintenanceWindow && (
                        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                            <p className="font-semibold">
                                {describeMaintenanceMode(
                                    maintenanceWindow.mode,
                                    vehicle?.maintenance?.days
                                )}
                            </p>
                            <p className="mt-1">
                                {maintenanceWindow.until
                                    ? `Unbookable until ${new Date(
                                          maintenanceWindow.until
                                      ).toLocaleString("en-PH", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                      })}; it goes back in service on its own after that.`
                                    : "No end date — it stays unbookable until you put it back in service."}
                            </p>
                            {vehicle?.maintenance?.reason && (
                                <p className="mt-1 text-xs">
                                    Note: {vehicle.maintenance.reason}
                                </p>
                            )}
                        </div>
                    )}

                    {showForm && (
                        <>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                {maintenanceWindow
                                    ? "Replace the current maintenance, counted from now."
                                    : "Starts now. Only the maintenance period can't be booked; whether an off-road vehicle stays listed is set in Settings → Bookings."}
                            </p>
                            <MaintenancePlanFields
                                vehicleId={vehicle?._id}
                                value={plan}
                                onChange={setPlan}
                                conflictFollowUp="Next, you'll choose for each one: notify the customer with their options (another vehicle or a full refund), refund now, or decide later."
                            />
                        </>
                    )}

                    {error && (
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {error}
                        </p>
                    )}
                </div>
            </Modal>

            <MaintenanceConflictConfirmDialog
                isOpen={isOpen && Boolean(conflictPreview)}
                onBack={() => setConflictPreview(null)}
                onFinished={finishConflicts}
                vehicle={vehicle}
                mode={plan.mode}
                preview={conflictPreview}
                applyMaintenance={applyMaintenance}
            />

            <ConfirmDialog
                isOpen={confirmEnd}
                onClose={() => !saving && setConfirmEnd(false)}
                onConfirm={endNow}
                loading={saving}
                confirmVariant="success"
                title="Put the vehicle back in service?"
                message="All dates become bookable again. Bookings flagged by this maintenance that no longer clash go ahead as booked, and customers already asked to choose are told their booking stands."
                confirmText="Back in service"
            />
        </>
    );
};

export default VehicleMaintenanceDialog;
