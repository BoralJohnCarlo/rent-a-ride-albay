import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    motion,
    AnimatePresence,
    useDragControls,
    useReducedMotion,
} from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import {
    useNavigate,
    useSearchParams,
} from "react-router-dom";

import {
    ArrowRight,
    CalendarCheck,
    CalendarDays,
    CalendarRange,
    CarFront,
    ChevronUp,
    LayoutGrid,
    RotateCcw,
    Search,
    Wallet,
    X,
} from "lucide-react";

import { getVehicles } from "../../store/vehicles/vehicleSlice";
import { checkVehiclesAvailabilityBulk } from "../../api/vehicleApi";
import {
    BOOKABLE_VEHICLE_STATUS_FILTER,
    isVehicleBookable,
    overlapsVehicleMaintenance,
} from "../../constants/vehicleConstants";

import useVehicleCategory from "../../hooks/categories";

import AnimatedCounter from "../../components/dashboard/AnimatedCounter";
import Button from "../../components/common/Button";
import DatePicker from "../../components/common/DatePicker";
import Select from "../../components/common/Select";
import EmptyState from "../../components/common/EmptyState";
import PageContainer from "../../components/sections/PageContainer";
import LightTexture from "../../components/sections/LightTexture";
import Section from "../../components/sections/Section";
import PriceRangeSlider from "../../components/search/PriceRangeSlider";
import FilterSummaryPill from "../../components/search/FilterSummaryPill";
import useMediaQuery from "../../hooks/ui/useMediaQuery";
import AvailabilityVehicleCard from "../../components/vehicle/AvailabilityVehicleCard";
import { getEffectiveDailyRate } from "../../utils/vehicleDiscount";

/* -------------------------------------------------------------------------- */
/*  Date + availability helpers                                                */
/* -------------------------------------------------------------------------- */

const toISODate = (date) => date.toISOString().split("T")[0];

const TODAY = toISODate(new Date());

const addDays = (isoDate, days) => {
    const date = new Date(isoDate);
    date.setDate(date.getDate() + days);
    return toISODate(date);
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) =>
    aStart < bEnd && aEnd > bStart;

const peso = (amount) =>
    `₱${Math.round(Number(amount) || 0).toLocaleString("en-PH")}`;

/*
 * Mirrors the server's availability rules (vehicleService.checkVehicleAvailability)
 * using only the data a public visitor can see: live status, the owner's
 * booking toggle, an "available from" date, and admin-set blocked ranges.
 */
const isVehicleAvailableForRange = (vehicle, pickup, ret) => {
    // Reserved or out on a rental can still be free for these dates; the
    // server's bulk booking check decides that.
    if (!isVehicleBookable(vehicle)) {
        return false;
    }

    const availability = vehicle?.availability ?? {};

    if (!pickup || !ret) {
        return true;
    }

    const start = new Date(pickup);
    const end = new Date(ret);

    if (
        availability.availableFrom &&
        new Date(availability.availableFrom) > start
    ) {
        return false;
    }

    // Still listed under maintenance, but not for dates inside it.
    if (overlapsVehicleMaintenance(vehicle, start, end)) {
        return false;
    }

    const blockedDates = availability.blockedDates ?? [];

    return !blockedDates.some((blocked) =>
        rangesOverlap(
            start,
            end,
            new Date(blocked.startDate),
            new Date(blocked.endDate)
        )
    );
};

const SORT_OPTIONS = [
    { value: "featured", label: "Featured first" },
    { value: "rating-desc", label: "Most rated" },
    { value: "bookings-desc", label: "Most bookings" },
    { value: "price-asc", label: "Price: Low to High" },
    { value: "price-desc", label: "Price: High to Low" },
    { value: "newest", label: "Recently added" },
];

/* -------------------------------------------------------------------------- */
/*  Animation variants                                                         */
/* -------------------------------------------------------------------------- */

const heroContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const heroItem = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: "easeOut" },
    },
};

const gridContainer = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.055 } },
};

const gridItem = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.4, ease: "easeOut" },
    },
};

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

const AvailableVehicles = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const reduceMotion = useReducedMotion();

    const [searchParams, setSearchParams] = useSearchParams();

    const {
        vehicles = [],
        loading = false,
        error = null,
    } = useSelector((state) => state.vehicles ?? {});

    const {
        vehicleCategories,
        getVehicleCategories,
    } = useVehicleCategory();

    /* --- filter state (seeded from the URL so hero search + links carry) --- */

    const [pickupDate, setPickupDate] = useState(
        searchParams.get("pickup") || TODAY
    );

    const [returnDate, setReturnDate] = useState(
        searchParams.get("return") || addDays(TODAY, 3)
    );

    const [category, setCategory] = useState(
        searchParams.get("category") || ""
    );

    const [vehicleType, setVehicleType] = useState(
        searchParams.get("type") || ""
    );

    const [seatRange, setSeatRange] = useState([2, 2]);
    const [seatRangeTouched, setSeatRangeTouched] = useState(false);

    const [sortBy, setSortBy] = useState("featured");

    const [priceRange, setPriceRange] = useState([0, 5000]);
    const [priceTouched, setPriceTouched] = useState(false);

    /*
     * The cheap client-side checks below (status/bookingEnabled/blockedDates)
     * can't see actual overlapping bookings - this holds the vehicle IDs the
     * server confirms are genuinely booked for the selected dates, fetched
     * in one bulk request rather than one per vehicle card.
     */
    const [conflictingVehicleIds, setConflictingVehicleIds] = useState(
        () => new Set()
    );

    useEffect(() => {
        dispatch(
            getVehicles({
                publicListing: true,
                status: BOOKABLE_VEHICLE_STATUS_FILTER,
                includeRatings: true,
                includeBookingCounts: true,
            })
        );
        getVehicleCategories();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    /* --- keep the URL in sync so the view is shareable --- */

    useEffect(() => {
        const next = {};
        if (pickupDate) next.pickup = pickupDate;
        if (returnDate) next.return = returnDate;
        if (category) next.category = category;
        if (vehicleType) next.type = vehicleType;

        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickupDate, returnDate, category, vehicleType]);

    /* --- derived data --- */

    const activeCategories = useMemo(
        () =>
            (vehicleCategories ?? [])
                .filter((item) => item.status === "Active")
                .sort(
                    (a, b) =>
                        (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
                ),
        [vehicleCategories]
    );

    const priceCeiling = useMemo(() => {
        const maxRate = vehicles.reduce(
            (max, vehicle) =>
                Math.max(
                    max,
                    getEffectiveDailyRate(vehicle) +
                    (Number(vehicle?.pricing?.reservationFee) || 0)
                ),
            0
        );

        if (!maxRate) {
            return 5000;
        }

        return Math.ceil(maxRate / 500) * 500;
    }, [vehicles]);

    const maxSeats = useMemo(
        () =>
            Math.max(
                2,
                ...vehicles
                    .map((vehicle) => Number(vehicle?.specifications?.seatingCapacity))
                    .filter((seats) => Number.isFinite(seats))
            ),
        [vehicles]
    );

    useEffect(() => {
        if (!seatRangeTouched) setSeatRange([2, maxSeats]);
    }, [maxSeats, seatRangeTouched]);

    useEffect(() => {
        if (!priceTouched) {
            setPriceRange([0, priceCeiling]);
        }
    }, [priceCeiling, priceTouched]);

    const dateError =
        pickupDate &&
        returnDate &&
        new Date(returnDate) <= new Date(pickupDate)
            ? "Return date must be after the pickup date."
            : "";

    useEffect(() => {
        if (dateError || !pickupDate || !returnDate || vehicles.length === 0) {
            setConflictingVehicleIds(new Set());
            return undefined;
        }

        let cancelled = false;

        checkVehiclesAvailabilityBulk(
            vehicles.map((vehicle) => vehicle._id),
            pickupDate,
            returnDate
        )
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setConflictingVehicleIds(
                    new Set(
                        response?.data?.unavailableVehicleIds ?? []
                    )
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setConflictingVehicleIds(new Set());
                }
            });

        return () => {
            cancelled = true;
        };
    }, [pickupDate, returnDate, dateError, vehicles]);

    const rentalDays = useMemo(() => {
        if (dateError || !pickupDate || !returnDate) {
            return 0;
        }

        const diff =
            (new Date(returnDate) - new Date(pickupDate)) /
            (1000 * 60 * 60 * 24);

        return Math.max(1, Math.round(diff));
    }, [pickupDate, returnDate, dateError]);

    const results = useMemo(() => {
        const filtered = vehicles.filter((vehicle) => {
            if (
                !isVehicleAvailableForRange(
                    vehicle,
                    dateError ? "" : pickupDate,
                    dateError ? "" : returnDate
                )
            ) {
                return false;
            }

            if (
                !dateError &&
                pickupDate &&
                returnDate &&
                conflictingVehicleIds.has(vehicle._id)
            ) {
                return false;
            }

            if (
                category &&
                (vehicle?.category?._id ?? vehicle?.category) !==
                    category
            ) {
                return false;
            }

            if (
                vehicleType &&
                vehicle?.vehicleType !== vehicleType
            ) {
                return false;
            }

            const seats = Number(vehicle?.specifications?.seatingCapacity);
            if (
                !Number.isFinite(seats) ||
                seats < seatRange[0] ||
                seats > seatRange[1]
            ) {
                return false;
            }

            const rate =
                getEffectiveDailyRate(vehicle) +
                (Number(vehicle?.pricing?.reservationFee) || 0);

            return (
                rate >= priceRange[0] && rate <= priceRange[1]
            );
        });

        const sorted = [...filtered];

        sorted.sort((a, b) => {
            if (sortBy === "rating-desc") {
                const ratingDifference =
                    (Number(b?.rating?.reviewCount) || 0) -
                    (Number(a?.rating?.reviewCount) || 0);
                if (ratingDifference !== 0) return ratingDifference;
                return (
                    (Number(b?.rating?.averageRating) || 0) -
                    (Number(a?.rating?.averageRating) || 0)
                );
            }

            if (sortBy === "bookings-desc") {
                const bookingDifference =
                    (Number(b?.bookingCount) || 0) -
                    (Number(a?.bookingCount) || 0);
                if (bookingDifference !== 0) return bookingDifference;
                return (
                    (Number(b?.rating?.averageRating) || 0) -
                    (Number(a?.rating?.averageRating) || 0)
                );
            }

            const rateA =
                getEffectiveDailyRate(a) +
                (Number(a?.pricing?.reservationFee) || 0);
            const rateB =
                getEffectiveDailyRate(b) +
                (Number(b?.pricing?.reservationFee) || 0);

            if (sortBy === "price-asc") return rateA - rateB;
            if (sortBy === "price-desc") return rateB - rateA;

            if (sortBy === "newest") {
                return (
                    new Date(b?.createdAt ?? 0) -
                    new Date(a?.createdAt ?? 0)
                );
            }

            const featuredA = a?.isFeatured ? 1 : 0;
            const featuredB = b?.isFeatured ? 1 : 0;

            if (featuredA !== featuredB) {
                return featuredB - featuredA;
            }

            return rateA - rateB;
        });

        return sorted;
    }, [
        vehicles,
        pickupDate,
        returnDate,
        dateError,
        conflictingVehicleIds,
        category,
        vehicleType,
        seatRange,
        priceRange,
        sortBy,
    ]);

    const averageRate = useMemo(() => {
        if (!results.length) return 0;

        const total = results.reduce(
            (sum, vehicle) =>
                sum +
                    getEffectiveDailyRate(vehicle) +
                    (Number(vehicle?.pricing?.reservationFee) || 0),
            0
        );

        return Math.round(total / results.length);
    }, [results]);

    const cheapestTripTotal = useMemo(() => {
        if (!results.length || rentalDays < 1) return 0;

        const cheapest = Math.min(
            ...results.map(
                (vehicle) =>
                    getEffectiveDailyRate(vehicle) * rentalDays +
                    (Number(vehicle?.pricing?.reservationFee) || 0)
            )
        );

        return Number.isFinite(cheapest)
            ? cheapest
            : 0;
    }, [results, rentalDays]);

    const categoryLabel = useMemo(
        () =>
            activeCategories.find(
                (item) => item._id === category
            )?.name ?? "",
        [activeCategories, category]
    );

    const dateRangeLabel = useMemo(() => {
        if (dateError || !pickupDate || !returnDate) {
            return "Select your travel dates";
        }

        const options = { month: "short", day: "numeric" };

        return `${new Date(pickupDate).toLocaleDateString(
            "en-PH",
            options
        )} – ${new Date(returnDate).toLocaleDateString(
            "en-PH",
            options
        )}`;
    }, [pickupDate, returnDate, dateError]);

    const hasActiveFilters =
        Boolean(category) ||
        Boolean(vehicleType) ||
        seatRangeTouched ||
        sortBy !== "featured" ||
        priceTouched;

    const clearPrice = () => {
        setPriceRange([0, priceCeiling]);
        setPriceTouched(false);
    };

    const resetFilters = () => {
        setCategory("");
        setVehicleType("");
        setSeatRange([2, maxSeats]);
        setSeatRangeTouched(false);
        setSortBy("featured");
        clearPrice();
    };

    const activeFilterChips = [
        category && {
            key: "category",
            label: categoryLabel || "Category",
            onClear: () => setCategory(""),
        },
        vehicleType && {
            key: "type",
            label: vehicleType === "Car" ? "Cars" : "Motorcycles",
            onClear: () => setVehicleType(""),
        },
        seatRangeTouched && {
            key: "seats",
            label: `${seatRange[0]}–${seatRange[1]} seats`,
            onClear: () => {
                setSeatRange([2, maxSeats]);
                setSeatRangeTouched(false);
            },
        },
        priceTouched && {
            key: "price",
            label: `${peso(priceRange[0])} – ${peso(priceRange[1])}${
                priceRange[1] >= priceCeiling ? "+" : ""
            }`,
            onClear: clearPrice,
        },
        sortBy !== "featured" && {
            key: "sort",
            label:
                SORT_OPTIONS.find((o) => o.value === sortBy)?.label ??
                "Sorted",
            onClear: () => setSortBy("featured"),
        },
    ].filter(Boolean);

    /* --- phones: the floating filter minimises into a summary pill --------- */

    const isPhone = useMediaQuery("(width < 40rem)");
    const [filterCollapsed, setFilterCollapsed] = useState(false);
    const showPill = isPhone && filterCollapsed;

    // The scroll handler reads this instead of the state.
    const filterCollapsedRef = useRef(filterCollapsed);

    useEffect(() => {
        filterCollapsedRef.current = filterCollapsed;
    }, [filterCollapsed]);

    const filterWrapperRef = useRef(null);
    const filterCardRef = useRef(null);
    const resultsStartRef = useRef(null);
    const filterDragControls = useDragControls();

    // Until when scrolling is our own height compensation, not the visitor.
    const compensatingUntilRef = useRef(0);

    // What the pill says: count, dates, then only the filters you changed.
    const pillItems = [
        `${results.length} ${results.length === 1 ? "vehicle" : "vehicles"}`,
        dateError || !pickupDate || !returnDate
            ? "Pick your dates"
            : dateRangeLabel,
        ...activeFilterChips.map((chip) => chip.label),
    ];

    /*
     * A date picker, dropdown or Seats/Price panel open in the card: never
     * minimise under it (its popover would lose its anchor).
     */
    const isUsingFilterCard = () => {
        const card = filterCardRef.current;

        return Boolean(
            card &&
                (card.contains(document.activeElement) ||
                    card.querySelector("details[open]") ||
                    document.querySelector('[role="listbox"]'))
        );
    };

    /*
     * Auto: open while you're above the results, minimised once you scroll
     * into them (only on crossing that line, so a card you opened yourself
     * stays open — until you scroll on a good way down again).
     */
    useEffect(() => {
        if (!isPhone) {
            setFilterCollapsed(false);
            return undefined;
        }

        let inResults = null;
        let openedAt = null;
        let frame = 0;

        const check = () => {
            frame = 0;

            const marker = resultsStartRef.current;

            if (!marker) return;

            // Our own scroll adjustment (card growing/shrinking): measure
            // the visitor's scrolling from here instead.
            if (performance.now() < compensatingUntilRef.current) {
                openedAt = window.scrollY;
                return;
            }

            const nowInResults =
                marker.getBoundingClientRect().top <
                window.innerHeight * 0.45;

            if (inResults === null) {
                inResults = nowInResults;
                setFilterCollapsed(nowInResults);
                return;
            }

            if (nowInResults !== inResults) {
                inResults = nowInResults;
                openedAt = null;

                if (!nowInResults || !isUsingFilterCard()) {
                    setFilterCollapsed(nowInResults);
                }

                return;
            }

            // Opened by hand inside the results: tuck away again after a
            // good scroll down.
            if (filterCollapsedRef.current || !nowInResults) {
                openedAt = null;
                return;
            }

            if (openedAt === null || window.scrollY < openedAt) {
                openedAt = window.scrollY;
                return;
            }

            if (
                window.scrollY - openedAt > 240 &&
                !isUsingFilterCard()
            ) {
                openedAt = null;
                setFilterCollapsed(true);
            }
        };

        const onScroll = () => {
            if (!frame) frame = requestAnimationFrame(check);
        };

        check();
        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [isPhone]);

    /*
     * The card sits in the page flow, so shrinking it to the pill (or
     * growing it back) while it's stuck under the navbar would shift the
     * vehicles under your finger — scroll by the same amount instead.
     */
    useEffect(() => {
        const wrapper = filterWrapperRef.current;

        if (!wrapper || !isPhone) return undefined;

        let previousHeight = wrapper.offsetHeight;

        const observer = new ResizeObserver(() => {
            const height = wrapper.offsetHeight;
            const delta = height - previousHeight;

            previousHeight = height;

            if (!delta) return;

            const stickyTop = parseFloat(
                getComputedStyle(wrapper).top
            );
            const isStuck =
                window.scrollY > 0 &&
                wrapper.getBoundingClientRect().top <= stickyTop + 1;

            if (isStuck) {
                compensatingUntilRef.current = performance.now() + 500;
                window.scrollBy(0, delta);
            }
        });

        observer.observe(wrapper);

        return () => observer.disconnect();
    }, [isPhone]);

    /* ---------------------------------------------------------------------- */

    return (
        <main className="bg-gray-50 dark:bg-gray-950">
            {/* ============================ HERO ============================ */}
            <section className="relative overflow-hidden bg-gradient-to-b from-yellow-50/70 via-white to-gray-50 dark:bg-none dark:bg-gray-950">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                >
                    <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-yellow-400/25 blur-3xl dark:bg-yellow-500/20" />
                    <div className="absolute -bottom-48 right-0 h-[26rem] w-[26rem] rounded-full bg-blue-400/10 blur-3xl dark:bg-blue-500/10" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.07)_1px,transparent_1px)]" />
                    <div className="absolute inset-0 hidden bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_55%)] dark:block" />
                    <LightTexture accent="yellow" />
                </div>

                <PageContainer className="relative z-10 pb-20 pt-24 sm:pb-28 sm:pt-32">
                    <motion.div
                        variants={heroContainer}
                        initial="hidden"
                        animate="visible"
                        className="max-w-2xl"
                    >
                        <motion.span
                            variants={heroItem}
                            className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-yellow-800 backdrop-blur-md dark:border-yellow-400/30 dark:bg-yellow-400/10 dark:text-yellow-300"
                        >
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-yellow-400" />
                            </span>
                            Real-time availability
                        </motion.span>

                        <motion.h1
                            variants={heroItem}
                            className="mt-5 text-[2.5rem] font-black leading-[1.03] tracking-tight text-gray-900 dark:text-white sm:text-[3.25rem]"
                        >
                            Vehicles ready for{" "}
                            <span className="relative whitespace-nowrap text-yellow-500 dark:text-yellow-400">
                                your dates
                                <svg
                                    aria-hidden="true"
                                    viewBox="0 0 300 10"
                                    preserveAspectRatio="none"
                                    className="absolute -bottom-1.5 left-0 h-2 w-full text-yellow-500/60 dark:text-yellow-400/50"
                                >
                                    <path
                                        d="M3 7 C 90 1.5, 210 1.5, 297 6"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </span>
                        </motion.h1>

                        <motion.p
                            variants={heroItem}
                            className="mt-5 max-w-xl text-sm leading-6 text-gray-600 dark:text-white/70 sm:text-base"
                        >
                            Set your pickup and return dates and a budget that
                            works for you — we&apos;ll show only the cars and
                            motorcycles that are actually free to rent across
                            Albay.
                        </motion.p>

                        <motion.div
                            variants={heroItem}
                            className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3"
                        >
                            <HeroStat
                                icon={CarFront}
                                value={
                                    loading ? (
                                        "…"
                                    ) : (
                                        <AnimatedCounter
                                            value={results.length}
                                        />
                                    )
                                }
                                label={
                                    loading
                                        ? "Checking the fleet"
                                        : "vehicles available"
                                }
                            />
                            <HeroStat
                                icon={CalendarRange}
                                value={
                                    rentalDays > 0
                                        ? `${rentalDays} ${
                                              rentalDays === 1
                                                  ? "day"
                                                  : "days"
                                          }`
                                        : "—"
                                }
                                label={dateRangeLabel}
                            />
                            <HeroStat
                                icon={Wallet}
                                value={
                                    cheapestTripTotal
                                        ? peso(cheapestTripTotal)
                                        : averageRate
                                        ? `${peso(averageRate)}/day`
                                        : "Any budget"
                                }
                                label={
                                    cheapestTripTotal
                                        ? "from · full trip"
                                        : "average daily rate"
                                }
                            />
                        </motion.div>
                    </motion.div>
                </PageContainer>
            </section>

            {/* ====================== FLOATING FILTER ====================== */}
            <motion.div
                ref={filterWrapperRef}
                initial={
                    reduceMotion ? false : { opacity: 0, y: 16 }
                }
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="sticky top-[4.75rem] z-40 mx-auto -mt-10 w-full max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:-mt-16 lg:px-8"
            >
                <AnimatePresence mode="wait" initial={false}>
                {showPill ? (
                    <FilterSummaryPill
                        key="filter-pill"
                        items={pillItems}
                        onExpand={() => setFilterCollapsed(false)}
                    />
                ) : (
                <motion.div
                    key="filter-card"
                    ref={filterCardRef}
                    drag={isPhone ? "y" : false}
                    dragControls={filterDragControls}
                    dragListener={false}
                    dragConstraints={{ top: 0, bottom: 0 }}
                    dragElastic={{ top: 0.35, bottom: 0.05 }}
                    dragSnapToOrigin
                    onDragEnd={(_event, info) => {
                        if (info.offset.y < -40 || info.velocity.y < -350) {
                            setFilterCollapsed(true);
                        }
                    }}
                    initial={isPhone ? { opacity: 0, scale: 0.97, y: -8 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -8 }}
                    transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-2xl shadow-gray-950/10 ring-1 ring-black/5 dark:border-gray-800 dark:bg-gray-900 dark:shadow-black/40 dark:ring-white/10 sm:p-4"
                >
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <Field icon={CalendarDays} label="Pick-up date">
                            <DatePicker
                                bare
                                label="Pick-up date"
                                placeholder="Add date"
                                min={TODAY}
                                value={pickupDate}
                                onChange={(event) => {
                                    const value = event.target.value;
                                    setPickupDate(value);
                                    if (
                                        returnDate &&
                                        new Date(returnDate) <=
                                            new Date(value)
                                    ) {
                                        setReturnDate(
                                            addDays(value, 3)
                                        );
                                    }
                                }}
                                className={controlClasses}
                            />
                        </Field>

                        <Field icon={CalendarCheck} label="Return date">
                            <DatePicker
                                bare
                                label="Return date"
                                placeholder="Add date"
                                min={
                                    pickupDate
                                        ? addDays(pickupDate, 1)
                                        : TODAY
                                }
                                value={returnDate}
                                onChange={(event) =>
                                    setReturnDate(event.target.value)
                                }
                                className={controlClasses}
                            />
                        </Field>

                        <Field icon={LayoutGrid} label="Category">
                            <Select
                                bare
                                aria-label="Category"
                                value={category}
                                onChange={(event) =>
                                    setCategory(event.target.value)
                                }
                                options={[
                                    { value: "", label: "All categories" },
                                    ...activeCategories.map((item) => ({
                                        value: item._id,
                                        label: item.name,
                                    })),
                                ]}
                                className={controlClasses}
                            />
                        </Field>

                        <Field icon={CarFront} label="Vehicle type">
                            <Select
                                bare
                                aria-label="Vehicle type"
                                value={vehicleType}
                                onChange={(event) =>
                                    setVehicleType(event.target.value)
                                }
                                options={VEHICLE_TYPE_FILTER_OPTIONS}
                                className={controlClasses}
                            />
                        </Field>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                        <details className="group relative">
                            <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-yellow-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                Seats
                                {seatRangeTouched && (
                                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">
                                        {seatRange[0]}–{seatRange[1]}
                                    </span>
                                )}
                            </summary>
                            <div className="absolute left-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:left-1/2 sm:-translate-x-1/2 dark:border-gray-700 dark:bg-gray-900">
                                <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200">
                                    <span>Number of seats</span>
                                    {seatRangeTouched && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSeatRange([2, maxSeats]);
                                                setSeatRangeTouched(false);
                                            }}
                                            className="text-yellow-700 hover:text-yellow-900 dark:text-yellow-400"
                                        >
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <PriceRangeSlider
                                    min={2}
                                    max={maxSeats}
                                    step={1}
                                    value={seatRange}
                                    formatValue={(seats) => `${seats} seats`}
                                    rangeLabel="seats"
                                    showMaxPlus={false}
                                    onChange={(next) => {
                                        setSeatRange(next);
                                        setSeatRangeTouched(true);
                                    }}
                                />
                            </div>
                        </details>

                        <details className="group relative">
                            <summary className="flex h-9 cursor-pointer list-none items-center rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:border-yellow-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                                Price / day
                                {priceTouched && (
                                    <span className="ml-1.5 text-gray-500 dark:text-gray-400">
                                        {peso(priceRange[0])}–{peso(priceRange[1])}
                                        {priceRange[1] >= priceCeiling ? "+" : ""}
                                    </span>
                                )}
                            </summary>
                            <div className="absolute right-0 z-50 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-4 shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2 dark:border-gray-700 dark:bg-gray-900">
                                <div className="mb-2 flex items-center justify-between text-xs font-bold text-gray-700 dark:text-gray-200">
                                    <span>Daily price range</span>
                                    {priceTouched && (
                                        <button type="button" onClick={clearPrice} className="text-yellow-700 hover:text-yellow-900 dark:text-yellow-400">
                                            Reset
                                        </button>
                                    )}
                                </div>
                                <PriceRangeSlider
                                    min={0}
                                    max={priceCeiling}
                                    step={100}
                                    value={priceRange}
                                    rangeLabel="daily rate"
                                    onChange={(next) => {
                                        setPriceRange(next);
                                        setPriceTouched(true);
                                    }}
                                />
                            </div>
                        </details>

                        <div className="flex min-w-[240px] flex-1 flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2.5 dark:border-gray-800 dark:bg-gray-800/50">
                            <div className="inline-flex items-baseline gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                                <AnimatedCounter
                                    value={results.length}
                                    duration={0.5}
                                    className="text-lg font-black text-gray-900 dark:text-white"
                                />
                                <span>
                                    {results.length === 1
                                        ? "vehicle for"
                                        : "vehicles for"}{" "}
                                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                                        {dateRangeLabel}
                                    </span>
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <Select
                                    bare
                                    aria-label="Sort results"
                                    value={sortBy}
                                    onChange={(event) =>
                                        setSortBy(event.target.value)
                                    }
                                    options={SORT_OPTIONS}
                                    className="rounded-lg border border-gray-300 bg-white py-1.5 pl-3 pr-2.5 text-sm font-semibold text-gray-800 transition focus-visible:border-yellow-500 focus-visible:ring-2 focus-visible:ring-yellow-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                />

                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    disabled={!hasActiveFilters}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
                                >
                                    <RotateCcw size={14} />
                                    <span className="hidden sm:inline">
                                        Reset
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <AnimatePresence>
                        {dateError && (
                            <motion.p
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2 px-1 text-xs font-medium text-red-600 dark:text-red-400"
                            >
                                {dateError}
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* Phones: swipe up here (or tap) to minimise. */}
                    {isPhone && (
                        <button
                            type="button"
                            onPointerDown={(event) =>
                                filterDragControls.start(event)
                            }
                            onClick={() => setFilterCollapsed(true)}
                            aria-label="Minimise filters"
                            style={{ touchAction: "none" }}
                            className="-mb-1.5 mt-2 flex w-full cursor-grab flex-col items-center gap-1 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 active:cursor-grabbing dark:text-gray-500"
                        >
                            <span className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
                            <span className="inline-flex items-center gap-1">
                                <ChevronUp size={12} />
                                Swipe up to minimise
                            </span>
                        </button>
                    )}
                </motion.div>
                )}
                </AnimatePresence>
            </motion.div>

            {/* =========================== RESULTS ========================== */}
            {/* Where "scrolled into the results" begins (phone filter pill). */}
            <div ref={resultsStartRef} aria-hidden="true" />

            <Section spacing="MD">
                <PageContainer>
                    {loading ? (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, index) => (
                                <VehicleCardSkeleton key={index} />
                            ))}
                        </div>
                    ) : error ? (
                        <EmptyState
                            icon={Search}
                            title="Unable to load vehicles"
                            description={
                                typeof error === "string"
                                    ? error
                                    : "Something went wrong while fetching available vehicles. Please try again."
                            }
                            action={
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        dispatch(
                                            getVehicles({
                                                publicListing: true,
                                                status: BOOKABLE_VEHICLE_STATUS_FILTER,
                                                includeRatings: true,
                                                includeBookingCounts: true,
                                            })
                                        )
                                    }
                                >
                                    Retry
                                </Button>
                            }
                        />
                    ) : results.length === 0 ? (
                        <EmptyState
                            icon={CalendarRange}
                            title="No vehicles free for these dates"
                            description="Try widening your budget, changing the category, or shifting your pickup and return dates."
                            action={
                                <div className="flex flex-wrap justify-center gap-3">
                                    {hasActiveFilters && (
                                        <Button
                                            variant="outline"
                                            onClick={resetFilters}
                                            leftIcon={
                                                <RotateCcw size={15} />
                                            }
                                        >
                                            Reset filters
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() =>
                                            navigate("/vehicles")
                                        }
                                        className="!bg-yellow-500 !text-gray-950 hover:!bg-yellow-400"
                                    >
                                        Browse full fleet
                                    </Button>
                                </div>
                            }
                        />
                    ) : (
                        <>
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-[1.7rem]">
                                        Available vehicles
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {results.length}{" "}
                                        {results.length === 1
                                            ? "ride is"
                                            : "rides are"}{" "}
                                        free for{" "}
                                        <span className="font-semibold text-gray-700 dark:text-gray-200">
                                            {dateRangeLabel}
                                        </span>
                                        {rentalDays > 0 &&
                                            ` · ${rentalDays} ${
                                                rentalDays === 1
                                                    ? "day"
                                                    : "days"
                                            }`}
                                    </p>
                                </div>

                                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                    Confirmed at checkout
                                </span>
                            </div>

                            <AnimatePresence initial={false}>
                                {activeFilterChips.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{
                                            opacity: 1,
                                            height: "auto",
                                        }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            {activeFilterChips.map(
                                                (chip) => (
                                                    <button
                                                        key={chip.key}
                                                        type="button"
                                                        onClick={
                                                            chip.onClear
                                                        }
                                                        className="group/chip inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1.5 pl-3 pr-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
                                                    >
                                                        {chip.label}
                                                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition group-hover/chip:bg-red-100 group-hover/chip:text-red-600 dark:bg-gray-800 dark:text-gray-400 dark:group-hover/chip:bg-red-950/50 dark:group-hover/chip:text-red-400">
                                                            <X size={11} />
                                                        </span>
                                                    </button>
                                                )
                                            )}

                                            <button
                                                type="button"
                                                onClick={resetFilters}
                                                className="text-xs font-semibold text-gray-400 underline-offset-2 transition hover:text-gray-700 hover:underline dark:hover:text-gray-200"
                                            >
                                                Clear all
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <motion.div
                                variants={gridContainer}
                                initial="hidden"
                                animate="visible"
                                className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
                            >
                                <AnimatePresence mode="popLayout">
                                    {results.map((vehicle) => (
                                        <motion.div
                                            key={
                                                vehicle._id ??
                                                vehicle.id
                                            }
                                            layout
                                            variants={gridItem}
                                            initial="hidden"
                                            animate="visible"
                                            exit={{
                                                opacity: 0,
                                                scale: 0.96,
                                            }}
                                            whileHover={
                                                reduceMotion
                                                    ? undefined
                                                    : { y: -6 }
                                            }
                                            transition={{
                                                duration: 0.3,
                                                ease: "easeOut",
                                            }}
                                            className="h-full min-w-0"
                                        >
                                            <AvailabilityVehicleCard
                                                vehicle={vehicle}
                                                rentalDays={rentalDays}
                                            />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.3 }}
                                transition={{ duration: 0.5 }}
                                className="relative mt-16 overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-yellow-50 to-white p-8 text-center shadow-sm dark:border-gray-800 dark:from-gray-900 dark:to-gray-950 sm:p-12"
                            >
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-yellow-400/20 blur-3xl dark:bg-yellow-500/15"
                                />
                                <h3 className="relative text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                                    Can&apos;t find the right fit?
                                </h3>
                                <p className="relative mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-white/70">
                                    Browse the complete fleet or reach out —
                                    we&apos;ll help you line up a vehicle for
                                    your trip.
                                </p>
                                <div className="relative mt-6 flex flex-wrap justify-center gap-3">
                                    <Button
                                        onClick={() =>
                                            navigate("/vehicles")
                                        }
                                        rightIcon={
                                            <ArrowRight size={15} />
                                        }
                                        className="!bg-yellow-500 !text-gray-950 hover:!bg-yellow-400"
                                    >
                                        View full fleet
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            navigate("/contact")
                                        }
                                        className="!border-gray-300 !bg-white !text-gray-800 hover:!bg-gray-100 dark:!border-white/25 dark:!bg-white/10 dark:!text-white dark:hover:!bg-white dark:hover:!text-gray-950"
                                    >
                                        Contact us
                                    </Button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </PageContainer>
            </Section>
        </main>
    );
};

/* -------------------------------------------------------------------------- */
/*  Building blocks                                                            */
/* -------------------------------------------------------------------------- */

const controlClasses =
    "mt-0.5 w-full bg-transparent text-sm font-semibold text-gray-900 outline-none dark:text-white";

const VEHICLE_TYPE_FILTER_OPTIONS = [
    { value: "", label: "All types" },
    { value: "Car", label: "Cars" },
    { value: "Motorcycle", label: "Motorcycles" },
];

const Field = ({ icon: Icon, label, children }) => (
    <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors focus-within:border-yellow-500 focus-within:ring-2 focus-within:ring-yellow-500/15 dark:border-gray-800 dark:bg-gray-800/50">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-400">
            <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {label}
            </span>
            {children}
        </div>
    </div>
);

const HeroStat = ({ icon: Icon, value, label }) => (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.06] dark:shadow-none">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-700 dark:bg-yellow-400/15 dark:text-yellow-400">
            <Icon size={17} />
        </span>
        <div className="min-w-0">
            <div className="truncate text-sm font-bold text-gray-900 dark:text-white">
                {value}
            </div>
            <div className="truncate text-[11px] text-gray-500 dark:text-white/55">
                {label}
            </div>
        </div>
    </div>
);

const VehicleCardSkeleton = () => (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="aspect-[16/10] w-full bg-gray-100 dark:bg-gray-800" />
        <div className="space-y-3 p-4">
            <div className="flex gap-3">
                <div className="h-3.5 w-14 rounded bg-gray-100 dark:bg-gray-800/70" />
                <div className="h-3.5 w-14 rounded bg-gray-100 dark:bg-gray-800/70" />
                <div className="h-3.5 w-14 rounded bg-gray-100 dark:bg-gray-800/70" />
            </div>
            <div className="mt-4 flex items-end justify-between border-t border-gray-100 pt-4 dark:border-gray-800">
                <div className="space-y-1.5">
                    <div className="h-6 w-24 rounded bg-gray-200 dark:bg-gray-800" />
                    <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800/70" />
                </div>
                <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-gray-800" />
            </div>
        </div>
    </div>
);

export default AvailableVehicles;
