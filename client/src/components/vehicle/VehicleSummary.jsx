import Badge from "../common/Badge";
import ImageThumbnail from "../common/ImageThumbnail";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

const VehicleSummary = ({
    vehicle,
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

    const vehicleType =
        vehicle.vehicleType ??
        "N/A";

    const category =
        vehicle.category?.name ??
        "Uncategorized";

    const year =
        vehicle.year ?? "—";

    const dailyTotalPrice =
        (Number(vehicle.pricing?.dailyRate) || 0) +
        (Number(vehicle.pricing?.reservationFee) || 0);

    return (
        <div className="flex w-full items-center gap-4">
            <ImageThumbnail
                src={image}
                alt={vehicleName}
                size="lg"
            />

            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
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
                </div>

                <p className="mt-1 text-sm font-medium text-gray-600 dark:text-gray-300">
                    {vehicleCode}
                </p>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {year} • {vehicleType} • {category}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusChip
                        status={
                            vehicle.status
                        }
                    />

                    {vehicle.isFeatured && (
                        <Badge
                            variant="success"
                            size="sm"
                        >
                            Recommended
                        </Badge>
                    )}
                </div>
            </div>

            <div className="flex flex-col items-end">
                <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Daily Total Price
                </span>

                <Price
                    value={dailyTotalPrice}
                    className="text-xl font-bold text-blue-600 dark:text-blue-400"
                />
            </div>
        </div>
    );
};

export default VehicleSummary;
