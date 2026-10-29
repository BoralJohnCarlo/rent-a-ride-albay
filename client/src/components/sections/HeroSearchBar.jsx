import { useEffect, useMemo, useRef, useState } from "react";

import {
    AnimatePresence,
    motion,
    useMotionValue,
    useSpring,
    useTransform,
} from "framer-motion";
import {
    CalendarDays,
    CarFront,
    Check,
    ChevronDown,
    LayoutGrid,
    Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import DateRangeCalendar from "../common/DateRangeCalendar";
import { toISODate } from "../../utils/calendarGrid";

const parseISO = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
};

const addDaysISO = (iso, days) => {
    const date = parseISO(iso);
    date.setDate(date.getDate() + days);
    return toISODate(date);
};

const formatShort = (iso) =>
    iso
        ? parseISO(iso).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
          })
        : "";

const daysBetween = (startISO, endISO) =>
    Math.round((parseISO(endISO) - parseISO(startISO)) / 86_400_000);

/* Next Friday → Sunday (this one, if it's still Mon–Thu). */
const weekendRange = (todayISO) => {
    const today = parseISO(todayISO);
    const friday = new Date(today);
    friday.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7));
    const start = toISODate(friday);
    return { start, end: addDaysISO(start, 2) };
};

/* Rough popover heights, for choosing whether they fit above the bar. */
const POPOVER_HEIGHT = { category: 340, dates: 330 };
const NAVBAR_CLEARANCE = 96;

/* Popover shell: opens above the bar when there's room, else below. */
const Popover = ({ open, placement = "top", className = "", children, label }) => (
    <AnimatePresence>
        {open && (
            <motion.div
                role="dialog"
                aria-label={label}
                initial={{ opacity: 0, y: placement === "top" ? 10 : -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: placement === "top" ? 8 : -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={`absolute z-30 ${
                    placement === "top"
                        ? "bottom-full mb-3 origin-bottom"
                        : "top-full mt-3 origin-top"
                } border border-gray-200/80 bg-white/95 shadow-2xl shadow-black/25 backdrop-blur-xl dark:border-white/10 dark:bg-gray-950/95 ${className}`}
            >
                {children}
            </motion.div>
        )}
    </AnimatePresence>
);

/*
 * One pill-shaped segment of the bar: icon + small label + value (or
 * placeholder). `glass` = white-on-glass, for sitting over the hero video.
 */
const Field = ({
    icon: Icon,
    label,
    value,
    placeholder,
    active,
    glass,
    onClick,
    className = "",
    ...rest
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-expanded={active}
        className={`group flex min-h-[56px] w-full items-center gap-3 rounded-full py-2 pl-2 pr-4 text-left transition-colors ${
            active
                ? glass
                    ? "bg-white/15 ring-2 ring-yellow-400"
                    : "bg-yellow-50 ring-2 ring-yellow-400 dark:bg-yellow-400/10"
                : glass
                  ? "hover:bg-white/10"
                  : "hover:bg-gray-100/80 dark:hover:bg-white/5"
        } ${className}`}
        {...rest}
    >
        <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors ${
                active
                    ? "bg-yellow-400 text-gray-950"
                    : glass
                      ? "bg-yellow-400/15 text-yellow-300 group-hover:bg-yellow-400/25"
                      : "bg-yellow-100 text-yellow-700 group-hover:bg-yellow-200 dark:bg-yellow-400/10 dark:text-yellow-400"
            }`}
        >
            <Icon size={17} />
        </span>

        <span className="min-w-0 flex-1">
            <span
                className={`block text-[10px] font-bold uppercase tracking-wider ${
                    glass
                        ? "text-white/60"
                        : "text-gray-400 dark:text-gray-500"
                }`}
            >
                {label}
            </span>
            <span
                className={`block truncate text-sm font-semibold ${
                    value
                        ? glass
                            ? "text-white"
                            : "text-gray-900 dark:text-white"
                        : glass
                          ? "text-white/55"
                          : "text-gray-400 dark:text-gray-500"
                }`}
            >
                {value || placeholder}
            </span>
        </span>
    </button>
);

const HOLD_SPRING = { stiffness: 260, damping: 32, mass: 0.6 };

/*
 * Home hero search: category + pickup/return range → /available.
 * Custom popovers replace the native <select> / date inputs so they match
 * the site (and the dates are local, not UTC).
 *
 * `exitProgress` (optional MotionValue, 0 → 1) drives the hero's
 * scroll-linked exit: the bar recedes into the video as it fades.
 */
const HeroSearchBar = ({ categories = [], exitProgress }) => {
    const navigate = useNavigate();
    const rootRef = useRef(null);

    /* Glass over the hero video in every colour theme — the video is
       always dark, same rule as the navbar and the Albay widget. */
    const glass = true;

    const todayISO = useMemo(() => toISODate(new Date()), []);

    const [category, setCategory] = useState("");
    const [pickupDate, setPickupDate] = useState("");
    const [returnDate, setReturnDate] = useState("");

    // null | "category" | "dates"
    const [openPanel, setOpenPanel] = useState(null);
    const [placement, setPlacement] = useState("top");

    /* Open a panel above the bar if it fits under the navbar, else below. */
    const openPanelAt = (panel) => {
        const rect = rootRef.current?.getBoundingClientRect();
        const roomAbove = rect ? rect.top - NAVBAR_CLEARANCE : Infinity;

        setPlacement(roomAbove >= POPOVER_HEIGHT[panel] ? "top" : "bottom");
        setOpenPanel(panel);
    };
    const [selecting, setSelecting] = useState("start");

    /* Scroll exit, held back while a popover is open — a panel that opens
       below the bar on short screens has to stay usable while scrolling to
       it — and eased back in once it closes. */
    const noExit = useMotionValue(0);
    const exitHold = useSpring(1, HOLD_SPRING);

    useEffect(() => {
        exitHold.set(openPanel ? 0 : 1);
    }, [openPanel, exitHold]);

    const exit = useTransform(
        () => (exitProgress ?? noExit).get() * exitHold.get()
    );
    const exitScale = useTransform(exit, [0, 1], [1, 0.86]);
    const exitOpacity = useTransform(exit, [0.3, 1], [1, 0]);

    /* Close on outside click / Escape. */
    useEffect(() => {
        if (!openPanel) return undefined;

        const onPointerDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpenPanel(null);
            }
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") setOpenPanel(null);
        };

        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);

        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [openPanel]);

    const categoryName =
        categories.find((item) => item._id === category)?.name || "";

    const openDates = (which) => {
        setSelecting(which === "end" && pickupDate ? "end" : "start");
        openPanelAt("dates");
    };

    const handleRangeChange = ({ start, end, selecting: next }) => {
        setPickupDate(start);
        setReturnDate(end);

        if (next === "done") {
            setSelecting("start");
            // Let the end-date highlight register before closing.
            setTimeout(() => setOpenPanel(null), 180);
        } else {
            setSelecting(next);
        }
    };

    const applyPreset = ({ start, end }) => {
        setPickupDate(start);
        setReturnDate(end);
        setSelecting("start");
        setOpenPanel(null);
    };

    const presetStart = pickupDate || todayISO;
    const presets = [
        {
            label: "This weekend",
            range: weekendRange(todayISO),
        },
        {
            label: "3 days",
            range: { start: presetStart, end: addDaysISO(presetStart, 3) },
        },
        {
            label: "1 week",
            range: { start: presetStart, end: addDaysISO(presetStart, 7) },
        },
    ];

    const tripDays =
        pickupDate && returnDate ? daysBetween(pickupDate, returnDate) : 0;

    const handleSubmit = (event) => {
        event.preventDefault();

        const params = new URLSearchParams();
        if (pickupDate) params.set("pickup", pickupDate);
        if (returnDate) params.set("return", returnDate);
        if (category) params.set("category", category);

        const query = params.toString();
        navigate(query ? `/available?${query}` : "/available");
    };

    const dateHint =
        selecting === "end" && pickupDate
            ? "Now pick your return date"
            : "Pick your pickup date";

    /* Three layers so the entrance and the scroll exit never fight over the
       same properties: the wrapper fades/rises in, the form carries the
       exit's transform, and the exit's fade sits on the glass itself — an
       ancestor with opacity < 1 would cut off its backdrop blur. */
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35, ease: "easeOut" }}
            className="relative z-20 mx-auto mt-6 w-full max-w-3xl lg:mt-7 [@media(max-height:820px)]:mt-5"
        >
        <motion.form
            ref={rootRef}
            onSubmit={handleSubmit}
            style={{ scale: exitScale }}
            className="relative"
        >
            <motion.div
                style={{ opacity: exitOpacity }}
                className={`rounded-[2rem] border p-1.5 shadow-2xl backdrop-blur-xl transition-colors duration-500 sm:rounded-full ${
                    glass
                        ? "border-white/20 bg-gray-950/25 shadow-black/30"
                        : "border-white/30 bg-white/95 shadow-black/30 dark:border-white/10 dark:bg-gray-950/90"
                }`}
            >
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
                    {/* Category */}
                    <div className="relative">
                        <Field
                            glass={glass}
                            icon={CarFront}
                            className="pr-9"
                            label="Category"
                            value={categoryName}
                            placeholder="All categories"
                            active={openPanel === "category"}
                            aria-haspopup="listbox"
                            onClick={() =>
                                openPanel === "category"
                                    ? setOpenPanel(null)
                                    : openPanelAt("category")
                            }
                        />
                        <ChevronDown
                            size={14}
                            className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 transition-transform ${
                                glass ? "text-white/60" : "text-gray-400"
                            } ${
                                openPanel === "category" ? "rotate-180" : ""
                            }`}
                        />

                        <Popover
                            open={openPanel === "category"}
                            placement={placement}
                            label="Choose a category"
                            className="left-0 w-[min(18rem,calc(100vw-2rem))] rounded-3xl p-2"
                        >
                            <ul role="listbox" aria-label="Vehicle category" className="max-h-72 overflow-y-auto">
                                {[{ _id: "", name: "All categories" }, ...categories].map(
                                    (item) => {
                                        const selected = item._id === category;
                                        const Icon = item._id ? CarFront : LayoutGrid;

                                        return (
                                            <li key={item._id || "all"}>
                                                <button
                                                    type="button"
                                                    role="option"
                                                    aria-selected={selected}
                                                    onClick={() => {
                                                        setCategory(item._id);
                                                        setOpenPanel(null);
                                                    }}
                                                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors ${
                                                        selected
                                                            ? "bg-yellow-50 font-semibold text-gray-900 dark:bg-yellow-400/10 dark:text-white"
                                                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/5"
                                                    }`}
                                                >
                                                    <span
                                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                                            selected
                                                                ? "bg-yellow-400 text-gray-950"
                                                                : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                                                        }`}
                                                    >
                                                        <Icon size={15} />
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate">
                                                        {item.name}
                                                    </span>
                                                    {selected && (
                                                        <Check
                                                            size={16}
                                                            className="shrink-0 text-yellow-600 dark:text-yellow-400"
                                                        />
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    }
                                )}
                            </ul>

                            {categories.length === 0 && (
                                <p className="px-3 pb-2 pt-1 text-xs text-gray-400 dark:text-gray-500">
                                    More categories will appear here as the
                                    fleet grows.
                                </p>
                            )}
                        </Popover>
                    </div>

                    {/* Pickup */}
                    <Field
                        glass={glass}
                        icon={CalendarDays}
                        label="Pickup date"
                        value={formatShort(pickupDate)}
                        placeholder="Add date"
                        active={openPanel === "dates" && selecting === "start"}
                        aria-haspopup="dialog"
                        onClick={() => openDates("start")}
                    />

                    {/* Return */}
                    <Field
                        glass={glass}
                        icon={CalendarDays}
                        label="Return date"
                        value={formatShort(returnDate)}
                        placeholder="Add date"
                        active={openPanel === "dates" && selecting === "end"}
                        aria-haspopup="dialog"
                        onClick={() => openDates("end")}
                    />

                    <button
                        type="submit"
                        aria-label="Search available vehicles"
                        className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-yellow-400 px-6 text-sm font-bold text-gray-950 shadow-lg shadow-yellow-500/25 transition hover:bg-yellow-300 active:scale-[0.98]"
                    >
                        <Search size={18} strokeWidth={2.5} />
                        <span className="sm:hidden lg:inline">Search</span>
                    </button>
                </div>
            </motion.div>

            {/* Date range popover — always above the bar, centred and
                compact. (No transform-based centring: framer owns transform.) */}
            <Popover
                open={openPanel === "dates"}
                placement="top"
                label="Choose pickup and return dates"
                className="inset-x-0 mx-auto w-full max-w-[34rem] rounded-2xl p-3 sm:p-4"
            >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {dateHint}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                        {presets.map((preset) => (
                            <button
                                key={preset.label}
                                type="button"
                                onClick={() => applyPreset(preset.range)}
                                className="rounded-full border border-gray-200 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 transition hover:border-yellow-400 hover:bg-yellow-50 hover:text-gray-900 dark:border-white/10 dark:text-gray-300 dark:hover:border-yellow-400 dark:hover:bg-yellow-400/10 dark:hover:text-white"
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                <DateRangeCalendar
                    start={pickupDate}
                    end={returnDate}
                    selecting={selecting}
                    minDate={todayISO}
                    months={2}
                    compact
                    onChange={handleRangeChange}
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-white/10">
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                        {pickupDate ? (
                            <>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatShort(pickupDate)}
                                </span>
                                {" → "}
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {returnDate ? formatShort(returnDate) : "…"}
                                </span>
                                {tripDays > 0 && (
                                    <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-800 dark:bg-yellow-400/15 dark:text-yellow-300">
                                        {tripDays} day{tripDays === 1 ? "" : "s"}
                                    </span>
                                )}
                            </>
                        ) : (
                            "No dates selected"
                        )}
                    </p>

                    <div className="flex gap-2">
                        {(pickupDate || returnDate) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setPickupDate("");
                                    setReturnDate("");
                                    setSelecting("start");
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white"
                            >
                                Clear
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setOpenPanel(null)}
                            className="rounded-lg bg-gray-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </Popover>
        </motion.form>
        </motion.div>
    );
};

export default HeroSearchBar;
