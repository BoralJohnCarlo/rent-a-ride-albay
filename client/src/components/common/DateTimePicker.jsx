import {
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ChevronDown } from "lucide-react";

import CalendarPanel from "./CalendarPanel";
import { toISODate } from "../../utils/calendarGrid";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const POPOVER_WIDTH = 392;
const pad = (n) => String(n).padStart(2, "0");

/* Values use the datetime-local wire format ("YYYY-MM-DDTHH:mm"), which
   compares correctly as a plain string - so min/max checks are string
   comparisons. */
const toValue = (date) =>
    `${toISODate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseValue = (value) => {
    if (!value) return null;
    const [datePart, timePart = "00:00"] = value.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm] = timePart.split(":").map(Number);
    const date = new Date(y, m - 1, d, hh, mm);
    return Number.isNaN(date.getTime()) ? null : date;
};

const clamp = (value, min, max) => {
    if (min && value < min) return min;
    if (max && value > max) return max;
    return value;
};

const formatDisplay = (date) =>
    date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

/*
 * Styled replacement for <input type="datetime-local">: a trigger field that
 * opens a calendar + time popover. The popover is portalled with fixed
 * positioning so it floats above maps/overflow-hidden panels, and flips above
 * the field when there's no room below.
 *
 * onChange receives the new "YYYY-MM-DDTHH:mm" string (not an event).
 */
const DateTimePicker = ({
    label,
    value,
    onChange,
    min,
    max,
    placeholder = "Select date & time",
    disabled = false,
    error,
}) => {
    const id = useId();
    const triggerRef = useRef(null);
    const popoverRef = useRef(null);
    const hourColRef = useRef(null);
    const minuteColRef = useRef(null);

    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);

    const selected = parseValue(value);

    const minDay = min ? min.slice(0, 10) : null;
    const maxDay = max ? max.slice(0, 10) : null;

    const emit = useCallback(
        (date) => onChange(clamp(toValue(date), min, max)),
        [onChange, min, max]
    );

    /* ---------------------------- positioning --------------------------- */

    const reposition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const popHeight = popoverRef.current?.offsetHeight || 420;
        const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24);
        const spaceBelow = window.innerHeight - rect.bottom;
        const placeAbove =
            spaceBelow < popHeight + 12 && rect.top > spaceBelow;

        setPosition({
            top: placeAbove ? rect.top - popHeight - 8 : rect.bottom + 8,
            left: Math.max(
                12,
                Math.min(rect.left, window.innerWidth - width - 12)
            ),
            width,
            placeAbove,
        });
    }, []);

    useLayoutEffect(() => {
        if (!open) return undefined;
        reposition();
        // Re-measure once the popover has its real height.
        const frame = requestAnimationFrame(reposition);
        window.addEventListener("resize", reposition);
        window.addEventListener("scroll", reposition, true);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("resize", reposition);
            window.removeEventListener("scroll", reposition, true);
        };
    }, [open, reposition]);

    // Close on outside click / Escape.
    useEffect(() => {
        if (!open) return undefined;

        const onPointer = (event) => {
            if (
                popoverRef.current?.contains(event.target) ||
                triggerRef.current?.contains(event.target)
            ) {
                return;
            }
            setOpen(false);
        };
        const onKey = (event) => {
            if (event.key === "Escape") {
                // Don't let a surrounding Modal close too.
                event.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open]);

    // Center the selected hour/minute in their scroll columns on open.
    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => {
            [hourColRef, minuteColRef].forEach((ref) => {
                const col = ref.current;
                const active = col?.querySelector("[data-active='true']");
                if (col && active) {
                    col.scrollTop =
                        active.offsetTop -
                        col.clientHeight / 2 +
                        active.clientHeight / 2;
                }
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [open, value]);

    const toggleOpen = () => {
        if (disabled) return;
        setOpen((prev) => !prev);
    };

    /* ------------------------------ updates ----------------------------- */

    // A base to apply edits to when nothing is picked yet.
    const base = selected || parseValue(clamp(toValue(new Date()), min, max));

    const pickDay = (iso) => {
        const [y, m, d] = iso.split("-").map(Number);
        const next = new Date(y, m - 1, d, base.getHours(), base.getMinutes());
        emit(next);
    };

    const setTime = ({ hour12, minute, meridiem }) => {
        const next = new Date(base);
        const currentMeridiem = next.getHours() >= 12 ? "pm" : "am";
        const h12 = hour12 ?? (next.getHours() % 12 || 12);
        const mer = meridiem ?? currentMeridiem;
        next.setHours((h12 % 12) + (mer === "pm" ? 12 : 0));
        if (minute !== undefined) next.setMinutes(minute);
        emit(next);
    };

    // Whether a time option would land outside min/max on the selected day.
    const isTimeOutOfRange = (patch) => {
        if (!min && !max) return false;
        const probe = new Date(base);
        const h12 = patch.hour12 ?? (probe.getHours() % 12 || 12);
        const mer = patch.meridiem ?? (probe.getHours() >= 12 ? "pm" : "am");
        probe.setHours((h12 % 12) + (mer === "pm" ? 12 : 0));
        if (patch.minute !== undefined) {
            probe.setMinutes(patch.minute);
        } else {
            // A whole hour is only out if every minute in it is.
            const first = new Date(probe);
            first.setMinutes(0);
            const last = new Date(probe);
            last.setMinutes(59);
            return (
                (max && toValue(first) > max) || (min && toValue(last) < min)
            );
        }
        const v = toValue(probe);
        return (min && v < min) || (max && v > max);
    };

    const selectedDay = selected ? toISODate(selected) : null;
    const selHour12 = selected ? selected.getHours() % 12 || 12 : null;
    const selMinute = selected ? selected.getMinutes() : null;
    const selMeridiem = selected
        ? selected.getHours() >= 12
            ? "pm"
            : "am"
        : null;

    const nowDisabled = (() => {
        const now = toValue(new Date());
        return (min && now < min) || (max && now > max);
    })();

    /* ------------------------------ render ------------------------------ */

    const timeOption = (active, outOfRange) =>
        `flex h-7 w-full shrink-0 items-center justify-center rounded-lg text-xs tabular-nums transition-colors duration-150 ${
            active
                ? "bg-yellow-400 font-bold text-gray-950 shadow-sm shadow-yellow-500/30"
                : outOfRange
                  ? "cursor-not-allowed text-gray-300 dark:text-gray-700"
                  : "font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/[0.06]"
        }`;

    const popover = (
        <AnimatePresence>
            {open && position && (
                <motion.div
                    ref={popoverRef}
                    data-dropdown-panel=""
                    role="dialog"
                    aria-label={label ? `${label} date and time` : "Date and time"}
                    initial={{ opacity: 0, y: position.placeAbove ? 8 : -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: position.placeAbove ? 8 : -8, scale: 0.97 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                        position: "fixed",
                        top: position.top,
                        left: position.left,
                        width: position.width,
                        transformOrigin: position.placeAbove ? "bottom left" : "top left",
                    }}
                    className="z-[2000] overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_24px_48px_-16px_rgba(17,24,39,0.35)] dark:border-gray-700/80 dark:bg-gray-900 dark:shadow-black/60"
                >
                    {/* Ticket stub: the picked moment, torn off a dashed perforation. */}
                    <div className="relative flex items-end justify-between gap-3 bg-gray-950 px-4 pb-3.5 pt-3 dark:bg-black/50">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-400">
                                {label || "Date & time"}
                            </p>
                            <p
                                className={`mt-0.5 truncate text-lg font-bold tracking-tight ${
                                    selected ? "text-white" : "text-white/40"
                                }`}
                            >
                                {selected
                                    ? selected.toLocaleDateString("en-US", {
                                          weekday: "short",
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                      })
                                    : "No date yet"}
                            </p>
                        </div>
                        {selected && (
                            <p className="shrink-0 rounded-lg bg-yellow-400 px-2 py-1 text-sm font-bold tabular-nums text-gray-950">
                                {selected.toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                })}
                            </p>
                        )}
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-3 -bottom-px border-b-2 border-dashed border-yellow-400/50"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row">
                        {/* Calendar */}
                        <div className="flex-1 p-3">
                            <CalendarPanel
                                value={selectedDay}
                                onSelect={pickDay}
                                minDay={minDay}
                                maxDay={maxDay}
                                compact
                            />
                        </div>

                        {/* Time */}
                        <div className="flex flex-col border-t border-gray-100 p-2.5 sm:w-[104px] sm:border-l sm:border-t-0 dark:border-white/[0.06]">
                            <div className="mb-2 grid grid-cols-2 rounded-xl bg-gray-100 p-0.5 dark:bg-white/[0.06]">
                                {["am", "pm"].map((mer) => {
                                    const active = selMeridiem === mer;
                                    const out = HOURS_12.every((h) =>
                                        isTimeOutOfRange({ hour12: h, meridiem: mer })
                                    );
                                    return (
                                        <button
                                            key={mer}
                                            type="button"
                                            disabled={out}
                                            onClick={() => setTime({ meridiem: mer })}
                                            className={`rounded-lg py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                                                active
                                                    ? "bg-gray-950 text-yellow-400 shadow-sm dark:bg-yellow-400 dark:text-gray-950"
                                                    : "text-gray-500 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:text-white"
                                            }`}
                                        >
                                            {mer}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mb-1 grid grid-cols-2 gap-1 text-center text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                <span>Hr</span>
                                <span>Min</span>
                            </div>

                            <div className="grid flex-1 grid-cols-2 gap-1">
                                <div
                                    ref={hourColRef}
                                    aria-label="Hour"
                                    className="flex h-28 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] sm:h-[220px]"
                                >
                                    {HOURS_12.map((h) => {
                                        const out = isTimeOutOfRange({ hour12: h });
                                        const active = h === selHour12;
                                        return (
                                            <button
                                                key={h}
                                                type="button"
                                                data-active={active}
                                                disabled={out}
                                                onClick={() => setTime({ hour12: h })}
                                                className={timeOption(active, out)}
                                            >
                                                {pad(h)}
                                            </button>
                                        );
                                    })}
                                </div>
                                <div
                                    ref={minuteColRef}
                                    aria-label="Minute"
                                    className="flex h-28 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] sm:h-[220px]"
                                >
                                    {MINUTES.map((m) => {
                                        const out = isTimeOutOfRange({ minute: m });
                                        const active = m === selMinute;
                                        return (
                                            <button
                                                key={m}
                                                type="button"
                                                data-active={active}
                                                disabled={out}
                                                onClick={() => setTime({ minute: m })}
                                                className={timeOption(active, out)}
                                            >
                                                {pad(m)}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
                        <button
                            type="button"
                            disabled={nowDisabled}
                            onClick={() => emit(new Date())}
                            className="rounded-lg px-2 py-1 text-xs font-bold text-yellow-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-yellow-400 dark:hover:bg-yellow-400/10"
                        >
                            Now
                        </button>
                        <button
                            type="button"
                            onClick={() => setOpen(false)}
                            className="rounded-lg bg-gray-950 px-3 py-1 text-xs font-bold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                        >
                            Done
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return (
        <div className="space-y-2">
            {label && (
                <label
                    htmlFor={id}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                    {label}
                </label>
            )}

            <button
                ref={triggerRef}
                id={id}
                type="button"
                disabled={disabled}
                onClick={toggleOpen}
                aria-haspopup="dialog"
                aria-expanded={open}
                className={`group flex w-full items-center gap-2.5 rounded-lg border bg-white px-3.5 py-3 text-left text-sm outline-none transition duration-200 focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-gray-900 dark:disabled:bg-gray-800 ${
                    error
                        ? "border-red-500 focus-visible:ring-red-200 dark:focus-visible:ring-red-900/40"
                        : open
                          ? "border-yellow-400 ring-2 ring-yellow-400/20 dark:border-yellow-400"
                          : "border-gray-300 hover:border-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 dark:border-gray-600 dark:hover:border-gray-500 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-900/40"
                }`}
            >
                <CalendarClock
                    size={17}
                    className={`shrink-0 transition-colors ${
                        open ? "text-yellow-500" : "text-gray-400 group-hover:text-gray-500 dark:text-gray-500"
                    }`}
                />
                <span
                    className={`min-w-0 flex-1 truncate ${
                        selected ? "text-gray-900 dark:text-gray-100" : "text-gray-400 dark:text-gray-500"
                    }`}
                >
                    {selected ? formatDisplay(selected) : placeholder}
                </span>
                <ChevronDown
                    size={16}
                    className={`shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500 ${
                        open ? "rotate-180 text-yellow-500 dark:text-yellow-400" : ""
                    }`}
                />
            </button>

            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {createPortal(popover, document.body)}
        </div>
    );
};

export default DateTimePicker;
