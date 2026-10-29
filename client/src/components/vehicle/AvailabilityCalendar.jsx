import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { getVehicleAvailabilityCalendar } from "../../api/vehicleApi";
import { toISODate, buildMonthWeeks } from "../../utils/calendarGrid";
import {
    describeLimitedPickupTimes,
    formatPickupHours,
} from "../../utils/pickupTime";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

const WEEKDAY_LABELS = [
    "S",
    "M",
    "T",
    "W",
    "T",
    "F",
    "S",
];

/*
 * Public, read-only booking calendar for the vehicle detail page. Shows only
 * whether each day is bookable (green) or not (red) — deliberately never
 * says why a day is red (an existing booking, an admin-set block, or simply
 * in the past all look identical here) so the calendar can't be used to
 * infer other customers' booking activity.
 */
const AvailabilityCalendar = ({
    vehicleId,
    // Customer-facing (vehicle detail page): adds limited-time days, treats
    // return-only days as unavailable and explains pickup hours. Partner and
    // admin cards keep the plain view their unavailability requests match.
    showPickupTimes = false,
}) => {
    const { pickupHours } = usePublicRefundSettings();

    // "Pickup from 12:00 PM", relative to the configured pickup window.
    const describeLimitedTimes = (times) => {
        const text = describeLimitedPickupTimes(times, pickupHours);

        return text.charAt(0).toUpperCase() + text.slice(1);
    };

    const today = useMemo(() => {
        const now = new Date();

        return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate()
        );
    }, []);

    const [visibleMonth, setVisibleMonth] =
        useState(
            () =>
                new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    1
                )
        );

    const [unavailableDates, setUnavailableDates] =
        useState(new Set());

    // { "YYYY-MM-DD": { from, until } }: days bookable only at some times.
    const [limitedPickupTimes, setLimitedPickupTimes] =
        useState({});

    // A limited day tapped to read its times (titles don't show on touch).
    const [hintDate, setHintDate] =
        useState(null);

    const [loading, setLoading] =
        useState(false);

    const [loadError, setLoadError] =
        useState(false);

    useEffect(() => {
        if (!vehicleId) {
            return;
        }

        let isCancelled = false;

        const monthStart = visibleMonth;

        const monthEnd = new Date(
            visibleMonth.getFullYear(),
            visibleMonth.getMonth() + 1,
            1
        );

        const fetchCalendar = async () => {
            setLoading(true);
            setLoadError(false);

            try {
                const { data } =
                    await getVehicleAvailabilityCalendar(
                        vehicleId,
                        toISODate(monthStart),
                        toISODate(monthEnd)
                    );

                if (!isCancelled) {
                    // A day no rental can start on reads as unavailable here.
                    setUnavailableDates(
                        new Set([
                            ...(data?.unavailableDates ||
                                []),
                            ...(showPickupTimes
                                ? data?.returnOnlyDates ||
                                  []
                                : []),
                        ])
                    );
                    setLimitedPickupTimes(
                        showPickupTimes
                            ? data?.limitedPickupTimes ||
                                  {}
                            : {}
                    );
                    setHintDate(null);
                }
            } catch {
                if (!isCancelled) {
                    setUnavailableDates(
                        new Set()
                    );
                    setLimitedPickupTimes({});
                    setHintDate(null);
                    setLoadError(true);
                }
            } finally {
                if (!isCancelled) {
                    setLoading(false);
                }
            }
        };

        fetchCalendar();

        return () => {
            isCancelled = true;
        };
    }, [vehicleId, visibleMonth, showPickupTimes]);

    const weeks = useMemo(
        () =>
            buildMonthWeeks(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth()
            ),
        [visibleMonth]
    );

    const monthLabel =
        visibleMonth.toLocaleDateString(
            "en-PH",
            {
                month: "long",
                year: "numeric",
            }
        );

    const isCurrentMonth =
        visibleMonth.getFullYear() ===
            today.getFullYear() &&
        visibleMonth.getMonth() ===
            today.getMonth();

    const goToPreviousMonth = () => {
        if (isCurrentMonth) {
            return;
        }

        setVisibleMonth(
            (current) =>
                new Date(
                    current.getFullYear(),
                    current.getMonth() - 1,
                    1
                )
        );
    };

    const goToNextMonth = () => {
        setVisibleMonth(
            (current) =>
                new Date(
                    current.getFullYear(),
                    current.getMonth() + 1,
                    1
                )
        );
    };

    return (
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-7">
            <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-gray-950 dark:text-white">
                    Availability
                </h2>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={
                            goToPreviousMonth
                        }
                        disabled={
                            isCurrentMonth
                        }
                        aria-label="Previous month"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <ChevronLeft
                            size={16}
                        />
                    </button>

                    <span className="min-w-[9rem] text-center text-sm font-bold text-gray-900 dark:text-white">
                        {monthLabel}
                    </span>

                    <button
                        type="button"
                        onClick={
                            goToNextMonth
                        }
                        aria-label="Next month"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                        <ChevronRight
                            size={16}
                        />
                    </button>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-1.5 text-center">
                {WEEKDAY_LABELS.map(
                    (label, index) => (
                        <div
                            key={`${label}-${index}`}
                            className="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500"
                        >
                            {label}
                        </div>
                    )
                )}

                {weeks.flatMap(
                    (week, weekIndex) =>
                        week.map(
                            (
                                date,
                                dayIndex
                            ) => {
                                if (!date) {
                                    return (
                                        <div
                                            key={`empty-${weekIndex}-${dayIndex}`}
                                        />
                                    );
                                }

                                const iso =
                                    toISODate(
                                        date
                                    );

                                const isUnavailable =
                                    unavailableDates.has(
                                        iso
                                    );

                                const limitedTimes =
                                    !isUnavailable &&
                                    limitedPickupTimes[iso];

                                const cellClassName = [
                                    "flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold",
                                    loading
                                        ? "animate-pulse bg-gray-100 text-transparent dark:bg-gray-800"
                                        : isUnavailable
                                          ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                                          : limitedTimes
                                            ? `bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 ${
                                                  hintDate === iso
                                                      ? "ring-2 ring-amber-400"
                                                      : ""
                                              }`
                                            : "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
                                ].join(
                                    " "
                                );

                                if (
                                    limitedTimes &&
                                    !loading
                                ) {
                                    return (
                                        <button
                                            key={
                                                iso
                                            }
                                            type="button"
                                            title={describeLimitedTimes(
                                                limitedTimes
                                            )}
                                            onClick={() =>
                                                setHintDate(
                                                    (current) =>
                                                        current ===
                                                        iso
                                                            ? null
                                                            : iso
                                                )
                                            }
                                            className={
                                                cellClassName
                                            }
                                        >
                                            {date.getDate()}
                                        </button>
                                    );
                                }

                                return (
                                    <div
                                        key={
                                            iso
                                        }
                                        className={
                                            cellClassName
                                        }
                                    >
                                        {date.getDate()}
                                    </div>
                                );
                            }
                        )
                )}
            </div>

            {hintDate &&
                limitedPickupTimes[hintDate] && (
                    <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        {new Date(
                            `${hintDate}T00:00:00`
                        ).toLocaleDateString(
                            "en-PH",
                            {
                                month: "short",
                                day: "numeric",
                            }
                        )}
                        :{" "}
                        {describeLimitedTimes(
                            limitedPickupTimes[
                                hintDate
                            ]
                        )}
                    </p>
                )}

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    Bookable
                </span>

                {showPickupTimes && (
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                        Limited times (tap)
                    </span>
                )}

                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    Unavailable
                </span>
            </div>

            {showPickupTimes && (
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Pickup hours: {formatPickupHours(pickupHours)}{" "}
                    (Philippine time). Your
                    rental starts at the pickup time you book;
                    return by the same time on your return date.
                </p>
            )}

            {loadError && (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Unable to load
                    availability right now.
                </p>
            )}
        </div>
    );
};

export default AvailabilityCalendar;
