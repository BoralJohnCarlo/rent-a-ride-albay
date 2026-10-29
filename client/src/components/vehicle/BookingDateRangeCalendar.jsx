import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    ChevronLeft,
    ChevronRight,
    X,
} from "lucide-react";

import { getVehicleAvailabilityCalendar } from "../../api/vehicleApi";
import { buildMonthWeeks, toISODate } from "../../utils/calendarGrid";
import {
    describeLimitedPickupTimes,
    formatPickupHours,
} from "../../utils/pickupTime";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

/*
 * How far ahead we fetch unavailable dates in one shot, rather than
 * re-fetching per visible month like AvailabilityCalendar.jsx does. A range
 * picker needs to know about days beyond the currently-visible month to
 * correctly bound an in-progress end-date selection, so one wider fetch
 * (comfortably under the server's own 95-day cap) is both simpler and more
 * correct than juggling per-month caches.
 */
const AVAILABILITY_WINDOW_DAYS = 90;

const startOfDay = (date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
};

const parseISODate = (iso) =>
    iso ? startOfDay(new Date(`${iso}T00:00:00`)) : null;

const formatMonthLabel = (date) =>
    date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
    });

const formatDayLabel = (iso) => {
    const date = parseISODate(iso);
    return date
        ? date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
          })
        : "";
};

const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
};

/*
 * Interactive replacement for the two plain `<input type="date">` fields
 * previously used to pick a booking's start/end date. Fetches the same
 * per-day unavailable-dates data AvailabilityCalendar.jsx displays
 * read-only, but here it actually drives which days can be clicked -
 * already-booked dates, admin-blocked dates, and dates before the
 * vehicle's "available from" cutoff are all disabled outright rather than
 * only being caught after submission.
 */
const BookingDateRangeCalendar = ({
    vehicleId,
    startDate,
    endDate,
    onChange,
    disabled = false,
    // Rescheduling: the booking's own current dates, which the fetched
    // calendar marks as taken but which it is free to move within.
    freeRange = null,
    // Smaller cells and padding, no pickup-hours footer - for sitting
    // beside other fields (the booking form shows the hours itself).
    compact = false,
}) => {
    const { pickupHours } = usePublicRefundSettings();

    const describeLimitedTimes = (times) =>
        describeLimitedPickupTimes(times, pickupHours);

    const today = useMemo(
        () => startOfDay(new Date()),
        []
    );

    const [visibleMonth, setVisibleMonth] = useState(
        () => new Date(today.getFullYear(), today.getMonth(), 1)
    );

    const [fetchedUnavailableDates, setUnavailableDates] = useState(
        () => new Set()
    );

    // Free days no pickup time could start a rental on (return days only),
    // and { "YYYY-MM-DD": { from, until } } for days with limited times.
    const [fetchedReturnOnlyDates, setReturnOnlyDates] = useState(
        () => new Set()
    );
    const [fetchedLimitedTimes, setLimitedTimes] = useState({});

    const freeStart = freeRange?.startDate
        ? toISODate(new Date(freeRange.startDate))
        : "";
    const freeEnd = freeRange?.endDate
        ? toISODate(new Date(freeRange.endDate))
        : "";

    /*
     * Rescheduling: those hints were worked out with the booking's own
     * dates counted as taken, so they'd be wrong around it - fall back to
     * whole days there (the exact times are still checked on submit).
     */
    const hasFreeRange = Boolean(freeStart && freeEnd);

    const limitedPickupTimes = hasFreeRange ? {} : fetchedLimitedTimes;

    const unavailableDates = useMemo(() => {
        if (!hasFreeRange) {
            return new Set([
                ...fetchedUnavailableDates,
                ...fetchedReturnOnlyDates,
            ]);
        }

        const own = new Set();
        let cursor = parseISODate(freeStart);
        const last = parseISODate(freeEnd);

        while (cursor && last && cursor <= last) {
            own.add(toISODate(cursor));
            cursor = addDays(cursor, 1);
        }

        return new Set(
            [...fetchedUnavailableDates].filter((iso) => !own.has(iso))
        );
    }, [
        fetchedUnavailableDates,
        fetchedReturnOnlyDates,
        hasFreeRange,
        freeStart,
        freeEnd,
    ]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [hoverDate, setHoverDate] = useState(null);

    useEffect(() => {
        if (!vehicleId) {
            return undefined;
        }

        let cancelled = false;

        setLoading(true);
        setLoadError(false);

        const windowStart = toISODate(today);
        const windowEnd = toISODate(
            addDays(today, AVAILABILITY_WINDOW_DAYS)
        );

        getVehicleAvailabilityCalendar(
            vehicleId,
            windowStart,
            windowEnd
        )
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setUnavailableDates(
                    new Set(
                        response?.data?.unavailableDates ?? []
                    )
                );
                setReturnOnlyDates(
                    new Set(
                        response?.data?.returnOnlyDates ?? []
                    )
                );
                setLimitedTimes(
                    response?.data?.limitedPickupTimes ?? {}
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setLoadError(true);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [vehicleId, today]);

    const startDateObj = parseISODate(startDate);
    const endDateObj = parseISODate(endDate);

    const maxFetchedDate = useMemo(
        () => addDays(today, AVAILABILITY_WINDOW_DAYS),
        [today]
    );

    /*
     * The first unavailable day strictly after the chosen start date. An
     * end date can be that day itself (checkout/return day - the vehicle's
     * next occupant doesn't arrive until later that day) but nothing past
     * it, since the range would then cross an already-occupied stretch.
     */
    const maxEndBoundary = useMemo(() => {
        if (!startDateObj) {
            return null;
        }

        let cursor = addDays(startDateObj, 1);

        while (cursor <= maxFetchedDate) {
            if (unavailableDates.has(toISODate(cursor))) {
                return cursor;
            }

            cursor = addDays(cursor, 1);
        }

        return null;
    }, [startDateObj, unavailableDates, maxFetchedDate]);

    const isSelectableAsStart = (date) =>
        date >= today &&
        date <= maxFetchedDate &&
        !unavailableDates.has(toISODate(date));

    const isSelectableAsEnd = (date) =>
        Boolean(startDateObj) &&
        date > startDateObj &&
        (!maxEndBoundary || date <= maxEndBoundary);

    const pickingEnd = Boolean(startDateObj) && !endDateObj;

    const resolveSelectable = (date) => {
        if (!startDateObj || (startDateObj && endDateObj)) {
            return isSelectableAsStart(date);
        }

        if (date <= startDateObj) {
            return isSelectableAsStart(date);
        }

        return isSelectableAsEnd(date);
    };

    const handleDayClick = (date, selectable) => {
        if (disabled || !selectable) {
            return;
        }

        const iso = toISODate(date);

        if (!startDateObj || (startDateObj && endDateObj) || date <= startDateObj) {
            onChange({
                startDate: iso,
                endDate: "",
            });
            return;
        }

        onChange({
            startDate,
            endDate: iso,
        });
    };

    const handleClear = () => {
        if (disabled) {
            return;
        }

        onChange({
            startDate: "",
            endDate: "",
        });
    };

    const goToPreviousMonth = () => {
        setVisibleMonth((previous) => {
            const next = new Date(
                previous.getFullYear(),
                previous.getMonth() - 1,
                1
            );
            const floor = new Date(
                today.getFullYear(),
                today.getMonth(),
                1
            );

            return next < floor ? floor : next;
        });
    };

    const goToNextMonth = () => {
        setVisibleMonth(
            (previous) =>
                new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
        );
    };

    const isPrevDisabled =
        visibleMonth.getFullYear() === today.getFullYear() &&
        visibleMonth.getMonth() === today.getMonth();

    const isNextDisabled =
        visibleMonth.getFullYear() === maxFetchedDate.getFullYear() &&
        visibleMonth.getMonth() === maxFetchedDate.getMonth();

    const weeks = useMemo(
        () =>
            buildMonthWeeks(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth()
            ),
        [visibleMonth]
    );

    const previewEnd =
        pickingEnd &&
        hoverDate &&
        hoverDate > startDateObj &&
        isSelectableAsEnd(hoverDate)
            ? hoverDate
            : null;

    const rangeEndForDisplay = endDateObj ?? previewEnd;

    /*
     * The day whose pickup times to spell out: one being hovered as a
     * possible pickup date, else the chosen pickup date until a return date
     * is picked (the booking form then shows the exact times for the pair -
     * these hints assume the shortest, 1-day rental).
     */
    const hintDate =
        hoverDate &&
        !pickingEnd &&
        limitedPickupTimes[toISODate(hoverDate)]
            ? toISODate(hoverDate)
            : endDate
            ? null
            : startDate;

    const hintTimes = hintDate ? limitedPickupTimes[hintDate] : null;

    const nights =
        startDateObj && endDateObj
            ? Math.round(
                  (endDateObj.getTime() - startDateObj.getTime()) /
                      (1000 * 60 * 60 * 24)
              )
            : null;

    const monthLabel = formatMonthLabel(visibleMonth);

    return (
        <div
            className="
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                dark:border-gray-700
                dark:bg-gray-900
            "
        >
            <div
                className={`
                    flex
                    flex-wrap
                    items-center
                    justify-between
                    gap-x-3
                    gap-y-1
                    border-b
                    border-gray-100
                    dark:border-gray-800
                    ${compact ? "px-3 py-2" : "px-5 py-3.5"}
                `}
            >
                {startDate && endDate ? (
                    <p className={`font-semibold text-gray-900 dark:text-white ${compact ? "text-xs" : "text-sm"}`}>
                        {formatDayLabel(startDate)}
                        {" → "}
                        {formatDayLabel(endDate)}
                        <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                            {"· "}
                            {nights} {nights === 1 ? "night" : "nights"}
                        </span>
                    </p>
                ) : startDate ? (
                    <p className={`font-medium text-gray-700 dark:text-gray-300 ${compact ? "text-xs" : "text-sm"}`}>
                        {formatDayLabel(startDate)} selected
                        {" — "}now pick your return date
                    </p>
                ) : (
                    <p className={`font-medium text-gray-700 dark:text-gray-300 ${compact ? "text-xs" : "text-sm"}`}>
                        Select your pickup date
                    </p>
                )}

                {(startDate || endDate) && (
                    <button
                        type="button"
                        onClick={handleClear}
                        disabled={disabled}
                        className="
                            inline-flex
                            items-center
                            gap-1
                            text-xs
                            font-medium
                            text-gray-500
                            transition-colors
                            hover:text-gray-700
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                            dark:text-gray-400
                            dark:hover:text-gray-200
                        "
                    >
                        <X size={13} />
                        Clear
                    </button>
                )}
            </div>

            <div className={compact ? "px-3 pb-2.5 pt-2" : "p-5"}>
                <div
                    className={`flex items-center justify-between ${
                        compact ? "mb-0.5" : "mb-3"
                    }`}
                >
                    <button
                        type="button"
                        onClick={goToPreviousMonth}
                        disabled={disabled || isPrevDisabled}
                        aria-label="Previous month"
                        className={`
                            flex
                            ${compact ? "h-7 w-7" : "h-8 w-8"}
                            items-center
                            justify-center
                            rounded-full
                            text-gray-500
                            transition-colors
                            hover:bg-gray-100
                            disabled:cursor-not-allowed
                            disabled:opacity-30
                            dark:text-gray-400
                            dark:hover:bg-gray-800
                        `}
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <AnimatePresence mode="wait">
                        <motion.p
                            key={monthLabel}
                            initial={{
                                opacity: 0,
                                y: 4,
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                            }}
                            exit={{
                                opacity: 0,
                                y: -4,
                            }}
                            transition={{
                                duration: 0.15,
                            }}
                            className={`font-semibold text-gray-900 dark:text-white ${compact ? "text-xs" : "text-sm"}`}
                        >
                            {monthLabel}
                        </motion.p>
                    </AnimatePresence>

                    <button
                        type="button"
                        onClick={goToNextMonth}
                        disabled={disabled || isNextDisabled}
                        aria-label="Next month"
                        className={`
                            flex
                            ${compact ? "h-7 w-7" : "h-8 w-8"}
                            items-center
                            justify-center
                            rounded-full
                            text-gray-500
                            transition-colors
                            hover:bg-gray-100
                            disabled:cursor-not-allowed
                            disabled:opacity-30
                            dark:text-gray-400
                            dark:hover:bg-gray-800
                        `}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>

                <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-400 dark:text-gray-500">
                    {WEEKDAY_LABELS.map((label, index) => (
                        <div key={`${label}-${index}`} className={compact ? "py-0.5 text-[11px]" : "py-1"}>
                            {label}
                        </div>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={monthLabel}
                        initial={{
                            opacity: 0,
                        }}
                        animate={{
                            opacity: 1,
                        }}
                        exit={{
                            opacity: 0,
                        }}
                        transition={{
                            duration: 0.15,
                        }}
                        className="grid grid-cols-7"
                    >
                        {weeks.map((week, weekIndex) =>
                            week.map((date, dayIndex) => {
                                if (!date) {
                                    return (
                                        <div
                                            key={`empty-${weekIndex}-${dayIndex}`}
                                        />
                                    );
                                }

                                const iso = toISODate(date);
                                const isToday =
                                    date.getTime() === today.getTime();
                                const isPast = date < today;
                                const isUnavailable =
                                    unavailableDates.has(iso);
                                const limitedTimes =
                                    !isPast && !isUnavailable
                                        ? limitedPickupTimes[iso]
                                        : null;

                                const isStart =
                                    startDateObj &&
                                    date.getTime() ===
                                        startDateObj.getTime();
                                const isEnd =
                                    endDateObj &&
                                    date.getTime() ===
                                        endDateObj.getTime();
                                const isEdgeCap = isStart || isEnd;

                                const isInRangeInclusive =
                                    startDateObj &&
                                    rangeEndForDisplay &&
                                    date >= startDateObj &&
                                    date <= rangeEndForDisplay;

                                const selectable = loading
                                    ? false
                                    : resolveSelectable(date);

                                const isDisabled =
                                    disabled ||
                                    loading ||
                                    isPast ||
                                    (!selectable && !isEdgeCap);

                                return (
                                    <div
                                        key={iso}
                                        className={`
                                            flex
                                            justify-center
                                            ${compact ? "py-px" : "py-0.5"}
                                            ${
                                                isInRangeInclusive
                                                    ? "bg-blue-50 dark:bg-blue-500/10"
                                                    : ""
                                            }
                                        `}
                                    >
                                        <button
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() =>
                                                handleDayClick(
                                                    date,
                                                    selectable
                                                )
                                            }
                                            onMouseEnter={() =>
                                                setHoverDate(date)
                                            }
                                            onMouseLeave={() =>
                                                setHoverDate(null)
                                            }
                                            title={
                                                isUnavailable &&
                                                !isPast
                                                    ? "Not available"
                                                    : limitedTimes
                                                    ? describeLimitedTimes(
                                                          limitedTimes
                                                      )
                                                    : undefined
                                            }
                                            className={`
                                                relative
                                                flex
                                                items-center
                                                justify-center
                                                rounded-full
                                                ${compact ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm"}
                                                transition-colors
                                                disabled:cursor-not-allowed
                                                ${
                                                    isEdgeCap
                                                        ? "bg-blue-600 font-semibold text-white shadow-sm"
                                                        : isPast ||
                                                          isUnavailable
                                                        ? "text-gray-300 line-through decoration-gray-300 dark:text-gray-700 dark:decoration-gray-700"
                                                        : isToday
                                                        ? "font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                                                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                                }
                                            `}
                                        >
                                            {date.getDate()}

                                            {limitedTimes && !isEdgeCap ? (
                                                <span className={`absolute h-1 w-1 rounded-full bg-amber-500 ${compact ? "bottom-0.5" : "bottom-1"}`} />
                                            ) : (
                                                isToday &&
                                                !isEdgeCap && (
                                                    <span className={`absolute h-1 w-1 rounded-full bg-blue-500 ${compact ? "bottom-0.5" : "bottom-1"}`} />
                                                )
                                            )}
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </motion.div>
                </AnimatePresence>

                {loading && (
                    <p className="mt-3 text-center text-xs text-gray-400 dark:text-gray-500">
                        Loading availability...
                    </p>
                )}

                {loadError && !loading && (
                    <p className="mt-3 text-center text-xs text-red-500 dark:text-red-400">
                        Couldn't load live availability. Dates will still be
                        checked before your booking is confirmed.
                    </p>
                )}

                {!loading && hintTimes && (
                    <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                        {formatDayLabel(hintDate)}:{" "}
                        {describeLimitedTimes(hintTimes)}
                    </p>
                )}

                <div
                    className={`flex flex-wrap items-center justify-center text-gray-500 dark:text-gray-400 ${
                        compact
                            ? "mt-2 gap-x-3 gap-y-0.5 text-[10px]"
                            : "mt-4 gap-x-4 gap-y-2 text-xs"
                    }`}
                >
                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                        Selected
                    </span>

                    {!hasFreeRange && (
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                            Limited pickup times
                        </span>
                    )}

                    <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
                        Unavailable
                    </span>
                </div>

                {!compact && (
                    <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
                        Pickup hours: {formatPickupHours(pickupHours)}{" "}
                        (Philippine time)
                    </p>
                )}
            </div>
        </div>
    );
};

export default BookingDateRangeCalendar;
