import { useMemo, useState } from "react";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buildMonthWeeks, toISODate } from "../../utils/calendarGrid";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const parseISO = (iso) => {
    if (!iso) return null;
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
};

const startOfMonth = (date) =>
    new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date, count) =>
    new Date(date.getFullYear(), date.getMonth() + count, 1);

/*
 * Month grid(s) for picking a start → end range (end strictly after start,
 * matching rental dates). Click once for the start, again for the end; while
 * choosing the end, hovering previews the range. A click on or before the
 * start while choosing the end restarts from that day.
 *
 * `selecting` ("start" | "end") says which end the next click sets; the
 * parent owns it so its own fields (e.g. "Pickup" / "Return") can drive it.
 */
const DateRangeCalendar = ({
    start,
    end,
    selecting = "start",
    onChange,
    minDate,
    months = 1,
    // Smaller cells and type, for tight spots like the home hero search.
    compact = false,
}) => {
    const cell = compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm";
    const row = compact ? "h-8" : "h-10";
    const today = useMemo(() => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const earliest = minDate ? parseISO(minDate) : today;

    const [viewDate, setViewDate] = useState(() =>
        startOfMonth(parseISO(start) || earliest)
    );
    const [direction, setDirection] = useState(0);
    const [hoverISO, setHoverISO] = useState(null);

    const canGoBack = viewDate > startOfMonth(earliest);

    const go = (step) => {
        if (step < 0 && !canGoBack) return;
        setDirection(step);
        setViewDate((prev) => addMonths(prev, step));
    };

    /* The range to paint: the real one, or a hover preview while choosing
       the end. */
    const previewEnd =
        selecting === "end" && start && hoverISO && hoverISO > start
            ? hoverISO
            : end;

    const handlePick = (iso) => {
        if (selecting === "end" && start && iso > start) {
            onChange({ start, end: iso, selecting: "done" });
            return;
        }

        // Starting over: a new start clears an end that's no longer after it.
        onChange({
            start: iso,
            end: end && end > iso ? end : "",
            selecting: "end",
        });
    };

    const renderMonth = (monthDate) => {
        const weeks = buildMonthWeeks(
            monthDate.getFullYear(),
            monthDate.getMonth()
        );

        return (
            <div key={toISODate(monthDate)} className="w-full min-w-0">
                <p className={`${compact ? "mb-2 text-xs" : "mb-3 text-sm"} text-center font-bold text-gray-900 dark:text-white`}>
                    {monthDate.toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                    })}
                </p>

                <div className="grid grid-cols-7">
                    {WEEKDAYS.map((label, index) => (
                        <div
                            key={label}
                            className={`${compact ? "pb-1 text-[10px]" : "pb-2 text-[11px]"} text-center font-bold uppercase tracking-wider ${
                                index === 0 || index === 6
                                    ? "text-yellow-600/80 dark:text-yellow-400/70"
                                    : "text-gray-400 dark:text-gray-500"
                            }`}
                        >
                            {label}
                        </div>
                    ))}

                    {weeks.flat().map((date, index) => {
                        if (!date) {
                            return <div key={`blank-${index}`} className={row} />;
                        }

                        const iso = toISODate(date);
                        const disabled = date < earliest;
                        const isStart = iso === start;
                        const isEnd = Boolean(previewEnd) && iso === previewEnd;
                        const inRange =
                            start && previewEnd && iso > start && iso < previewEnd;
                        const isToday = date.getTime() === today.getTime();
                        const isPreview =
                            isEnd && previewEnd !== end;

                        // The yellow band joining start → end, drawn behind
                        // the day circle and cut in half at each end.
                        const band =
                            start && previewEnd && (inRange || isStart || isEnd)
                                ? isStart && isEnd
                                    ? ""
                                    : isStart
                                      ? "left-1/2 right-0"
                                      : isEnd
                                        ? "left-0 right-1/2"
                                        : "inset-x-0"
                                : "";

                        return (
                            <div key={iso} className={`relative ${row}`}>
                                {band && (
                                    <span
                                        aria-hidden="true"
                                        className={`absolute inset-y-0.5 ${band} bg-yellow-100 dark:bg-yellow-400/15`}
                                    />
                                )}

                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => handlePick(iso)}
                                    onMouseEnter={() => setHoverISO(iso)}
                                    onMouseLeave={() => setHoverISO(null)}
                                    aria-label={date.toLocaleDateString("en-US", {
                                        weekday: "long",
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                    aria-pressed={isStart || iso === end}
                                    className={`relative mx-auto flex ${cell} flex-col items-center justify-center rounded-xl transition-colors duration-150 ${
                                        isStart || (isEnd && !isPreview)
                                            ? "bg-yellow-400 font-bold text-gray-950 shadow-md shadow-yellow-500/30"
                                            : isPreview
                                              ? "border-2 border-dashed border-yellow-400 font-semibold text-gray-900 dark:text-white"
                                              : disabled
                                                ? "cursor-not-allowed text-gray-300 line-through decoration-gray-300/60 dark:text-gray-700 dark:decoration-gray-700/60"
                                                : inRange
                                                  ? "font-medium text-gray-900 hover:bg-yellow-200 dark:text-yellow-100 dark:hover:bg-yellow-400/25"
                                                  : "font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                    }`}
                                >
                                    {date.getDate()}
                                    {isToday && !isStart && !isEnd && (
                                        <span className={`absolute ${compact ? "bottom-0.5" : "bottom-1"} h-1 w-1 rounded-full bg-yellow-500`} />
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="relative">
            <div className="absolute inset-x-0 top-0 z-10 flex justify-between">
                <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={!canGoBack}
                    className="flex h-7 w-7 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                    aria-label="Previous month"
                >
                    <ChevronLeft size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => go(1)}
                    className="flex h-7 w-7 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                    aria-label="Next month"
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="overflow-hidden pt-1">
                <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    <motion.div
                        key={toISODate(viewDate)}
                        custom={direction}
                        initial={{ opacity: 0, x: direction * 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: direction * -24 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className={`grid ${compact ? "gap-5" : "gap-6"} ${months > 1 ? "sm:grid-cols-2" : ""}`}
                    >
                        {Array.from({ length: months }, (_, i) =>
                            <div
                                key={i}
                                className={i > 0 ? "hidden sm:block" : ""}
                            >
                                {renderMonth(addMonths(viewDate, i))}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default DateRangeCalendar;
