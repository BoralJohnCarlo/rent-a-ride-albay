import {
    CalendarCheck2,
    CheckCircle2,
    MapPin,
    RotateCcw,
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

const getReturnLocation = (rental) => {
    return (
        rental?.booking?.returnLocation?.address ||
        rental?.returnLocation?.address ||
        "Not recorded"
    );
};

/* `return.date` is the actual field on the Rental schema (server/models/Rental.js) —
   it's set once processReturn records the hand-back. */
const getReturnDate = (rental) => {
    return rental?.return?.date ?? null;
};

const RentalReturnPanel = ({
    rental,
    onReturn,
    onVehicleOutcome,
    loading = false,
    disabled = false,
}) => {
    const returnDate = getReturnDate(rental);
    const returnLocation =
        getReturnLocation(rental);

    const isReturned = Boolean(returnDate);
    const vehicleOutcome = rental?.vehicleOutcome ?? null;

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div
                        className={[
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            isReturned
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
                        ].join(" ")}
                    >
                        {isReturned ? (
                            <CheckCircle2
                                size={19}
                            />
                        ) : (
                            <RotateCcw
                                size={19}
                            />
                        )}
                    </div>

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Return
                        </p>

                        <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                            {isReturned
                                ? "Vehicle Returned"
                                : "Vehicle Return"}
                        </h3>
                    </div>
                </div>

                {!isReturned && (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                            onReturn?.(rental)
                        }
                        loading={loading}
                        disabled={disabled}
                    >
                        Process Return
                    </Button>
                )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
                    <div className="flex items-center gap-2">
                        <CalendarCheck2
                            size={16}
                            className="text-gray-400"
                        />

                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Return Time
                        </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {formatDateTime(
                            returnDate
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
                            Return Location
                        </span>
                    </div>

                    <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        {returnLocation}
                    </p>
                </div>
            </div>

            {/*
             * Completing a rental (completeRental in rentalService.js)
             * refuses to run without a vehicle outcome - surface it right
             * here where the return is shown, with a way to set it on the
             * spot, instead of leaving admins to notice it's missing only
             * when "Complete" fails elsewhere.
             */}
            {isReturned && (
                <div
                    className={[
                        "mt-3 flex items-center justify-between gap-3 rounded-xl px-4 py-3",
                        vehicleOutcome
                            ? "bg-emerald-50 dark:bg-emerald-950/20"
                            : "bg-amber-50 dark:bg-amber-950/20",
                    ].join(" ")}
                >
                    <div>
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Vehicle Outcome
                        </span>

                        <p
                            className={[
                                "mt-1 text-sm font-medium",
                                vehicleOutcome
                                    ? "text-emerald-700 dark:text-emerald-400"
                                    : "text-amber-700 dark:text-amber-400",
                            ].join(" ")}
                        >
                            {vehicleOutcome ??
                                "Not set yet — required before this rental can be completed"}
                        </p>
                    </div>

                    {!vehicleOutcome && (
                        <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                                onVehicleOutcome?.(rental)
                            }
                            disabled={disabled}
                        >
                            Set Outcome
                        </Button>
                    )}
                </div>
            )}
        </section>
    );
};

export default RentalReturnPanel;