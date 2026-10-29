import {
    Archive,
    RotateCcw,
    AlertTriangle,
    Info,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import StatusChip from "../common/StatusChip";

const VehicleArchiveDialog = ({
    isOpen,
    mode = "archive",
    vehicle,
    loading = false,
    onClose,
    onConfirm,
}) => {
    if (!vehicle) {
        return null;
    }

    const isArchive =
        mode === "archive";

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            closeOnOverlayClick={!loading}
            closeOnEscape={!loading}
            size="sm"
            title={
                <div className="flex items-center gap-3">
                    <div
                        className={`
                            flex
                            h-11
                            w-11
                            items-center
                            justify-center
                            rounded-full
                            ${
                                isArchive
                                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                                    : "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                            }
                        `}
                    >
                        {isArchive ? (
                            <Archive size={22} />
                        ) : (
                            <RotateCcw size={22} />
                        )}
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {isArchive
                                ? "Archive Vehicle"
                                : "Restore Vehicle"}
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Please confirm your action.
                        </p>
                    </div>
                </div>
            }
            footer={
                <>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button
                        variant={
                            isArchive
                                ? "danger"
                                : "primary"
                        }
                        onClick={onConfirm}
                        loading={loading}
                    >
                        {isArchive
                            ? "Archive Vehicle"
                            : "Restore Vehicle"}
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-800/40">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {vehicle.brand} {vehicle.model}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        Vehicle Code:{" "}
                        {vehicle.vehicleCode}
                    </p>

                    <div className="mt-4">
                        <StatusChip
                            status={vehicle.status}
                        />
                    </div>
                </div>

                <div
                    className={`
                        flex
                        gap-3
                        rounded-xl
                        border
                        p-4
                        ${
                            isArchive
                                ? `
                                    border-amber-200
                                    bg-amber-50
                                    dark:border-amber-900/50
                                    dark:bg-amber-950/30
                                `
                                : `
                                    border-blue-200
                                    bg-blue-50
                                    dark:border-blue-900/50
                                    dark:bg-blue-950/30
                                `
                        }
                    `}
                >
                    {isArchive ? (
                        <AlertTriangle
                            className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                            size={20}
                        />
                    ) : (
                        <Info
                            className="mt-0.5 shrink-0 text-blue-600 dark:text-blue-400"
                            size={20}
                        />
                    )}

                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                            {isArchive
                                ? "This vehicle will be archived."
                                : "This vehicle will be restored."}
                        </p>

                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            {isArchive
                                ? "The vehicle will no longer appear in the Active Vehicles list. You can restore it at any time from the Archived Vehicles tab."
                                : "The vehicle will immediately become available again in the Active Vehicles list."}
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VehicleArchiveDialog;