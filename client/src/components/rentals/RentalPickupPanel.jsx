import {
    CalendarClock,
    CheckCircle2,
    MapPin,
    PlayCircle,
} from "lucide-react";

import Button from "../common/Button";

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

const getPickupLocation = (rental) => {
    return (
        rental?.booking?.pickupLocation?.address ||
        rental?.pickupLocation?.address ||
        "Not recorded"
    );
};

/* `pickup.date` is the actual field on the Rental schema (server/models/Rental.js) —
   it's set once processRental/createRental records the hand-over. */
const getPickupDate = (rental) => {
    return rental?.pickup?.date ?? null;
};

const RentalPickupPanel = ({
    rental,
    onPickup,
    loading = false,
    disabled = false,
}) => {
    const pickupDate = getPickupDate(rental);
    const pickupLocation =
        getPickupLocation(rental);

    const isPickedUp = Boolean(pickupDate);

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div
                        className={[
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            isPickedUp
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
                        ].join(" ")}
                    >
                        {isPickedUp ? (
                            <CheckCircle2
                                size={19}
                            />
                        ) : (
                            <PlayCircle
                                size={19}
                            />
                        )}
                    </div>

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Pickup
                        </p>

                        <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                            {isPickedUp
                                ? "Vehicle Picked Up"
                                : "Vehicle Pickup"}
                        </h3>
                    </div>
                </div>

                {!isPickedUp && (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                            onPickup?.(rental)
                        }
                        loading={loading}
                        disabled={disabled}
                    >
                        Start Pickup
                    </Button>
                )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
                    <div className="flex items-center gap-2">
                        <CalendarClock
                            size={16}
                            className="text-gray-400"
                        />

                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Pickup Time
                        </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {formatDateTime(
                            pickupDate
                        )}
                    </p>
                </div>

                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
                    <div className="flex items-center gap-2">
                        <MapPin
                            size={16}
                            className="text-gray-400"
                        />

                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Pickup Location
                        </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {pickupLocation}
                    </p>
                </div>
            </div>
        </section>
    );
};

export default RentalPickupPanel;