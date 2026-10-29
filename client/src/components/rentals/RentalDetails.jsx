import {
    CalendarDays,
    CarFront,
    Clock3,
    FileText,
    UserRound,
} from "lucide-react";

import StatusChip from "../common/StatusChip";

import RentalCustomerSummary from "./RentalCustomerSummary";
import RentalVehicleSummary from "./RentalVehicleSummary";
import RentalFinancialSummary from "./RentalFinancialSummary";
import RentalPickupPanel from "./RentalPickupPanel";
import RentalReturnPanel from "./RentalReturnPanel";
import PolicySourceNote from "../legal/PolicySourceNote";

const formatDateTime = (value) => {
    if (!value) {
        return "Not recorded";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not recorded";
    }

    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const formatAmount = (value) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getRentalCode = (rental) => {
    return (
        rental?.rentalCode ||
        rental?.code ||
        rental?._id ||
        "Rental"
    );
};

const getBookingCode = (rental) => {
    return (
        rental?.booking?.bookingCode ||
        rental?.bookingCode ||
        "Not linked"
    );
};

const getDriverName = (driver) => {
    if (!driver) {
        return "No driver assigned";
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
        driver.email ||
        "Assigned Driver"
    );
};

const DetailItem = ({
    icon: Icon,
    label,
    value,
}) => {
    return (
        <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
            <div className="flex items-center gap-2">
                <Icon
                    size={15}
                    className="shrink-0 text-gray-400"
                />

                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {label}
                </span>
            </div>

            <p className="mt-2 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                {value || "Not recorded"}
            </p>
        </div>
    );
};

const RentalDetails = ({
    rental,
    onPickup,
    onReturn,
    pickupLoading = false,
    returnLoading = false,
    pickupDisabled = false,
    returnDisabled = false,
}) => {
    if (!rental) {
        return (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <CarFront
                    size={28}
                    className="mx-auto text-gray-400"
                />

                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
                    Rental details are unavailable.
                </p>
            </div>
        );
    }

    const rentalCode =
        getRentalCode(rental);

    const bookingCode =
        getBookingCode(rental);

    const driver =
        rental.driver ||
        rental.booking?.driver ||
        null;

    const status =
        rental.status ||
        "Unknown";

    const startDate =
        rental.startDate ||
        rental.booking?.startDate ||
        null;

    const endDate =
        rental.endDate ||
        rental.booking?.endDate ||
        null;

    return (
        <div className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                                <FileText
                                    size={19}
                                />
                            </div>

                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                                    Rental
                                </p>

                                <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                                    {rentalCode}
                                </h2>
                            </div>
                        </div>
                    </div>

                    <StatusChip
                        status={status}
                        size="sm"
                    />
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DetailItem
                        icon={FileText}
                        label="Booking"
                        value={bookingCode}
                    />

                    <DetailItem
                        icon={CalendarDays}
                        label="Start"
                        value={formatDateTime(
                            startDate
                        )}
                    />

                    <DetailItem
                        icon={Clock3}
                        label="Due Back"
                        value={formatDateTime(
                            endDate
                        )}
                    />

                    <DetailItem
                        icon={UserRound}
                        label="Driver"
                        value={getDriverName(
                            driver
                        )}
                    />
                </div>

                {rental.createdAt && (
                    <p className="mt-4 text-xs text-gray-400">
                        Rental created{" "}
                        {formatDateTime(
                            rental.createdAt
                        )}
                    </p>
                )}
            </section>

            {(rental.lateReturn?.lateDurationMinutes ?? 0) > 0 && (
                <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-900/40 dark:bg-red-900/20">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                            <Clock3
                                size={19}
                            />
                        </div>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">
                                Penalty
                            </p>

                            <h3 className="text-base font-semibold text-red-800 dark:text-red-200">
                                Late Return
                                {(rental.lateReturn?.amount ?? 0) === 0
                                    ? " (Waived)"
                                    : ""}
                            </h3>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <DetailItem
                            icon={CalendarDays}
                            label="Expected Return"
                            value={formatDateTime(
                                rental.lateReturn
                                    .expectedReturnAt
                            )}
                        />

                        <DetailItem
                            icon={CalendarDays}
                            label="Actual Return"
                            value={formatDateTime(
                                rental.lateReturn
                                    .actualReturnAt
                            )}
                        />

                        <DetailItem
                            icon={Clock3}
                            label="Late Duration"
                            value={`${rental.lateReturn.lateDurationMinutes ?? 0} minutes`}
                        />

                        <DetailItem
                            icon={Clock3}
                            label="Charged Units"
                            value={`${rental.lateReturn.chargedUnits ?? 0} ${rental.lateReturn.chargingUnit?.toLowerCase() ?? "hour"}${rental.lateReturn.chargedUnits === 1 ? "" : "s"}`}
                        />
                    </div>

                    <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-white p-4 dark:border-red-800 dark:bg-gray-800">
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                            Late Return Penalty
                        </span>

                        <span className="text-lg font-bold text-red-700 dark:text-red-300">
                            {formatAmount(
                                rental.lateReturn.amount
                            )}
                        </span>
                    </div>

                    <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                        {rental.lateReturn.gracePeriodMinutes > 0 && (
                            <p>
                                Grace period: {rental.lateReturn.gracePeriodMinutes} minutes applied
                            </p>
                        )}

                        <p>
                            Rate: {formatAmount(rental.lateReturn.rate ?? 0)} per {rental.lateReturn.chargingUnit?.toLowerCase() ?? "hour"}
                            {rental.lateReturn.rateType ? ` (${rental.lateReturn.rateType})` : ""}
                        </p>

                        <p>
                            Calculation: {rental.lateReturn.chargedUnits ?? 0} {rental.lateReturn.chargingUnit?.toLowerCase() ?? "hour"}{(rental.lateReturn.chargedUnits ?? 0) === 1 ? "" : "s"} × {formatAmount(rental.lateReturn.rate ?? 0)} = {formatAmount(rental.lateReturn.amount)}
                        </p>

                        <PolicySourceNote
                            audience="admin"
                            source={rental.lateReturn.policySource}
                            version={rental.lateReturn.termsVersion}
                        />
                    </div>
                </section>
            )}

            <div className="grid gap-5 xl:grid-cols-2">
                <RentalCustomerSummary
                    customer={
                        rental.customer ||
                        rental.booking?.customer
                    }
                />

                <RentalVehicleSummary
                    vehicle={
                        rental.vehicle ||
                        rental.booking?.vehicle
                    }
                    vehicleOutcome={
                        rental.vehicleOutcome
                    }
                />
            </div>

            <RentalFinancialSummary
                rental={rental}
            />

            <RentalPickupPanel
                rental={rental}
                onPickup={onPickup}
                loading={pickupLoading}
                disabled={pickupDisabled}
            />

            <RentalReturnPanel
                rental={rental}
                onReturn={onReturn}
                loading={returnLoading}
                disabled={returnDisabled}
            />
        </div>
    );
};

export default RentalDetails;