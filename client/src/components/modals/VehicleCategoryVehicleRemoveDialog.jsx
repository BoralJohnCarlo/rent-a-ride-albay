import {
    Trash2,
    AlertTriangle,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import StatusChip from "../common/StatusChip";

const VehicleCategoryVehicleRemoveDialog = ({
    isOpen,
    vehicle,
    category,
    loading = false,
    onClose,
    onConfirm,
}) => {
    if (!vehicle || !category) {
        return null;
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={loading ? undefined : onClose}
            closeOnOverlayClick={!loading}
            closeOnEscape={!loading}
            size="sm"
            title={
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <Trash2 size={22} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Remove Vehicle
                        </h2>

                        <p className="text-sm text-gray-500">
                            Remove this vehicle from the selected category.
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
                        variant="danger"
                        onClick={onConfirm}
                        loading={loading}
                    >
                        Remove
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {vehicle.brand} {vehicle.model}
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                        Vehicle Code: {vehicle.vehicleCode}
                    </p>

                    <div className="mt-4">
                        <StatusChip
                            status={vehicle.status}
                        />
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                    <p className="text-sm font-medium text-gray-500">
                        Current Category
                    </p>

                    <p className="mt-2 text-lg font-semibold text-gray-900">
                        {category.name}
                    </p>
                </div>

                <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertTriangle
                        className="mt-0.5 shrink-0 text-amber-600"
                        size={20}
                    />

                    <div>
                        <p className="font-medium text-gray-900">
                            This vehicle will be removed from this category.
                        </p>

                        <p className="mt-1 text-sm text-gray-600">
                            The vehicle will remain in the system and can be assigned to another category later.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VehicleCategoryVehicleRemoveDialog;