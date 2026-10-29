import { useEffect, useState } from "react";

import { Clock3 } from "lucide-react";

import { getLateReturnImpact } from "../../api/bookingApi";
import {
    formatConflictDateTime,
    getConflictLabel,
    VEHICLE_CONFLICT_CAUSE,
} from "../../constants/maintenanceConflict";

const peso = (amount) =>
    `₱${Number(amount || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const Stat = ({ label, value, tone = "text-gray-900 dark:text-white" }) => (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900">
        <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {label}
        </p>
        <p className={`text-sm font-bold ${tone}`}>{value}</p>
    </div>
);

/*
 * Admin, on the late renter's booking: which later bookings this rental's
 * late return put at risk, how each was resolved, and what it cost
 * (refunds, free upgrades) next to the late fee — so the admin can decide
 * whether to pass costs on. Renders nothing when no booking was affected.
 */
const LateReturnImpactPanel = ({ bookingId, refreshKey }) => {
    const [impact, setImpact] = useState(null);

    useEffect(() => {
        if (!bookingId) {
            return undefined;
        }

        let active = true;

        getLateReturnImpact(bookingId)
            .then((response) => active && setImpact(response?.data ?? null))
            .catch(() => active && setImpact(null));

        return () => {
            active = false;
        };
    }, [bookingId, refreshKey]);

    if (!impact?.bookings?.length) {
        return null;
    }

    const { totals } = impact;
    const cost = totals.refunded + totals.covered;

    return (
        <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-start gap-3">
                <Clock3
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                />
                <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Late return impact
                    </h3>
                    <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-300/90">
                        {impact.stillOut
                            ? `This rental was due back ${formatConflictDateTime(
                                  impact.dueBackAt
                              )} and is still out — ${impact.lateBy} late so far.`
                            : `This rental was due back ${formatConflictDateTime(
                                  impact.dueBackAt
                              )} and came back ${formatConflictDateTime(
                                  impact.returnedAt
                              )}${impact.lateBy ? ` (${impact.lateBy} late)` : ""}.`}{" "}
                        It put {totals.affected} later booking
                        {totals.affected === 1 ? "" : "s"} on the same vehicle
                        at risk.
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Stat label="Bookings affected" value={totals.affected} />
                        <Stat
                            label="Still open"
                            value={totals.open}
                            tone={
                                totals.open
                                    ? "text-rose-600 dark:text-rose-400"
                                    : undefined
                            }
                        />
                        <Stat label="Refunded" value={peso(totals.refunded)} />
                        <Stat
                            label="Free upgrades covered"
                            value={peso(totals.covered)}
                        />
                    </div>

                    <ul className="mt-3 divide-y divide-amber-200/70 rounded-lg border border-amber-200/70 bg-white text-xs dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
                        {impact.bookings.map((row) => (
                            <li
                                key={row._id}
                                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
                            >
                                <span className="min-w-0">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                        {row.bookingCode}
                                    </span>{" "}
                                    <span className="text-gray-500 dark:text-gray-400">
                                        · {row.customerName} · pickup{" "}
                                        {formatConflictDateTime(row.pickupAt)}
                                    </span>
                                </span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                    {row.current
                                        ? getConflictLabel({
                                              cause: VEHICLE_CONFLICT_CAUSE.LATE_RETURN,
                                              status: row.conflictStatus,
                                          })
                                        : "Later replaced by another issue"}
                                    {row.newVehicle ? ` → ${row.newVehicle}` : ""}
                                    {row.refundAmount
                                        ? ` · ${peso(row.refundAmount)} refunded`
                                        : ""}
                                    {row.coveredAmount
                                        ? ` · ${peso(row.coveredAmount)} covered`
                                        : ""}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <p className="mt-3 text-xs text-amber-800/90 dark:text-amber-300/90">
                        Late fee on this rental: {peso(impact.lateFeeCharged)}
                        {impact.stillOut ? " (worked out on return)" : ""}.
                        {cost > 0
                            ? ` The delay has cost ${peso(
                                  cost
                              )} so far in refunds and covered upgrades — if you want the late renter to bear it, add it as an additional charge when settling this rental.`
                            : ""}
                    </p>
                </div>
            </div>
        </section>
    );
};

export default LateReturnImpactPanel;
