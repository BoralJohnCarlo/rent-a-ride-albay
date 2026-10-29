import {
    Eye,
    Pencil,
    X,
} from "lucide-react";

import Badge from "../common/Badge";
import Price from "../common/Price";
import StatusChip from "../common/StatusChip";

import DataTable from "./DataTable";

const BookingTable = ({
    bookings = [],
    loading = false,
    compact = false,
    showCustomer = true,
    showOperator = false,
    showRentalStatus = false,
    showActions = true,
    viewOnly = false,
    onView,
    onEdit,
    onCancel,
}) => {
    const columns = [];

    if (!compact) {
        columns.push({
            key: "bookingNumber",
            header: "Booking #",
            cellClassName:
                "w-[85px] min-w-[85px] whitespace-nowrap px-2.5 py-2",
            render: (booking) => (
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    {booking.bookingNumber || "—"}
                </span>
            ),
        });
    }

    columns.push({
        key: "vehicle",
        header: "Vehicle",
        cellClassName:
            "min-w-[135px] max-w-[190px] px-2.5 py-2",
        render: (booking) => (
            <div className="min-w-0 leading-tight">
                <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {booking.vehicle
                        ? `${booking.vehicle.brand} ${booking.vehicle.model}`
                        : "Unknown Vehicle"}
                </p>

                {!compact && (
                    <p className="mt-0.5 truncate text-[11px] text-gray-500 dark:text-gray-400">
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
            cellClassName:
                "min-w-[105px] max-w-[160px] px-2.5 py-2",
            render: (booking) => {
                const customer = booking.customer;

                if (!customer) {
                    return (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            —
                        </span>
                    );
                }

                const customerName =
                    customer.fullName ||
                    `${customer.firstName ?? ""} ${
                        customer.lastName ?? ""
                    }`.trim();

                return (
                    <span className="block truncate text-xs text-gray-700 dark:text-gray-200">
                        {customerName || "—"}
                    </span>
                );
            },
        });
    }

    if (showOperator && !compact) {
        columns.push({
            key: "operator",
            header: "Partner",
            cellClassName:
                "min-w-[105px] max-w-[160px] px-2.5 py-2",
            render: (booking) => {
                const operator = booking.operator;

                if (!operator) {
                    return (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                            —
                        </span>
                    );
                }

                return (
                    <span className="block truncate text-xs text-gray-700 dark:text-gray-200">
                        {operator.businessName ||
                            operator.name ||
                            "—"}
                    </span>
                );
            },
        });
    }

    columns.push({
        key: "rentalPeriod",
        header: "Rental Period",
        cellClassName:
            "w-[125px] min-w-[125px] whitespace-nowrap px-2.5 py-2",
        render: (booking) => (
            <div className="text-xs leading-tight">
                <p className="text-gray-700 dark:text-gray-200">
                    {booking.startDate
                        ? new Date(
                              booking.startDate,
                          ).toLocaleDateString()
                        : "—"}
                </p>

                {!compact && (
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {booking.endDate
                            ? new Date(
                                  booking.endDate,
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
            cellClassName:
                "w-[105px] min-w-[105px] whitespace-nowrap px-2.5 py-2",
            render: (booking) => (
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    <Price value={booking.totalAmount} />
                </span>
            ),
        });

        columns.push({
            key: "paymentMethod",
            header: "Payment",
            align: "center",
            cellClassName:
                "w-[85px] min-w-[85px] whitespace-nowrap px-2.5 py-2",
            render: (booking) => (
                <Badge
                    variant="secondary"
                    size="sm"
                >
                    <span className="text-[11px]">
                        {booking.paymentMethod || "N/A"}
                    </span>
                </Badge>
            ),
        });
    }

    columns.push({
        key: "status",
        header: "Status",
        align: "center",
        cellClassName:
            "w-[105px] min-w-[105px] whitespace-nowrap px-2.5 py-2",
        render: (booking) => (
            <div className="inline-flex">
                <StatusChip status={booking.status} />
            </div>
        ),
    });

    if (showRentalStatus && !compact) {
        columns.push({
            key: "rentalStatus",
            header: "Rental",
            align: "center",
            cellClassName:
                "w-[105px] min-w-[105px] whitespace-nowrap px-2.5 py-2",
            render: (booking) =>
                booking.rental?.status ? (
                    <div className="inline-flex">
                        <StatusChip status={booking.rental.status} />
                    </div>
                ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        Not started
                    </span>
                ),
        });
    }

    if (showActions) {
        columns.push({
            key: "actions",
            header: viewOnly ? "View" : "Actions",
            align: "center",
            cellClassName: viewOnly
                ? "w-[52px] min-w-[52px] max-w-[52px] whitespace-nowrap px-1.5 py-2"
                : "w-[105px] min-w-[105px] max-w-[105px] whitespace-nowrap px-1.5 py-2",

            render: (booking) => {
                if (viewOnly) {
                    return (
                        <button
                            type="button"
                            onClick={() => onView?.(booking)}
                            title="View Booking"
                            aria-label={`View booking ${
                                booking.bookingNumber || ""
                            }`}
                            className="
                                inline-flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-blue-100
                                bg-blue-50
                                text-blue-600
                                transition-all
                                duration-200
                                hover:border-blue-200
                                hover:bg-blue-100
                                hover:text-blue-700
                                active:scale-95
                                focus:outline-none
                                focus:ring-2
                                focus:ring-blue-500/20
                                dark:border-blue-900/50
                                dark:bg-blue-950/40
                                dark:text-blue-400
                                dark:hover:bg-blue-900/50
                                dark:hover:text-blue-300
                            "
                        >
                            <Eye
                                size={16}
                                strokeWidth={2}
                            />
                        </button>
                    );
                }

                const isCancelDisabled = [
                    "completed",
                    "cancelled",
                ].includes(
                    booking.status?.toLowerCase(),
                );

                return (
                    <div className="flex items-center justify-center gap-0.5">
                        {/* View */}
                        <button
                            type="button"
                            onClick={() => onView?.(booking)}
                            title="View Booking"
                            aria-label={`View booking ${
                                booking.bookingNumber || ""
                            }`}
                            className="
                                inline-flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-blue-100
                                bg-blue-50
                                text-blue-600
                                transition-all
                                duration-200
                                hover:border-blue-200
                                hover:bg-blue-100
                                hover:text-blue-700
                                active:scale-95
                                focus:outline-none
                                focus:ring-2
                                focus:ring-blue-500/20
                                dark:border-blue-900/50
                                dark:bg-blue-950/40
                                dark:text-blue-400
                                dark:hover:bg-blue-900/50
                                dark:hover:text-blue-300
                            "
                        >
                            <Eye
                                size={15}
                                strokeWidth={2}
                            />
                        </button>

                        {/* Edit */}
                        <button
                            type="button"
                            onClick={() => onEdit?.(booking)}
                            title="Edit Booking"
                            aria-label={`Edit booking ${
                                booking.bookingNumber || ""
                            }`}
                            className="
                                inline-flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-amber-100
                                bg-amber-50
                                text-amber-600
                                transition-all
                                duration-200
                                hover:border-amber-200
                                hover:bg-amber-100
                                hover:text-amber-700
                                active:scale-95
                                focus:outline-none
                                focus:ring-2
                                focus:ring-amber-500/20
                                dark:border-amber-900/50
                                dark:bg-amber-950/40
                                dark:text-amber-400
                                dark:hover:bg-amber-900/50
                                dark:hover:text-amber-300
                            "
                        >
                            <Pencil
                                size={15}
                                strokeWidth={2}
                            />
                        </button>

                        {/* Cancel */}
                        <button
                            type="button"
                            onClick={() => onCancel?.(booking)}
                            disabled={isCancelDisabled}
                            title={
                                isCancelDisabled
                                    ? "Booking cannot be cancelled"
                                    : "Cancel Booking"
                            }
                            aria-label={`Cancel booking ${
                                booking.bookingNumber || ""
                            }`}
                            className="
                                inline-flex
                                h-8
                                w-8
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-red-100
                                bg-red-50
                                text-red-600
                                transition-all
                                duration-200
                                hover:border-red-200
                                hover:bg-red-100
                                hover:text-red-700
                                active:scale-95
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                                focus:outline-none
                                focus:ring-2
                                focus:ring-red-500/20
                                dark:border-red-900/50
                                dark:bg-red-950/40
                                dark:text-red-400
                                dark:hover:bg-red-900/50
                                dark:hover:text-red-300
                            "
                        >
                            <X
                                size={15}
                                strokeWidth={2}
                            />
                        </button>
                    </div>
                );
            },
        });
    }

    return (
        <div className="w-full min-w-0 overflow-x-auto">
            <DataTable
                columns={columns}
                data={bookings}
                loading={loading}
                compact={compact}
                caption="Booking management table"
                emptyMessage="No bookings match the current search."
            />
        </div>
    );
};

export default BookingTable;