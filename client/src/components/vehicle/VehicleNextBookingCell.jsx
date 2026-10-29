/*
 * Admin fleet table's "Next Booking" cell, from GET /vehicles/booking-schedule:
 * the rental the vehicle is out on (due back / overdue), else its next
 * confirmed booking. `entry` undefined = schedule not loaded (or failed).
 */

const formatManila = (value) =>
    new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

const formatManilaDay = (value) =>
    new Date(value).toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
    });

const TAG =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";

const VehicleNextBookingCell = ({ entry, loaded = true }) => {
    if (!loaded) {
        return (
            <span className="text-xs text-gray-400 dark:text-gray-500">
                —
            </span>
        );
    }

    const current = entry?.current ?? null;
    const next = entry?.next ?? null;
    const moreCount = Math.max(0, (entry?.upcomingCount ?? 0) - 1);

    if (current) {
        const overdue = new Date(current.dueBackDate) < new Date();

        return (
            <div className="space-y-0.5">
                <span
                    className={`${TAG} ${
                        overdue
                            ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                            : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                    }`}
                >
                    {overdue ? "Overdue" : "On rent"}
                </span>

                <p className="text-[11px] text-gray-600 dark:text-gray-300">
                    {overdue ? "Was due " : "Due back "}
                    {formatManila(current.dueBackDate)}
                </p>

                {next && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        Next: {formatManilaDay(next.startDate)}
                        {moreCount > 0 && ` · +${moreCount} more`}
                    </p>
                )}
            </div>
        );
    }

    if (next) {
        const awaitingApproval = next.status === "Payment Received";

        return (
            <div className="space-y-0.5">
                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    {formatManila(next.startDate)}
                </p>

                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {awaitingApproval ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                            Awaiting approval
                        </span>
                    ) : (
                        `Until ${formatManilaDay(next.endDate)}`
                    )}
                    {moreCount > 0 && ` · +${moreCount} more`}
                </p>
            </div>
        );
    }

    return (
        <span className="text-xs text-gray-400 dark:text-gray-500">
            No upcoming
        </span>
    );
};

export default VehicleNextBookingCell;
