import {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, ChevronDown } from "lucide-react";
import clsx from "clsx";

import CalendarPanel from "./CalendarPanel";
import { parseISODay, toISODate } from "../../utils/calendarGrid";

const POPOVER_WIDTH = 304;

const formatDisplay = (date) =>
    date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });

/*
 * Styled replacement for <input type="date">: a trigger field that opens a
 * calendar dropdown (CalendarPanel). Input renders this for type="date", so
 * it keeps that API - `value` / `min` / `max` are "YYYY-MM-DD", `onChange`
 * gets an event-shaped payload (`event.target.name` / `.value`), and a
 * forwarded ref lands on the trigger.
 *
 * `bare` drops the label/border/error chrome so the trigger can sit inside
 * a custom field wrapper; style it with `className`.
 */
const DatePicker = forwardRef(function DatePicker(
    {
        id,
        name,
        label,
        value,
        onChange,
        min,
        max,
        placeholder = "Select a date",
        error,
        helperText,
        required = false,
        disabled = false,
        leftIcon,
        bare = false,
        className = "",
        ...props
    },
    ref
) {
    const reactId = useId();
    const fieldId = id || name || reactId;
    const reduceMotion = useReducedMotion();

    const triggerRef = useRef(null);
    const popoverRef = useRef(null);

    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);

    const selected = parseISODay(value);
    const minDay = min ? String(min).slice(0, 10) : null;
    const maxDay = max ? String(max).slice(0, 10) : null;
    const todayISO = toISODate(new Date());
    const todayOut =
        (minDay && todayISO < minDay) || (maxDay && todayISO > maxDay);

    const setTriggerRef = useCallback(
        (node) => {
            triggerRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
        },
        [ref]
    );

    const emit = (iso) =>
        onChange?.({
            type: "change",
            target: { name, id: fieldId, type: "date", value: iso },
        });

    const close = useCallback((refocus = true) => {
        setOpen(false);
        if (refocus) triggerRef.current?.focus();
    }, []);

    /* ---------------------------- positioning --------------------------- */

    const reposition = useCallback(() => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const popHeight = popoverRef.current?.offsetHeight || 400;
        const width = Math.min(POPOVER_WIDTH, window.innerWidth - 24);
        const spaceBelow = window.innerHeight - rect.bottom;
        const placeAbove = spaceBelow < popHeight + 12 && rect.top > spaceBelow;

        setPosition({
            top: placeAbove ? rect.top - popHeight - 8 : rect.bottom + 8,
            left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
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

    useEffect(() => {
        if (!open) return undefined;

        const onPointer = (event) => {
            if (
                popoverRef.current?.contains(event.target) ||
                triggerRef.current?.contains(event.target)
            ) {
                return;
            }
            close(false);
        };
        const onKey = (event) => {
            if (event.key === "Escape") {
                event.stopPropagation();
                close();
            }
        };

        document.addEventListener("mousedown", onPointer);
        document.addEventListener("touchstart", onPointer);
        document.addEventListener("keydown", onKey, true);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("touchstart", onPointer);
            document.removeEventListener("keydown", onKey, true);
        };
    }, [open, close]);

    // Move focus into the grid so arrow keys work straight away.
    useEffect(() => {
        if (!open) return undefined;
        const frame = requestAnimationFrame(() => {
            popoverRef.current?.querySelector('[role="grid"] [tabindex="0"]')?.focus({
                preventScroll: true,
            });
        });
        return () => cancelAnimationFrame(frame);
    }, [open]);

    const pick = (iso) => {
        emit(iso);
        close();
    };

    /* ------------------------------ render ------------------------------ */

    const popover = (
        <AnimatePresence>
            {open && position && (
                <motion.div
                    ref={popoverRef}
                    data-dropdown-panel=""
                    role="dialog"
                    aria-label={label ? `${label} calendar` : "Choose a date"}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: position.placeAbove ? 8 : -8, scale: 0.97 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: position.placeAbove ? 8 : -8, scale: 0.97 }}
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
                    {/* Ticket stub: the picked date, torn off a dashed perforation. */}
                    <div className="relative bg-gray-950 px-4 pb-3.5 pt-3 dark:bg-black/50">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-yellow-400">
                            {label || "Date"}
                        </p>
                        <p
                            className={clsx(
                                "mt-0.5 truncate text-lg font-bold tracking-tight",
                                selected ? "text-white" : "text-white/40"
                            )}
                        >
                            {selected ? formatDisplay(selected) : "No date yet"}
                        </p>
                        <CalendarDays
                            size={44}
                            strokeWidth={1.25}
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-1.5 top-1/2 -translate-y-1/2 text-white/[0.07]"
                        />
                        <span
                            aria-hidden="true"
                            className="absolute inset-x-3 -bottom-px border-b-2 border-dashed border-yellow-400/50"
                        />
                    </div>

                    <div className="p-3">
                        <CalendarPanel
                            value={selected ? toISODate(selected) : null}
                            onSelect={pick}
                            minDay={minDay}
                            maxDay={maxDay}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/80 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
                        <button
                            type="button"
                            disabled={todayOut}
                            onClick={() => pick(todayISO)}
                            className="rounded-lg px-2 py-1 text-xs font-bold text-yellow-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-yellow-400 dark:hover:bg-yellow-400/10"
                        >
                            Today
                        </button>

                        <div className="flex items-center gap-1">
                            {!required && selected && (
                                <button
                                    type="button"
                                    onClick={() => pick("")}
                                    className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 transition hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                                >
                                    Clear
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => close()}
                                className="rounded-lg bg-gray-950 px-3 py-1 text-xs font-bold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    const trigger = (
        <button
            ref={setTriggerRef}
            id={fieldId}
            type="button"
            disabled={disabled}
            onClick={() => (open ? close(false) : setOpen(true))}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-required={required || undefined}
            aria-invalid={error ? true : undefined}
            className={
                bare
                    ? clsx("flex w-full items-center gap-1.5 text-left outline-none disabled:cursor-not-allowed", className)
                    : clsx(
                          "group flex w-full items-center gap-2.5 rounded-lg border bg-white px-4 py-3 text-left outline-none transition duration-200 focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 dark:bg-gray-900 dark:disabled:bg-gray-800",
                          error
                              ? "border-red-500 focus-visible:ring-red-200 dark:focus-visible:ring-red-900/40"
                              : open
                                ? "border-yellow-400 ring-2 ring-yellow-400/20 dark:border-yellow-400"
                                : "border-gray-300 hover:border-gray-400 focus-visible:border-blue-500 focus-visible:ring-blue-200 dark:border-gray-600 dark:hover:border-gray-500 dark:focus-visible:border-blue-400 dark:focus-visible:ring-blue-900/40",
                          className
                      )
            }
            {...props}
        >
            {!bare && (
                <span
                    className={clsx(
                        "shrink-0 transition-colors",
                        open ? "text-yellow-500" : "text-gray-400 group-hover:text-gray-500 dark:text-gray-500"
                    )}
                >
                    {leftIcon || <CalendarDays size={17} />}
                </span>
            )}
            <span
                className={clsx(
                    "min-w-0 flex-1 truncate",
                    selected
                        ? !bare && "text-gray-900 dark:text-gray-100"
                        : "text-gray-400 dark:text-gray-500"
                )}
            >
                {selected ? formatDisplay(selected) : placeholder}
            </span>
            <ChevronDown
                size={16}
                aria-hidden="true"
                className={clsx(
                    "shrink-0 text-gray-400 transition-transform duration-200 dark:text-gray-500",
                    open && "rotate-180 text-yellow-500 dark:text-yellow-400"
                )}
            />
        </button>
    );

    // Invisible stand-in so native `required` validation and form
    // serialisation still see the field; focusing it hands off to the trigger.
    const proxy = (
        <input
            tabIndex={-1}
            aria-hidden="true"
            name={name}
            value={value ? String(value).slice(0, 10) : ""}
            required={required}
            disabled={disabled}
            onChange={() => {}}
            onFocus={() => triggerRef.current?.focus()}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        />
    );

    if (bare) {
        return (
            <div className="relative">
                {trigger}
                {proxy}
                {createPortal(popover, document.body)}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {label && (
                <label
                    htmlFor={fieldId}
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                >
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            <div className="relative">
                {trigger}
                {proxy}
            </div>

            {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : (
                helperText && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
                )
            )}

            {createPortal(popover, document.body)}
        </div>
    );
});

DatePicker.displayName = "DatePicker";

export default DatePicker;
