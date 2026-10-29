import { useEffect, useId, useRef, useState } from "react";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";

import { buildMonthWeeks, parseISODay, toISODate } from "../../utils/calendarGrid";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const YEARS_PER_PAGE = 12;
const EASE = [0.22, 1, 0.36, 1];
const GLIDE = { type: "spring", stiffness: 520, damping: 38 };

const pad = (n) => String(n).padStart(2, "0");
const monthKey = (year, month) => `${year}-${pad(month + 1)}`;

/*
 * The calendar body shared by the dropdown pickers (DatePicker,
 * DateTimePicker): squircle day cells with a selection highlight that glides
 * between days, a month/year jump view (click the title), and arrow-key
 * navigation across days.
 *
 * `value`, `minDay` and `maxDay` are "YYYY-MM-DD" strings; `onSelect`
 * receives the picked day as the same format.
 */
const CalendarPanel = ({ value, onSelect, minDay, maxDay, compact = false }) => {
    const glideId = useId();
    const reduceMotion = useReducedMotion();
    const gridRef = useRef(null);

    const selected = parseISODay(value);
    const today = toISODate(new Date());

    const [view, setView] = useState("days");
    const [direction, setDirection] = useState(0);
    const [viewDate, setViewDate] = useState(() => {
        const base = selected || parseISODay(minDay) || new Date();
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });
    const [focusISO, setFocusISO] = useState(null);

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const viewKey = monthKey(year, month);

    // Jump to the picked day's month when the value changes from outside
    // (e.g. a "Today" / "Now" button).
    useEffect(() => {
        if (!selected) return;
        const key = monthKey(selected.getFullYear(), selected.getMonth());
        if (key !== viewKey) {
            setDirection(key > viewKey ? 1 : -1);
            setViewDate(new Date(selected.getFullYear(), selected.getMonth(), 1));
        }
        // Only react to the value itself, not to manual paging.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // Keyboard navigation: move real focus to the day it landed on.
    useEffect(() => {
        if (!focusISO) return;
        gridRef.current
            ?.querySelector(`[data-iso="${focusISO}"]`)
            ?.focus({ preventScroll: true });
    }, [focusISO, viewKey]);

    const minMonth = minDay ? minDay.slice(0, 7) : null;
    const maxMonth = maxDay ? maxDay.slice(0, 7) : null;
    const minYear = minDay ? Number(minDay.slice(0, 4)) : null;
    const maxYear = maxDay ? Number(maxDay.slice(0, 4)) : null;

    const isDayOut = (iso) =>
        (minDay && iso < minDay) || (maxDay && iso > maxDay);
    const isMonthOut = (y, m) => {
        const key = monthKey(y, m);
        return (minMonth && key < minMonth) || (maxMonth && key > maxMonth);
    };
    const isYearOut = (y) =>
        (minYear && y < minYear) || (maxYear && y > maxYear);

    const weeks = buildMonthWeeks(year, month);
    const pageStart = year - (year % YEARS_PER_PAGE);

    /* ------------------------------ paging ------------------------------ */

    const shift = (step) => {
        setDirection(step);
        setViewDate((prev) => {
            if (view === "days") {
                return new Date(prev.getFullYear(), prev.getMonth() + step, 1);
            }
            const years = view === "months" ? step : step * YEARS_PER_PAGE;
            return new Date(prev.getFullYear() + years, prev.getMonth(), 1);
        });
    };

    const canGoBack =
        view === "days"
            ? !minMonth || viewKey > minMonth
            : view === "months"
              ? !minYear || year > minYear
              : !minYear || pageStart > minYear;
    const canGoForward =
        view === "days"
            ? !maxMonth || viewKey < maxMonth
            : view === "months"
              ? !maxYear || year < maxYear
              : !maxYear || pageStart + YEARS_PER_PAGE - 1 < maxYear;

    const title =
        view === "days"
            ? viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
            : view === "months"
              ? String(year)
              : `${pageStart} – ${pageStart + YEARS_PER_PAGE - 1}`;

    const zoomOut = () => setView((v) => (v === "days" ? "months" : "years"));

    /* ---------------------------- keyboard nav --------------------------- */

    const handleGridKeyDown = (event) => {
        const current = parseISODay(event.target?.dataset?.iso);
        if (!current) return;

        const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        let next;

        if (event.key in deltas) {
            next = new Date(current);
            next.setDate(next.getDate() + deltas[event.key]);
        } else if (event.key === "PageUp" || event.key === "PageDown") {
            next = new Date(current);
            next.setMonth(next.getMonth() + (event.key === "PageUp" ? -1 : 1));
        } else if (event.key === "Home" || event.key === "End") {
            next = new Date(current);
            next.setDate(next.getDate() - (event.key === "Home" ? next.getDay() : next.getDay() - 6));
        } else {
            return;
        }

        event.preventDefault();
        const iso = toISODate(next);
        if (isDayOut(iso)) return;

        const key = monthKey(next.getFullYear(), next.getMonth());
        if (key !== viewKey) {
            setDirection(key > viewKey ? 1 : -1);
            setViewDate(new Date(next.getFullYear(), next.getMonth(), 1));
        }
        setFocusISO(iso);
    };

    // The one day in the grid that takes Tab focus (roving tabindex).
    const tabStopISO = (() => {
        const inView = (iso) => iso && iso.startsWith(viewKey) && !isDayOut(iso);
        if (inView(focusISO)) return focusISO;
        if (selected && inView(toISODate(selected))) return toISODate(selected);
        if (inView(today)) return today;
        const firstOpen = weeks.flat().find((d) => d && !isDayOut(toISODate(d)));
        return firstOpen ? toISODate(firstOpen) : null;
    })();

    /* ------------------------------ render ------------------------------ */

    const cell = compact ? "h-8 w-8 text-[12px]" : "h-9 w-9 text-[13px]";
    const navButton =
        "flex h-8 w-8 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white";

    const slide = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : {
              initial: { opacity: 0, x: direction * 28 },
              animate: { opacity: 1, x: 0 },
              exit: { opacity: 0, x: direction * -28 },
          };

    const tileClass = (active, out, current) =>
        clsx(
            "relative flex h-11 items-center justify-center rounded-xl text-[13px] transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
            active
                ? "bg-yellow-400 font-bold text-gray-950 shadow-md shadow-yellow-500/30"
                : out
                  ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
                  : current
                    ? "font-semibold text-yellow-700 ring-1 ring-inset ring-yellow-300 hover:bg-yellow-50 dark:text-yellow-300 dark:ring-yellow-400/40 dark:hover:bg-yellow-400/10"
                    : "font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]"
        );

    return (
        <div className="select-none">
            <div className="mb-2 flex items-center justify-between gap-1">
                <button
                    type="button"
                    onClick={() => shift(-1)}
                    disabled={!canGoBack}
                    aria-label={view === "days" ? "Previous month" : view === "months" ? "Previous year" : "Previous years"}
                    className={navButton}
                >
                    <ChevronLeft size={16} />
                </button>

                <button
                    type="button"
                    onClick={zoomOut}
                    disabled={view === "years"}
                    aria-label={view === "days" ? "Choose month and year" : view === "months" ? "Choose year" : undefined}
                    className="group flex items-center gap-1 rounded-xl px-2.5 py-1 text-sm font-bold tracking-tight text-gray-900 transition hover:bg-gray-100 disabled:cursor-default disabled:hover:bg-transparent dark:text-white dark:hover:bg-white/[0.06]"
                >
                    <span aria-live="polite">{title}</span>
                    {view !== "years" && (
                        <ChevronDown
                            size={14}
                            className="text-gray-400 transition group-hover:translate-y-px group-hover:text-yellow-500"
                        />
                    )}
                </button>

                <button
                    type="button"
                    onClick={() => shift(1)}
                    disabled={!canGoForward}
                    aria-label={view === "days" ? "Next month" : view === "months" ? "Next year" : "Next years"}
                    className={navButton}
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            {view === "days" && (
                <div className="grid grid-cols-7">
                    {WEEKDAYS.map((day, index) => (
                        <div
                            key={day}
                            className={clsx(
                                "pb-1.5 text-center text-[10px] font-bold uppercase tracking-wider",
                                index === 0 || index === 6
                                    ? "text-yellow-600/80 dark:text-yellow-400/70"
                                    : "text-gray-400 dark:text-gray-500"
                            )}
                        >
                            {day}
                        </div>
                    ))}
                </div>
            )}

            <div className="overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                    {view === "days" ? (
                        <motion.div
                            key={`days-${viewKey}`}
                            ref={gridRef}
                            role="grid"
                            onKeyDown={handleGridKeyDown}
                            {...slide}
                            transition={{ duration: 0.22, ease: EASE }}
                            className="grid grid-cols-7 gap-y-0.5"
                        >
                            {weeks.flat().map((date, index) => {
                                if (!date) {
                                    return <div key={`blank-${index}`} className={compact ? "h-8" : "h-9"} />;
                                }

                                const iso = toISODate(date);
                                const out = isDayOut(iso);
                                const isSelected = selected && iso === toISODate(selected);
                                const isToday = iso === today;

                                return (
                                    <button
                                        key={iso}
                                        type="button"
                                        data-iso={iso}
                                        tabIndex={iso === tabStopISO ? 0 : -1}
                                        disabled={out}
                                        onClick={() => onSelect(iso)}
                                        aria-pressed={Boolean(isSelected)}
                                        aria-current={isToday ? "date" : undefined}
                                        aria-label={date.toLocaleDateString("en-US", {
                                            weekday: "long",
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                        className={clsx(
                                            "relative mx-auto flex items-center justify-center rounded-xl outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900",
                                            cell,
                                            isSelected
                                                ? "font-bold text-gray-950"
                                                : out
                                                  ? "cursor-not-allowed text-gray-300 line-through decoration-gray-300/70 dark:text-gray-700 dark:decoration-gray-700/70"
                                                  : isToday
                                                    ? "font-bold text-yellow-700 hover:bg-yellow-50 dark:text-yellow-300 dark:hover:bg-yellow-400/10"
                                                    : "font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]"
                                        )}
                                    >
                                        {isSelected && (
                                            <motion.span
                                                layoutId={`${glideId}-${viewKey}`}
                                                transition={reduceMotion ? { duration: 0 } : GLIDE}
                                                aria-hidden="true"
                                                className="absolute inset-0 rounded-xl bg-yellow-400 shadow-md shadow-yellow-500/35 ring-1 ring-inset ring-yellow-500/40"
                                            />
                                        )}
                                        <span className="relative">{date.getDate()}</span>
                                        {isToday && (
                                            <span
                                                aria-hidden="true"
                                                className={clsx(
                                                    "absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full",
                                                    isSelected ? "bg-gray-950" : "bg-yellow-500"
                                                )}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </motion.div>
                    ) : view === "months" ? (
                        <motion.div
                            key={`months-${year}`}
                            {...slide}
                            transition={{ duration: 0.22, ease: EASE }}
                            className="grid grid-cols-3 gap-1.5 py-1"
                        >
                            {MONTHS.map((label, m) => {
                                const out = isMonthOut(year, m);
                                const active =
                                    selected &&
                                    selected.getFullYear() === year &&
                                    selected.getMonth() === m;
                                const current =
                                    new Date().getFullYear() === year &&
                                    new Date().getMonth() === m;

                                return (
                                    <button
                                        key={label}
                                        type="button"
                                        disabled={out}
                                        onClick={() => {
                                            setDirection(0);
                                            setViewDate(new Date(year, m, 1));
                                            setView("days");
                                        }}
                                        className={tileClass(active, out, current)}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </motion.div>
                    ) : (
                        <motion.div
                            key={`years-${pageStart}`}
                            {...slide}
                            transition={{ duration: 0.22, ease: EASE }}
                            className="grid grid-cols-3 gap-1.5 py-1"
                        >
                            {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).map((y) => {
                                const out = isYearOut(y);
                                const active = selected && selected.getFullYear() === y;
                                const current = new Date().getFullYear() === y;

                                return (
                                    <button
                                        key={y}
                                        type="button"
                                        disabled={out}
                                        onClick={() => {
                                            setDirection(0);
                                            setViewDate(new Date(y, month, 1));
                                            setView("months");
                                        }}
                                        className={tileClass(active, out, current)}
                                    >
                                        {y}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default CalendarPanel;
