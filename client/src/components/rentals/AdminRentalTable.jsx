import {
    CalendarDays,
    CarFront,
    Clock3,
    UserRound,
} from "lucide-react";

import StatusChip from "../common/StatusChip";
import RentalTableActions from "../rentals/RentalTableActions";

import DataTable from "../tables/DataTable";

const formatDate = (value) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const formatDateRange = (
    startDate,
    endDate
) => {
    if (!startDate || !endDate) {
        return "—";
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return "—";
    }

    return `${start.toLocaleDateString(
        "en-PH",
        {
            month: "short",
            day: "numeric",
        }
    )} – ${end.toLocaleDateString(
        "en-PH",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
        }
    )}`;
};

const formatAmount = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString(
        "en-PH",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }
    )}`;
};

const getCustomerName = (customer) => {
    if (!customer) {
        return "—";
    }

    const fullName = [
        customer.firstName,
        customer.lastName,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        customer.fullName ||
        fullName ||
        customer.name ||
        customer.email ||
        "—"
    );
};

const getVehicleName = (vehicle) => {
    if (!vehicle) {
        return "—";
    }

    const name = [
        vehicle.brand,
        vehicle.model,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        name ||
        vehicle.name ||
        vehicle.vehicleCode ||
        "—"
    );
};

const getDriverName = (driver) => {
    if (!driver) {
        return "No driver";
    }

    const fullName = [
        driver.firstName,
        driver.lastName,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        driver.fullName ||
        fullName ||
        driver.name ||
        driver.driverCode ||
        "Assigned Driver"
    );
};

const AdminRentalTable = ({
    rentals = [],
    loading = false,
    leavingRowId = null,
    compact = false,
    onView,
    onPickup,
    onReturn,
    onReassignDriver,
    onDamageIssue,
    onCharge,
    onAdjustment,
    onPayment,
    onVerifyPayment,
    onSecurityDeposit,
    onVehicleOutcome,
    onComplete,
    onWaivePenalty,
    onAdjustPenalty,
    onAddPenaltyNote,
    onRefund,
}) => {
    const columns = [
        {
            key: "rental",
            label: "Rental",
            width: "w-[14%]",
            render: (rental) => (
                <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white">
                        {rental.rentalCode ||
                            "—"}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(
                            rental.createdAt
                        )}
                    </p>
                </div>
            ),
        },

        {
            key: "customer",
            label: "Customer",
            width: "w-[17%]",
            render: (rental) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <UserRound
                            size={17}
                        />
                    </div>

                    <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900 dark:text-white">
                            {getCustomerName(
                                rental.customer
                            )}
                        </p>

                        {rental.customer
                            ?.email && (
                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {
                                    rental
                                        .customer
                                        .email
                                }
                            </p>
                        )}
                    </div>
                </div>
            ),
        },

        {
            key: "vehicle",
            label: "Vehicle",
            width: "w-[18%]",
            render: (rental) => (
                <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <CarFront
                            size={17}
                        />
                    </div>

                    <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900 dark:text-white">
                            {getVehicleName(
                                rental.vehicle
                            )}
                        </p>

                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {rental.vehicle
                                ?.vehicleCode ||
                                rental.vehicle
                                    ?.plateNumber ||
                                "—"}
                        </p>
                    </div>
                </div>
            ),
        },

        {
            key: "dates",
            label: "Rental Period",
            width: "w-[16%]",
            render: (rental) => (
                <div className="flex items-center gap-2">
                    <CalendarDays
                        size={16}
                        className="shrink-0 text-gray-400"
                    />

                    <span className="whitespace-nowrap text-sm text-gray-700 dark:text-gray-200">
                        {formatDateRange(
                            rental.startDate,
                            rental.endDate
                        )}
                    </span>
                </div>
            ),
        },

        {
            key: "driver",
            label: "Driver",
            width: "w-[12%]",
            render: (rental) => (
                <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900 dark:text-white">
                        {getDriverName(
                            rental.driver
                        )}
                    </p>

                    {rental.driver
                        ?.driverCode && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {
                                rental
                                    .driver
                                    .driverCode
                            }
                        </p>
                    )}
                </div>
            ),
        },

        {
            key: "amount",
            label: "Amount",
            width: "w-[10%]",
            align: "right",
            render: (rental) => (
                <div className="text-right">
                    <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">
                        {formatAmount(
                            rental.financial
                                ?.finalAmount ??
                                rental.financial
                                    ?.totalAmount ??
                                rental.totalAmount
                        )}
                    </p>

                    {typeof rental
                        .financial
                        ?.balance ===
                        "number" && (
                        <p className="mt-0.5 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                            Balance{" "}
                            {formatAmount(
                                rental
                                    .financial
                                    .balance
                            )}
                        </p>
                    )}
                </div>
            ),
        },

        {
            key: "status",
            label: "Status",
            width: "w-[11%]",
            render: (rental) => (
                <div className="flex items-center gap-2">
                    <StatusChip
                        status={
                            rental.status ||
                            "Unknown"
                        }
                        size="sm"
                    />

                    {(rental.lateReturn
                        ?.lateDurationMinutes ?? 0) >
                        0 && (
                        <span
                            className="
                                inline-flex
                                items-center
                                gap-1
                                rounded-full
                                bg-red-100
                                px-2
                                py-0.5
                                text-xs
                                font-semibold
                                text-red-700
                                dark:bg-red-900/40
                                dark:text-red-300
                            "
                        >
                            <Clock3
                                size={12}
                            />

                            {(rental.lateReturn
                                ?.amount ?? 0) > 0
                                ? "Late"
                                : "Late · Waived"}
                        </span>
                    )}
                </div>
            ),
        },

        {
            key: "actions",
            label: "",
            width: "w-[18%]",
            align: "right",
            render: (rental) => (
                <RentalTableActions
                    rental={rental}
                    onView={onView}
                    onPickup={onPickup}
                    onReturn={onReturn}
                    onReassignDriver={
                        onReassignDriver
                    }
                    onDamageIssue={
                        onDamageIssue
                    }
                    onCharge={onCharge}
                    onAdjustment={
                        onAdjustment
                    }
                    onPayment={onPayment}
                    onVerifyPayment={
                        onVerifyPayment
                    }
                    onSecurityDeposit={
                        onSecurityDeposit
                    }
                    onVehicleOutcome={
                        onVehicleOutcome
                    }
                    onComplete={onComplete}
                    onWaivePenalty={
                        onWaivePenalty
                    }
                    onAdjustPenalty={
                        onAdjustPenalty
                    }
                    onAddPenaltyNote={
                        onAddPenaltyNote
                    }
                    onRefund={onRefund}
                    loading={loading}
                />
            ),
        },
    ];

    return (
        <DataTable
            columns={columns}
            data={rentals}
            loading={loading}
            compact={compact}
            caption="Rental management table"
            emptyMessage="No rentals match the current search."
            leavingRowId={leavingRowId}
            getRowId={(rental) =>
                rental._id ??
                rental.rentalCode
            }
        />
    );
};

export default AdminRentalTable;