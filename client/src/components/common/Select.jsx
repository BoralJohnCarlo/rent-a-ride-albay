import {
    forwardRef,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";

import { createPortal } from "react-dom";

import {
    AnimatePresence,
    motion,
    useReducedMotion,
} from "framer-motion";

import { Check, ChevronDown } from "lucide-react";
import clsx from "clsx";

const PANEL_MAX_HEIGHT = 288;
const PANEL_EASE = [0.22, 1, 0.36, 1];
const GLIDE = { type: "spring", stiffness: 520, damping: 38 };
const TYPEAHEAD_RESET_MS = 600;
// Long lists get a keyboard-hint footer (pointer devices only).
const HINT_MIN_ITEMS = 7;

const searchText = (option) =>
    (typeof option.label === "string" || typeof option.label === "number"
        ? String(option.label)
        : String(option.value)
    ).toLowerCase();

/**
 * Accessible, animated single-select.
 *
 * Keeps the previous <select> API: `options`, `value`, `onChange`,
 * `label`, `error`, `helperText`, `leftIcon`, `placeholder`, `disabled`,
 * `required`, `id`, `name`. `onChange` still receives an event-shaped
 * payload (`event.target.value` / `event.target.name`) and a forwarded
 * `ref` lands on the trigger button (so `.focus()` / `.scrollIntoView()`
 * keep working for form error handling).
 */
const Select = forwardRef(function Select(
    {
        id,
        name,
        label,
        value,
        onChange,
        options = [],
        placeholder = "Select an option",
        error,
        helperText,
        required = false,
        disabled = false,
        leftIcon,
        className = "",
        autoComplete,
        fullOptionText = false,
        // Just the trigger, styled by `className` (no label/border/error),
        // for toolbars, pills and custom field wrappers.
        bare = false,
        wrapperClassName = "",
        // Narrow triggers still get a readable menu.
        menuMinWidth = bare ? 200 : 0,
        ...props
    },
    ref
) {
    const reactId = useId();
    const fieldId = id || name || reactId;
    const listboxId = `${fieldId}-listbox`;

    const reduceMotion = useReducedMotion();

    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [rect, setRect] = useState(null);

    const triggerRef = useRef(null);
    const panelRef = useRef(null);
    const typeahead = useRef({ buffer: "", timer: null });

    useEffect(() => () => clearTimeout(typeahead.current.timer), []);

    const items = useMemo(
        () =>
            (options || []).map((option) => ({
                value: option.value,
                label: option.label ?? String(option.value),
                disabled: Boolean(option.disabled),
            })),
        [options]
    );

    const selectedIndex = useMemo(
        () =>
            items.findIndex(
                (option) =>
                    String(option.value) === String(value ?? "")
            ),
        [items, value]
    );

    const selectedOption =
        selectedIndex >= 0 ? items[selectedIndex] : null;

    /* Merge the forwarded ref with our internal trigger ref. */
    const setTriggerRef = useCallback(
        (node) => {
            triggerRef.current = node;

            if (typeof ref === "function") {
                ref(node);
            } else if (ref) {
                ref.current = node;
            }
        },
        [ref]
    );

    const measure = useCallback(() => {
        const el = triggerRef.current;

        if (!el) {
            return;
        }

        const r = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - r.bottom;
        const spaceAbove = r.top;

        const dropUp =
            spaceBelow < Math.min(PANEL_MAX_HEIGHT, 220) &&
            spaceAbove > spaceBelow;

        // Wider than the trigger when asked, but always on screen.
        const width = Math.min(
            Math.max(
                r.width,
                fullOptionText ? 300 : 0,
                menuMinWidth
            ),
            window.innerWidth - 24
        );

        setRect({
            left: Math.max(
                12,
                Math.min(r.left, window.innerWidth - width - 12)
            ),
            width,
            top: r.bottom,
            bottomAnchor: window.innerHeight - r.top,
            dropUp,
            maxHeight: Math.max(
                144,
                Math.min(
                    PANEL_MAX_HEIGHT,
                    (dropUp ? spaceAbove : spaceBelow) - 16
                )
            ),
        });
    }, [fullOptionText, menuMinWidth]);

    const closeMenu = useCallback(() => {
        setOpen(false);
        setActiveIndex(-1);
    }, []);

    const openMenu = useCallback(() => {
        if (disabled) {
            return;
        }

        measure();
        setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(true);
    }, [disabled, measure, selectedIndex]);

    const commit = useCallback(
        (option) => {
            if (!option || option.disabled) {
                return;
            }

            if (String(option.value) !== String(value ?? "")) {
                onChange?.({
                    type: "change",
                    target: {
                        name,
                        id: fieldId,
                        value: option.value,
                    },
                });
            }

            closeMenu();
            triggerRef.current?.focus();
        },
        [closeMenu, fieldId, name, onChange, value]
    );

    const moveActive = useCallback(
        (direction) => {
            setActiveIndex((current) => {
                const count = items.length;

                if (!count) {
                    return -1;
                }

                let next = current;

                for (let step = 0; step < count; step += 1) {
                    next = (next + direction + count) % count;

                    if (!items[next].disabled) {
                        return next;
                    }
                }

                return current;
            });
        },
        [items]
    );

    /* Reposition while open (scroll / resize), ignoring panel scroll. */
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handle = (event) => {
            if (
                event?.type === "scroll" &&
                panelRef.current?.contains(event.target)
            ) {
                return;
            }

            measure();
        };

        window.addEventListener("scroll", handle, true);
        window.addEventListener("resize", handle);

        return () => {
            window.removeEventListener("scroll", handle, true);
            window.removeEventListener("resize", handle);
        };
    }, [open, measure]);

    /* Close on outside pointer. */
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handlePointer = (event) => {
            if (
                triggerRef.current?.contains(event.target) ||
                panelRef.current?.contains(event.target)
            ) {
                return;
            }

            closeMenu();
        };

        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("touchstart", handlePointer);

        return () => {
            document.removeEventListener(
                "mousedown",
                handlePointer
            );
            document.removeEventListener(
                "touchstart",
                handlePointer
            );
        };
    }, [open, closeMenu]);

    /* Keep the highlighted row visible. */
    useEffect(() => {
        if (!open || activeIndex < 0) {
            return;
        }

        panelRef.current
            ?.querySelector(`[data-index="${activeIndex}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [open, activeIndex]);

    /* Type a letter (or a few) to jump to the matching option; repeating
       one letter cycles through the options that start with it. */
    const handleTypeahead = (key) => {
        const state = typeahead.current;

        clearTimeout(state.timer);
        state.buffer += key.toLowerCase();
        state.timer = setTimeout(() => {
            state.buffer = "";
        }, TYPEAHEAD_RESET_MS);

        const count = items.length;

        if (!count) {
            return;
        }

        const repeating = [...state.buffer].every(
            (char) => char === state.buffer[0]
        );
        const query = repeating ? state.buffer[0] : state.buffer;
        const from = open ? activeIndex : selectedIndex;
        const start = from < 0 ? 0 : from + (repeating ? 1 : 0);

        for (let step = 0; step < count; step += 1) {
            const index = (start + step) % count;
            const option = items[index];

            if (
                !option.disabled &&
                searchText(option).startsWith(query)
            ) {
                if (!open) {
                    measure();
                    setOpen(true);
                }

                setActiveIndex(index);
                return;
            }
        }
    };

    const handleKeyDown = (event) => {
        if (
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
        ) {
            handleTypeahead(event.key);
            return;
        }

        switch (event.key) {
            case "ArrowDown":
            case "ArrowUp":
            case "Enter":
            case " ": {
                event.preventDefault();

                if (!open) {
                    openMenu();
                } else if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    commit(items[activeIndex]);
                } else {
                    moveActive(
                        event.key === "ArrowDown" ? 1 : -1
                    );
                }

                break;
            }

            case "Escape": {
                if (open) {
                    event.preventDefault();
                    // Close just the menu, not a surrounding Modal.
                    event.stopPropagation();
                    closeMenu();
                }

                break;
            }

            case "Tab": {
                if (open) {
                    closeMenu();
                }

                break;
            }

            default:
                break;
        }
    };

    return (
        <div
            className={
                bare ? clsx("relative", wrapperClassName) : "space-y-2"
            }
        >
            {label && !bare && (
                <label
                    htmlFor={fieldId}
                    className="
                        block
                        text-sm
                        font-semibold
                        tracking-tight
                        text-gray-800
                        transition-colors
                        duration-300
                        dark:text-gray-200
                    "
                >
                    {label}
                    {required && (
                        <span className="ml-1 text-yellow-500">
                            *
                        </span>
                    )}
                </label>
            )}

            <div className="group relative">
                {leftIcon && !bare && (
                    <div
                        className="
                            pointer-events-none
                            absolute
                            inset-y-0
                            left-0
                            z-10
                            flex
                            items-center
                            pl-3.5
                            text-gray-400
                            transition-all
                            duration-300
                            ease-[cubic-bezier(0.22,1,0.36,1)]
                            group-focus-within:scale-105
                            group-focus-within:text-yellow-500
                            dark:text-gray-500
                            dark:group-focus-within:text-yellow-400
                            motion-reduce:transition-none
                            motion-reduce:transform-none
                        "
                    >
                        {leftIcon}
                    </div>
                )}

                <button
                    ref={setTriggerRef}
                    type="button"
                    id={fieldId}
                    name={name}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={open ? listboxId : undefined}
                    aria-activedescendant={
                        open && activeIndex >= 0
                            ? `${listboxId}-option-${activeIndex}`
                            : undefined
                    }
                    aria-required={required || undefined}
                    aria-invalid={error ? true : undefined}
                    disabled={disabled}
                    onClick={() =>
                        open ? closeMenu() : openMenu()
                    }
                    onKeyDown={handleKeyDown}
                    className={bare ? clsx(
                        "flex touch-manipulation items-center gap-1.5 text-left outline-none disabled:cursor-not-allowed disabled:opacity-60",
                        className
                    ) : clsx(
                        "flex w-full touch-manipulation items-center gap-2 rounded-xl border bg-white py-3.5 pr-11 pl-4 text-left text-sm font-medium text-gray-900 shadow-sm outline-none",
                        "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
                        "hover:border-gray-300 hover:shadow-md",
                        "active:scale-[0.985]",
                        "motion-reduce:transition-none motion-reduce:transform-none",
                        "dark:bg-gray-900 dark:text-gray-100 dark:hover:border-gray-600",
                        open &&
                            "border-yellow-400 shadow-md ring-4 ring-yellow-400/10 dark:border-yellow-400",
                        !open &&
                            !error &&
                            "border-gray-200 focus-visible:border-yellow-400 focus-visible:ring-4 focus-visible:ring-yellow-400/10 dark:border-gray-700",
                        error &&
                            !disabled &&
                            "border-red-400 focus-visible:border-red-500 focus-visible:ring-4 focus-visible:ring-red-500/10 dark:border-red-500",
                        disabled &&
                            "cursor-not-allowed bg-gray-100 text-gray-400 shadow-none hover:scale-100 active:scale-100 dark:bg-gray-800 dark:text-gray-500",
                        leftIcon && "pl-11",
                        className
                    )}
                    {...props}
                >
                    {bare && leftIcon && (
                        <span className="flex shrink-0 items-center">
                            {leftIcon}
                        </span>
                    )}

                    <span
                        title={
                            selectedOption
                                ? selectedOption.label
                                : undefined
                        }
                        className={clsx(
                            "block min-w-0 flex-1 truncate",
                            !selectedOption &&
                                "text-gray-400 dark:text-gray-500"
                        )}
                    >
                        {selectedOption
                            ? selectedOption.label
                            : placeholder}
                    </span>

                    <ChevronDown
                        aria-hidden="true"
                        size={bare ? 14 : 18}
                        className={clsx(
                            "pointer-events-none text-gray-400 transition-transform duration-200 dark:text-gray-500",
                            bare
                                ? "shrink-0"
                                : "absolute right-3.5 top-1/2 -translate-y-1/2",
                            open &&
                                "rotate-180 text-yellow-500 dark:text-yellow-400"
                        )}
                    />
                </button>

                {/* Mirror for native form submission / autofill. */}
                <input
                    type="hidden"
                    name={name}
                    value={value ?? ""}
                    autoComplete={autoComplete}
                />
            </div>

            {createPortal(
                <AnimatePresence>
                    {open && rect && (
                        <motion.div
                            key="select-panel"
                            ref={panelRef}
                            data-dropdown-panel=""
                            initial={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : {
                                          opacity: 0,
                                          scale: 0.97,
                                          y: rect.dropUp ? 8 : -8,
                                      }
                            }
                            animate={
                                reduceMotion
                                    ? { opacity: 1 }
                                    : { opacity: 1, scale: 1, y: 0 }
                            }
                            exit={
                                reduceMotion
                                    ? { opacity: 0 }
                                    : {
                                          opacity: 0,
                                          scale: 0.97,
                                          y: rect.dropUp ? 8 : -8,
                                      }
                            }
                            transition={{
                                duration: 0.16,
                                ease: PANEL_EASE,
                            }}
                            style={{
                                position: "fixed",
                                left: rect.left,
                                width: rect.width,
                                maxHeight: rect.maxHeight,
                                zIndex: 60,
                                transformOrigin: rect.dropUp
                                    ? "bottom center"
                                    : "top center",
                                ...(rect.dropUp
                                    ? {
                                          bottom:
                                              rect.bottomAnchor + 6,
                                      }
                                    : { top: rect.top + 6 }),
                            }}
                            className="
                                flex
                                flex-col
                                overflow-hidden
                                rounded-2xl
                                border
                                border-gray-200/80
                                bg-white
                                shadow-[0_18px_40px_-12px_rgba(17,24,39,0.28)]
                                dark:border-gray-700/80
                                dark:bg-gray-900
                                dark:shadow-black/60
                            "
                        >
                            <motion.ul
                                id={listboxId}
                                role="listbox"
                                aria-labelledby={fieldId}
                                tabIndex={-1}
                                layoutScroll
                                initial="hidden"
                                animate="show"
                                variants={{
                                    hidden: {},
                                    show: {
                                        transition: {
                                            staggerChildren:
                                                reduceMotion ||
                                                items.length > 15
                                                    ? 0
                                                    : 0.022,
                                        },
                                    },
                                }}
                                className="min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain p-1.5"
                            >
                                {items.length === 0 && (
                                    <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                                        No options available
                                    </li>
                                )}

                                {items.map((option, index) => {
                                    const isSelected =
                                        index === selectedIndex;
                                    const isActive =
                                        index === activeIndex &&
                                        !option.disabled;

                                    return (
                                        <motion.li
                                            key={`${option.value}-${index}`}
                                            role="none"
                                            variants={{
                                                hidden: reduceMotion
                                                    ? { opacity: 1 }
                                                    : {
                                                          opacity: 0,
                                                          x: -6,
                                                      },
                                                show: {
                                                    opacity: 1,
                                                    x: 0,
                                                },
                                            }}
                                        >
                                            <motion.button
                                                type="button"
                                                id={`${listboxId}-option-${index}`}
                                                data-index={index}
                                                role="option"
                                                tabIndex={-1}
                                                aria-selected={
                                                    isSelected
                                                }
                                                disabled={
                                                    option.disabled
                                                }
                                                whileTap={
                                                    reduceMotion ||
                                                    option.disabled
                                                        ? undefined
                                                        : { scale: 0.98 }
                                                }
                                                onMouseEnter={() =>
                                                    !option.disabled &&
                                                    setActiveIndex(
                                                        index
                                                    )
                                                }
                                                onClick={() =>
                                                    commit(option)
                                                }
                                                className={clsx(
                                                    "relative flex w-full touch-manipulation gap-3 rounded-xl py-2.5 pr-2.5 pl-2 text-left text-sm outline-none transition-colors duration-150",
                                                    fullOptionText
                                                        ? "items-start"
                                                        : "items-center",
                                                    option.disabled &&
                                                        "cursor-not-allowed opacity-40",
                                                    isSelected &&
                                                        "bg-yellow-50 dark:bg-yellow-400/[0.07]",
                                                    isSelected
                                                        ? "font-semibold text-gray-950 dark:text-white"
                                                        : isActive
                                                          ? "font-medium text-gray-950 dark:text-white"
                                                          : "font-medium text-gray-700 dark:text-gray-200"
                                                )}
                                            >
                                                {/* Highlight capsule that glides to whichever row is active. */}
                                                {isActive && (
                                                    <motion.span
                                                        layoutId={`${listboxId}-glide`}
                                                        transition={
                                                            reduceMotion
                                                                ? { duration: 0 }
                                                                : GLIDE
                                                        }
                                                        aria-hidden="true"
                                                        className={clsx(
                                                            "absolute inset-0 rounded-xl",
                                                            isSelected
                                                                ? "bg-yellow-400/20 dark:bg-yellow-400/15"
                                                                : "bg-gray-100 dark:bg-white/[0.06]"
                                                        )}
                                                    />
                                                )}

                                                {/* Lane marker: a dot at rest, a dash when active, a lit bar when chosen. */}
                                                <span
                                                    aria-hidden="true"
                                                    className={clsx(
                                                        "relative w-1 shrink-0 rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                                                        fullOptionText &&
                                                            "mt-0.5",
                                                        isSelected
                                                            ? "h-5 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.75)]"
                                                            : isActive
                                                              ? "h-3.5 bg-yellow-400/70"
                                                              : "h-1.5 bg-gray-300 dark:bg-gray-600"
                                                    )}
                                                />

                                                <span
                                                    className={clsx(
                                                        "relative flex-1",
                                                        fullOptionText
                                                            ? "whitespace-normal break-words text-[13px] leading-snug"
                                                            : "truncate"
                                                    )}
                                                >
                                                    {option.label}
                                                </span>

                                                <AnimatePresence
                                                    initial={false}
                                                >
                                                    {isSelected && (
                                                        <motion.span
                                                            initial={{
                                                                opacity: 0,
                                                                scale: 0.4,
                                                                rotate: -90,
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                                scale: 1,
                                                                rotate: 0,
                                                            }}
                                                            exit={{
                                                                opacity: 0,
                                                                scale: 0.4,
                                                            }}
                                                            transition={
                                                                reduceMotion
                                                                    ? { duration: 0 }
                                                                    : {
                                                                          type: "spring",
                                                                          stiffness: 600,
                                                                          damping: 28,
                                                                      }
                                                            }
                                                            className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-gray-950 shadow-sm shadow-yellow-500/40"
                                                        >
                                                            <Check
                                                                size={12}
                                                                strokeWidth={3.5}
                                                            />
                                                        </motion.span>
                                                    )}
                                                </AnimatePresence>
                                            </motion.button>
                                        </motion.li>
                                    );
                                })}
                            </motion.ul>

                            {items.length >= HINT_MIN_ITEMS && (
                                <div
                                    aria-hidden="true"
                                    className="hidden shrink-0 items-center gap-3 border-t border-gray-100 bg-gray-50/80 px-3 py-1.5 text-[10px] font-medium text-gray-400 pointer-fine:flex dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-gray-500"
                                >
                                    {[
                                        ["↑↓", "move"],
                                        ["↵", "select"],
                                        ["A–Z", "jump"],
                                    ].map(([keys, hint]) => (
                                        <span
                                            key={hint}
                                            className="flex items-center gap-1"
                                        >
                                            <kbd className="rounded-md border border-gray-200 bg-white px-1 py-px font-sans text-[10px] font-semibold text-gray-500 shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                                                {keys}
                                            </kbd>
                                            {hint}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {bare ? null : error ? (
                <p
                    role="alert"
                    className="
                        flex
                        items-center
                        gap-1
                        text-sm
                        font-medium
                        text-red-600
                        animate-[fadeIn_180ms_ease-out]
                        dark:text-red-400
                        motion-reduce:animate-none
                    "
                >
                    {error}
                </p>
            ) : (
                helperText && (
                    <p
                        className="
                            text-sm
                            text-gray-500
                            animate-[fadeIn_180ms_ease-out]
                            dark:text-gray-400
                            motion-reduce:animate-none
                        "
                    >
                        {helperText}
                    </p>
                )
            )}
        </div>
    );
});

Select.displayName = "Select";

export default Select;
