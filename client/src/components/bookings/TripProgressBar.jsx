import { Car, CheckCircle2 } from "lucide-react";

/* Where the car marker sits along the pickup -> return timeline: parked at
   the start while the trip hasn't begun yet, then a live percentage through
   the trip while Ongoing (computed from today's date against the booking's
   own start/end), and at the end once it's no longer Ongoing (Completed). */
const getTripProgress = (status, startDate, endDate) => {
    if (status === "Completed") {
        return 100;
    }

    if (status !== "Ongoing") {
        return 0;
    }

    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    if (!(end > start)) {
        return 100;
    }

    const elapsed = Date.now() - start;

    return Math.min(
        100,
        Math.max(0, (elapsed / (end - start)) * 100)
    );
};

const formatShortDate = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
    });
};

/*
 * Shared pickup -> return trip visualization used on both the customer
 * "My Bookings" card and the admin booking card, so the two can't drift
 * apart. `compact` shrinks the track/marker and narrows the width for use
 * as a corner accent rather than a full-width centerpiece.
 *
 * `returnDate` is optional and only meaningful for Ongoing bookings: the
 * vehicle can come back before the rental is marked Completed (that still
 * needs a vehicle outcome + a resolved balance, both separate admin
 * actions - see rentalService.completeRental), so a still-"Ongoing"
 * booking with a return date on file has already finished its trip. Once
 * that happens, a car crawling along a bar reads as if nothing has
 * happened yet, so this swaps the whole track out for a plain "Returned"
 * state instead of trying to represent it as a percentage.
 */
const TripProgressBar = ({
    startDate,
    endDate,
    status,
    returnDate = null,
    compact = false,
    hideDates = false,
}) => {
    if (returnDate) {
        return (
            <div
                className={`inline-flex items-center gap-1 rounded-full bg-teal-50 font-semibold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 ${
                    compact
                        ? "px-2 py-0.5 text-[11px]"
                        : "px-2.5 py-1 text-xs"
                }`}
            >
                <CheckCircle2
                    size={compact ? 11 : 13}
                />
                Returned
            </div>
        );
    }

    const isOngoing = status === "Ongoing";
    const accent = isOngoing ? "#2F6F68" : "#E29B3F";

    const progress = getTripProgress(
        status,
        startDate,
        endDate
    );

    const markerPosition = Math.min(
        95,
        Math.max(5, progress)
    );

    return (
        <div className={compact ? "w-28" : "w-full"}>
            <div
                className={`relative ${
                    compact ? "h-1.5" : "h-2"
                }`}
            >
                <div className="absolute inset-0 rounded-full bg-[#14161B]/10 dark:bg-white/10" />

                <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                    style={{
                        width: `${progress}%`,
                        backgroundColor: accent,
                    }}
                />

                <div
                    className={`absolute top-1/2 flex items-center justify-center rounded-full border-2 border-white shadow-md transition-all duration-700 ease-out dark:border-[#1B1E24] ${
                        compact ? "h-4 w-4" : "h-6 w-6"
                    }`}
                    style={{
                        left: `${markerPosition}%`,
                        transform: "translate(-50%, -50%)",
                        backgroundColor: accent,
                    }}
                    title={
                        isOngoing
                            ? `${Math.round(progress)}% through the trip`
                            : status === "Completed"
                              ? "Trip completed"
                              : "Trip hasn't started yet"
                    }
                >
                    <Car
                        size={compact ? 9 : 12}
                        className="text-white"
                    />
                </div>
            </div>

            {!hideDates && (
                <div
                    className={`mt-1.5 flex items-center justify-between text-[#14161B]/45 dark:text-white/40 ${
                        compact ? "text-[10px]" : "text-xs"
                    }`}
                >
                    <span>{formatShortDate(startDate)}</span>
                    <span>{formatShortDate(endDate)}</span>
                </div>
            )}
        </div>
    );
};

export default TripProgressBar;
