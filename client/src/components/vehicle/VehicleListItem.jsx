import {
    ChevronDown,
    ChevronRight,
} from "lucide-react";

import Badge from "../common/Badge";
import ImageThumbnail from "../common/ImageThumbnail";

const VehicleListItem = ({
    vehicle,
    compact = false,
    // Admin fleet table: small thumbnail, code/year/category on one line.
    dense = false,
    expanded = false,
    expandable = false,
}) => {
    const image =
        vehicle.images?.find(
            (image) => image.isPrimary
        )?.url ??
        vehicle.images?.[0]?.url ??
        vehicle.images?.[0] ??
        null;

    const vehicleName = [
        vehicle.brand,
        vehicle.model,
    ]
        .filter(Boolean)
        .join(" ");

    const vehicleCode =
        vehicle.vehicleCode ??
        "N/A";

    const category =
        vehicle.category?.name ??
        "Uncategorized";

    const year =
        vehicle.year ?? "—";

    const ownership =
        vehicle.ownership ??
        "Company";

    const chevron =
        expandable &&
        (expanded ? (
            <ChevronDown
                size={dense ? 14 : 16}
                className="shrink-0 text-gray-500 dark:text-gray-400"
            />
        ) : (
            <ChevronRight
                size={dense ? 14 : 16}
                className="shrink-0 text-gray-500 dark:text-gray-400"
            />
        ));

    if (dense) {
        return (
            <div className="flex items-center gap-2.5">
                {chevron}

                <ImageThumbnail
                    src={image}
                    alt={vehicleName}
                    size="xs"
                />

                <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <h3 className="truncate text-[13px] font-semibold text-gray-900 dark:text-white">
                            {vehicleName}
                        </h3>

                        {vehicle.isFeatured && (
                            <Badge
                                variant="warning"
                                size="sm"
                                className="shrink-0"
                            >
                                Featured
                            </Badge>
                        )}

                        <Badge
                            variant={
                                ownership === "Company"
                                    ? "info"
                                    : "warning"
                            }
                            size="sm"
                            className="shrink-0"
                        >
                            {ownership}
                        </Badge>
                    </div>

                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-600 dark:text-gray-300">
                            {vehicleCode}
                        </span>
                        {" · "}
                        {year} · {category}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            {chevron}

            <ImageThumbnail
                src={image}
                alt={vehicleName}
                size={
                    compact ? "xs" : "sm"
                }
            />

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {vehicleName}
                    </h3>

                    {vehicle.isFeatured && (
                        <Badge
                            variant="warning"
                            size="sm"
                        >
                            Featured
                        </Badge>
                    )}

                    <Badge
                        variant={
                            ownership ===
                            "Company"
                                ? "info"
                                : "warning"
                        }
                        size="sm"
                    >
                        {ownership}
                    </Badge>
                </div>

                <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                    {vehicleCode}
                </p>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {year} • {category}
                </p>
            </div>
        </div>
    );
};

export default VehicleListItem;