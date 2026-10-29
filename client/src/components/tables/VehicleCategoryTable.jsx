import { useMemo } from "react";
import { Car, Trash2 } from "lucide-react";

import Badge from "../common/Badge";
import StatusChip from "../common/StatusChip";

import DataTable from "./DataTable";
import TableActions from "./TableActions";

import createTableActions from "../../utils/createTableActions";

const VehicleCategoryTable = ({
    vehicleCategories = [],
    loading = false,
    compact = false,
    showActions = true,
    onEdit,
    onDelete,
    onRemoveVehicle,
    onAssignVehicles,
}) => {
    const normalizeCategory = (
    category
) => ({
    name: category.name,

    vehicleType:
        category.vehicleType,

    status: category.status,
});

    

    const columns = useMemo(() => {
        const columns = [
            {
                key: "name",
                header: "Category",
                render: (category) => (
                    /* The description wraps (max two lines, capped width)
                       instead of `truncate`: a no-wrap line made this cell
                       as wide as the whole description and pushed the
                       other columns — Actions included — off screen. */
                    <div className="flex items-start gap-3 py-1">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                            <Car size={17} />
                        </div>
                        <div className="min-w-0 max-w-md">
                            <p className="font-medium text-gray-900 dark:text-white">
                                {
                                    normalizeCategory(
                                        category
                                    ).name
                                }
                            </p>
                            {category.description && (
                                <p
                                    className="mt-0.5 line-clamp-2 whitespace-normal text-xs leading-5 text-gray-500 dark:text-gray-400"
                                    title={category.description}
                                >
                                    {category.description}
                                </p>
                            )}
                        </div>
                    </div>
                ),
            },
        ];

        if (!compact) {
            columns.push(
                {
                    key: "vehicleType",
                    header: "Vehicle Type",
                    align: "center",
                    render: (
                        category
                    ) => (
                        <Badge
                            variant="secondary"
                            size="sm"
                        >
                            {
                                normalizeCategory(
                                    category
                                ).vehicleType
                            }
                        </Badge>
                    ),
                },
            );
        }

        columns.push(
            {
                key: "status",
                header: "Status",
                align: "center",
                render: (
                    category
                ) => (
                    <StatusChip
                        status={
                            normalizeCategory(
                                category
                            ).status
                        }
                    />
                ),
            },
        );

        columns.push({
            key: "vehicleCount",
            header: "Vehicles",
            align: "center",
            render: (category) => (
        <Badge
            variant="primary"
            size="sm"
        >
            {category.vehicles?.length ?? 0}
        </Badge>
    ),
});

        if (showActions) {
            columns.push({
                key: "actions",
                header: "Actions",
                align: "right",
                cellClassName:
                    "min-w-36",
                render: (
                    category
                ) => (
                
        <TableActions
    variant="icons"
    actions={createTableActions({
        item: category,
        onEdit,

        beforeArchiveActions: [
            {
                label: "Assign Vehicles",
                color: "gray",
                icon: Car,
                onClick: () =>
                    onAssignVehicles?.(
                        category
                    ),
            },
            {
                label: "Delete",
                variant: "danger",
                color: "red",
                icon: Trash2,
                onClick: () =>
                    onDelete?.(
                        category
                    ),
            },
        ],
    }).filter(
        (action) => action.label !== "View"
    )}
/>

        ),
    });
}

        return columns;
    }, [
        compact,
        showActions,
        onEdit,
        onDelete,
        onRemoveVehicle,
        onAssignVehicles,
    ]);

   return (
    <DataTable
        columns={columns}
        data={vehicleCategories}
        loading={loading}
        compact={compact}
        expandable
        renderDetails={(category) => (
            
    <div className="p-6">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Vehicles in this Category
        </h4>

    <div className="mt-4 space-y-3">
            {category.vehicles?.length ? (
                category.vehicles.map((vehicle) => (
                    <div
    key={vehicle._id}
    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
>
    <div>
        <p className="font-medium text-gray-900">
            {vehicle.brand} {vehicle.model}
        </p>

        <p className="mt-1 text-sm text-gray-500">
            {vehicle.vehicleCode} • {vehicle.plateNumber}
        </p>

                <div className="mt-3 flex flex-wrap gap-2">
                    <StatusChip
                    status={vehicle.status}
                />

                <Badge
                    variant="secondary"
                    size="sm"
                >
                {vehicle.condition}
                </Badge>
            </div>
        </div>

                <button
                    type="button"
                    onClick={() =>
                onRemoveVehicle?.(
                    vehicle,
                    category
                )
            }
        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
        Remove
                </button>
            </div>
                    
                ))
            ) : (
                <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                    No vehicles are currently assigned to this category.
                </div>
            )}
        </div>
    </div>
)}
        caption="Vehicle category management table"
        emptyMessage="No vehicle categories found."
    />
);
};

export default VehicleCategoryTable;