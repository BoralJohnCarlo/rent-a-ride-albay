import {
    Trash2,
    AlertTriangle,
} from "lucide-react";

import Modal from "../common/Modal";
import Button from "../common/Button";
import Badge from "../common/Badge";

const VehicleCategoryDeleteDialog = ({
    isOpen,
    category,
    loading = false,
    onClose,
    onConfirm,
}) => {
    if (!category) {
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
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        <Trash2 size={22} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Delete Vehicle Category
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
                        variant="danger"
                        onClick={onConfirm}
                        loading={loading}
                    >
                        Delete Category
                    </Button>
                </>
            }
        >
            <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-800/40">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {category.name}
                    </h3>

                    <div className="mt-4">
                        <Badge
                            variant="secondary"
                            size="sm"
                        >
                            {category.vehicleType}
                        </Badge>
                    </div>
                </div>

                <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                    <AlertTriangle
                        className="mt-0.5 shrink-0 text-red-600 dark:text-red-400"
                        size={20}
                    />

                    <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                            This category will be permanently deleted.
                        </p>

                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            This action cannot be undone. Categories assigned to one or more vehicles cannot be deleted.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default VehicleCategoryDeleteDialog;