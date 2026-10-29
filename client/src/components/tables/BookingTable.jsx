import Badge from "../common/Badge";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

import DataTable from "./DataTable";
import TableActions from "./TableActions";

const BookingTable = ({
    bookings = [],
    loading = false,
    compact = false,
    showCustomer = true,
    showOperator = false,
    showActions = true,
    onView,
    onEdit,
    onCancel,
}) => {
    const columns = [];

    if (!compact) {
        columns.push({
            key: "bookingNumber",
            header: "Booking #",
            render: (booking) =>
                booking.bookingNumber || "—",
        });
    }

    columns.push({
        key: "vehicle",
        header: "Vehicle",
        render: (booking) => (
            <div>
                <p className="font-medium">
                    {booking.vehicle
                        ? `${booking.vehicle.brand} ${booking.vehicle.model}`
                        : "Unknown Vehicle"}
                </p>

                {!compact && (
                    <p className="text-sm text-gray-500">
                        {booking.vehicle?.plateNumber ||
                            "No Plate Number"}
                    </p>
                )}
            </div>
        ),
    });

    if (showCustomer) {
        columns.push({
            key: "customer",
            header: "Customer",
            render: (booking) => {
                const customer = booking.customer;

                if (!customer) {
                    return "—";
                }

                return (
                    customer.fullName ||
                    `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim()
                );
            },
        });
    }

    if (showOperator && !compact) {
        columns.push({
            key: "operator",
            header: "Operator",
            render: (booking) => {
                const operator = booking.operator;

                if (!operator) {
                    return "—";
                }

                return (
                    operator.businessName ||
                    operator.name ||
                    "—"
                );
            },
        });
    }

    columns.push({
        key: "rentalPeriod",
        header: "Rental Period",
        render: (booking) => (
            <div>
                <p>
                    {booking.startDate
                        ? new Date(
                              booking.startDate
                          ).toLocaleDateString()
                        : "—"}
                </p>

                {!compact && (
                    <p className="text-sm text-gray-500">
                        {booking.endDate
                            ? new Date(
                                  booking.endDate
                              ).toLocaleDateString()
                            : "—"}
                    </p>
                )}
            </div>
        ),
    });

    if (!compact) {
        columns.push({
            key: "totalAmount",
            header: "Total",
            align: "right",
            render: (booking) => (
                <Price value={booking.totalAmount} />
            ),
        });

        columns.push({
            key: "paymentMethod",
            header: "Payment",
            align: "center",
            render: (booking) => (
                <Badge
                    variant="secondary"
                    size="sm"
                >
                    {booking.paymentMethod || "N/A"}
                </Badge>
            ),
        });
    }

    columns.push({
        key: "status",
        header: "Status",
        align: "center",
        render: (booking) => (
            <StatusChip
                status={booking.status}
            />
        ),
    });

    if (showActions) {
        columns.push({
            key: "actions",
            header: "Actions",
            align: "right",
            cellClassName: "min-w-[220px]",
            render: (booking) => (
                <TableActions
                    actions={[
                        {
                            label: "View",
                            variant: "outline",
                            onClick: () =>
                                onView?.(booking),
                        },
                        {
                            label: "Edit",
                            onClick: () =>
                                onEdit?.(booking),
                        },
                        {
                            label: "Cancel",
                            variant: "danger",
                            disabled: [
                                "completed",
                                "cancelled",
                            ].includes(
                                booking.status?.toLowerCase()
                            ),
                            onClick: () =>
                                onCancel?.(booking),
                        },
                    ]}
                />
            ),
        });
    }

    return (
        <DataTable
            columns={columns}
            data={bookings}
            loading={loading}
            compact={compact}
            caption="Booking management table"
            emptyMessage="No bookings match the current search."
        />
    );
};

export default BookingTable;