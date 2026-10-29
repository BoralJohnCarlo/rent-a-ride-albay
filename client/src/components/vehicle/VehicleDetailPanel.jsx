import Button from "../common/Button";
import ImageThumbnail from "../common/ImageThumbnail";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

import CardDetailPanel from "../cards/CardDetailPanel";
import CardSection from "../cards/CardSection";

import getVehicleCardData from "../../utils/getVehicleCardData";

const DetailRow = ({
    label,
    value,
}) => (
    <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">
            {label}
        </span>

        <span className="text-sm font-medium text-gray-900 text-right dark:text-white">
            {value ?? "—"}
        </span>
    </div>
);

const VehicleDetailPanel = ({
    vehicle,
    onView,
    onEdit,
    onDelete,
}) => {
    const item =
        getVehicleCardData(vehicle);

    return (
        <CardDetailPanel
            header={
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                    <ImageThumbnail
                        src={item.image}
                        alt={item.name}
                        size="xl"
                    />

                    <div className="flex-1">
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {item.name}
                        </h2>

                        <p className="mt-1 text-gray-500 dark:text-gray-400">
                            {item.vehicleType}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-3">
                            <StatusChip
                                status={item.status}
                            />

                            <Price
                                value={Number(item.dailyRate) + Number(item.reservationFee || 0)}
                                className="text-lg font-bold"
                            />
                        </div>
                    </div>
                </div>
            }
            sections={
                <>
                    <CardSection title="Vehicle Information">
                        <DetailRow
                            label="Vehicle Code"
                            value={item.vehicleCode}
                        />

                        <DetailRow
                            label="Plate Number"
                            value={item.plateNumber}
                        />

                        <DetailRow
                            label="Category"
                            value={item.category}
                        />

                        <DetailRow
                            label="Year"
                            value={item.year}
                        />
                    </CardSection>

                    <CardSection title="Specifications">
                        <DetailRow
                            label="Transmission"
                            value={item.transmission}
                        />

                        <DetailRow
                            label="Fuel Type"
                            value={item.fuelType}
                        />

                        <DetailRow
                            label="Seats"
                            value={item.seatingCapacity}
                        />

                        <DetailRow
                            label="Color"
                            value={item.color}
                        />
                    </CardSection>

                    <CardSection title="Pricing">
                        <DetailRow
                            label="Daily Total Price"
                            value={`₱${(Number(item.dailyRate) || 0) + (Number(item.reservationFee) || 0)}/day`}
                        />

                        <DetailRow
                            label="Base Daily Rate"
                            value={`₱${item.dailyRate}`}
                        />

                        <DetailRow
                            label="Reservation Fee"
                            value={`₱${item.reservationFee}`}
                        />
                    </CardSection>

                    <CardSection title="Availability">
                        <DetailRow
                            label="Booking"
                            value={
                                item.bookingEnabled
                                    ? "Enabled"
                                    : "Disabled"
                            }
                        />

                        <DetailRow
                            label="Featured"
                            value={
                                item.featured
                                    ? "Yes"
                                    : "No"
                            }
                        />

                        <DetailRow
                            label="Status"
                            value={item.status}
                        />
                    </CardSection>
                </>
            }
            footer={
                <div className="flex flex-wrap justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() =>
                            onView?.(vehicle)
                        }
                    >
                        View
                    </Button>

                    <Button
                        onClick={() =>
                            onEdit?.(vehicle)
                        }
                    >
                        Edit
                    </Button>

                    <Button
                        variant="danger"
                        onClick={() =>
                            onDelete?.(vehicle)
                        }
                    >
                        Delete
                    </Button>
                </div>
            }
        />
    );
};

export default VehicleDetailPanel;
