import {
    CalendarDays,
    Clock3,
    MapPin,
    UserRound,
} from "lucide-react";

import RentalCustomerSummary from "./RentalCustomerSummary";
import RentalVehicleSummary from "./RentalVehicleSummary";
import RentalFinancialSummary from "./RentalFinancialSummary";

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
        <div className="rounded-xl bg-white px-4 py-3 dark:bg-gray-900">
            <div className="flex items-center gap-2">
                <Icon
                    size={15}
                    className="shrink-0 text-gray-400"
                />

                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {label}
                </span>
            </div>

            <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                {value || "Not recorded"}
            </p>
        </div>
    );
};

const RentalTableDetails = ({
    rental,
}) => {
    if (!rental) {
        return null;
    }

    const booking =
        rental.booking || {};

    const customer =
        rental.customer ||
        booking.customer;

    const vehicle =
        rental.vehicle ||
        booking.vehicle;

    const driver =
        rental.driver ||
        booking.driver;

    const startDate =
        rental.startDate ||
        booking.startDate;

    const endDate =
        rental.endDate ||
        booking.endDate;

    const pickupLocation =
        rental.pickupLocation ||
        booking.pickupLocation;

    const returnLocation =
        rental.returnLocation ||
        booking.returnLocation;

    return (
        <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DetailItem
                    icon={CalendarDays}
                    label="Start"
                    value={formatDateTime(
                        startDate
                    )}
                />

                <DetailItem
                    icon={Clock3}
                    label="End"
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

                <DetailItem
                    icon={MapPin}
                    label="Pickup"
                    value={
                        pickupLocation?.address ||
                        "Not recorded"
                    }
                />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <DetailItem
                    icon={MapPin}
                    label="Return Location"
                    value={
                        returnLocation?.address ||
                        "Not recorded"
                    }
                />

                <DetailItem
                    icon={Clock3}
                    label="Created"
                    value={formatDateTime(
                        rental.createdAt
                    )}
                />
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
                <RentalCustomerSummary
                    customer={customer}
                />

                <RentalVehicleSummary
                    vehicle={vehicle}
                    vehicleOutcome={
                        rental.vehicleOutcome
                    }
                />
            </div>

            <RentalFinancialSummary
                rental={rental}
            />
        </div>
    );
};

export default RentalTableDetails;