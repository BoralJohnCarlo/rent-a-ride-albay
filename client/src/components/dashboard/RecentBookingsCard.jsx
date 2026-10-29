import { motion } from "framer-motion";
import {
    ArrowRight,
    CalendarCheck,
    CalendarDays,
    CarFront,
    UserRound,
} from "lucide-react";

import StatusChip from "../common/StatusChip";

const formatPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatDay = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
          })
        : "—";

const rentalDays = (start, end) => {
    if (!start || !end) return null;
    const days = Math.round((new Date(end) - new Date(start)) / 86_400_000);
    return days > 0 ? days : null;
};

const customerName = (customer) =>
    [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
    "Customer";

/* Status → tint of the vehicle tile, so the list scans at a glance. */
const TILE_TONES = {
    pending: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
    "payment received": "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-500/10 dark:text-sky-400 dark:ring-sky-500/20",
    approved: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
    ongoing: "bg-indigo-50 text-indigo-600 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/20",
    completed: "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20",
};

const DEFAULT_TONE =
    "bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700";

const RowSkeleton = () => (
    <div className="flex items-center gap-4 px-5 py-4">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
        </div>
        <div className="hidden space-y-2 sm:block">
            <div className="ml-auto h-3.5 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
            <div className="ml-auto h-5 w-24 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800/70" />
        </div>
    </div>
);

/*
 * Admin dashboard: the latest bookings as a read-only list — vehicle,
 * customer, dates, total and status. No per-row actions; "View all" opens
 * the Bookings page for anything that needs doing.
 */
const RecentBookingsCard = ({
    bookings = [],
    loading = false,
    limit = 5,
    onViewAll,
}) => {
    const rows = bookings.slice(0, limit);

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/40">
                        <CalendarCheck size={19} />
                    </div>

                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white">
                            Recent Bookings
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            The latest bookings across the fleet
                        </p>
                    </div>
                </div>

                {onViewAll && (
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="group inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-blue-600 hover:text-white dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-blue-600"
                    >
                        View all
                        <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-0.5"
                        />
                    </button>
                )}
            </div>

            {/* Body */}
            {loading && rows.length === 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {Array.from({ length: limit }, (_, i) => (
                        <RowSkeleton key={i} />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                        <CalendarDays size={22} />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-gray-700 dark:text-gray-200">
                        No bookings yet
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        New bookings will show up here.
                    </p>
                </div>
            ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((booking, index) => {
                        const vehicle = booking.vehicle;
                        const vehicleName = vehicle
                            ? `${vehicle.brand ?? ""} ${vehicle.model ?? ""}`.trim()
                            : "Vehicle";
                        const days = rentalDays(
                            booking.startDate,
                            booking.endDate
                        );
                        const tone =
                            TILE_TONES[booking.status?.toLowerCase()] ||
                            DEFAULT_TONE;

                        return (
                            <motion.li
                                key={booking._id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    delay: index * 0.05,
                                    duration: 0.35,
                                    ease: [0.22, 1, 0.36, 1],
                                }}
                                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                            >
                                <div
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${tone}`}
                                >
                                    <CarFront size={20} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                            {vehicleName}
                                        </p>
                                        <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                            {booking.bookingCode ||
                                                booking.bookingNumber}
                                        </span>
                                    </div>

                                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="inline-flex items-center gap-1">
                                            <UserRound size={12} />
                                            {customerName(booking.customer)}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarDays size={12} />
                                            {formatDay(booking.startDate)} →{" "}
                                            {formatDay(booking.endDate)}
                                            {days && (
                                                <span className="text-gray-400 dark:text-gray-500">
                                                    · {days} day
                                                    {days === 1 ? "" : "s"}
                                                </span>
                                            )}
                                        </span>
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-1.5">
                                    <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                        {formatPeso(booking.totalAmount)}
                                    </p>
                                    <StatusChip
                                        status={booking.status}
                                        size="sm"
                                    />
                                </div>
                            </motion.li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default RecentBookingsCard;
