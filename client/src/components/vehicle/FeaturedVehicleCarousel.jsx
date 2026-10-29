import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    ArrowRight,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Fuel,
    ImageOff,
    Settings2,
    Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { DEFAULT_SPRING } from "../../constants/animations";

import getVehicleCardData from "../../utils/getVehicleCardData";

import Badge from "../common/Badge";
import Button from "../common/Button";
import Modal from "../common/Modal";
import Price from "../common/Price";
import SwapLayer from "../common/SwapLayer";
import {
    BUTTON_SWAP,
    NUDGE_LEFT_SWAP,
    NUDGE_RIGHT_SWAP,
    RISE_SWAP,
    SLIDE_LEFT_SWAP,
    SLIDE_RIGHT_SWAP,
    ZOOM_SWAP,
} from "../../constants/swapAnimations";

import AvailabilityCalendar from "./AvailabilityCalendar";
import DiscountBadge from "./DiscountBadge";
import OriginalPrice from "./OriginalPrice";
import useTheme from "../../hooks/theme/useTheme";

const AUTOPLAY_INTERVAL = 6000;

// Minimum horizontal travel (px) for a touch to count as a swipe.
const SWIPE_THRESHOLD = 40;

const IMAGE_TRANSITION = {
    duration: 0.45,
    ease: "easeOut",
};

const TEXT_TRANSITION = {
    duration: 0.18,
    ease: "easeOut",
};

const getId = (vehicle) =>
    vehicle?._id ?? vehicle?.id;

/*
 * `hidden` (from FeaturedVehiclesSection, while the showcase is scrolled out
 * of view) plays every piece's exit; clearing it plays the entrances:
 *   left column  — slides out left / back in, top to bottom
 *   next vehicle — slides out right / back in
 *   image stage  — recedes and zooms back up; the arrows nudge out sideways
 *   price, dots  — sink and rise back
 *   buttons      — the hero buttons' shrink-out / pop-in (BUTTON_SWAP)
 */
const FeaturedVehicleCarousel = ({
    vehicles = [],
    hidden = false,
}) => {
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    /* Admin → Themes & Display → "Featured image frame". On: glass frame
       shown, model-name watermark hidden. Off: frame invisible (its box
       stays, so nothing shifts) and the watermark shows instead. */
    const { showFeaturedImageFrame = true } = useTheme();
    const frameFade = `transition-opacity duration-500 ${
        showFeaturedImageFrame ? "opacity-100" : "opacity-0"
    }`;
    const [datesVehicle, setDatesVehicle] = useState(null);

    const total = vehicles.length;

    const goNext = useCallback(() => {
        if (total <= 1) {
            return;
        }

        setIndex(
            (current) => (current + 1) % total
        );
    }, [total]);

    const goPrev = useCallback(() => {
        if (total <= 1) {
            return;
        }

        setIndex(
            (current) =>
                (current - 1 + total) % total
        );
    }, [total]);

    /*
     * One timeout per slide, re-armed whenever the slide changes — so after
     * a click, tap or swipe the visitor gets a full interval on the vehicle
     * they picked instead of the old interval firing moments later. Paused
     * while hovered (mouse only) or while the dates modal is open.
     */
    const autoplayStopped =
        total <= 1 ||
        isPaused ||
        Boolean(datesVehicle);

    useEffect(() => {
        if (autoplayStopped) {
            return undefined;
        }

        const timer = setTimeout(
            goNext,
            AUTOPLAY_INTERVAL
        );

        return () => clearTimeout(timer);
    }, [goNext, autoplayStopped, index]);

    /*
     * Hover-pause only for a real mouse. Touch browsers fire a synthetic
     * mouseenter on tap with no matching mouseleave, which used to stop
     * autoplay for good after the first tap on a phone.
     */
    const handlePointerEnter = (event) => {
        if (event.pointerType === "mouse") {
            setIsPaused(true);
        }
    };

    const handlePointerLeave = (event) => {
        if (event.pointerType === "mouse") {
            setIsPaused(false);
        }
    };

    // Horizontal swipe on the image changes the vehicle on touch screens.
    const swipeStart = useRef(null);

    const handleTouchStart = (event) => {
        const touch = event.touches[0];

        swipeStart.current = touch
            ? { x: touch.clientX, y: touch.clientY }
            : null;
    };

    const handleTouchEnd = (event) => {
        const start = swipeStart.current;
        const touch = event.changedTouches[0];

        swipeStart.current = null;

        if (!start || !touch) {
            return;
        }

        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;

        // Ignore taps and mostly-vertical scrolls.
        if (
            Math.abs(deltaX) < SWIPE_THRESHOLD ||
            Math.abs(deltaX) < Math.abs(deltaY)
        ) {
            return;
        }

        if (deltaX < 0) {
            goNext();
        } else {
            goPrev();
        }
    };

    useEffect(() => {
        if (index >= total && total > 0) {
            setIndex(0);
        }
    }, [total, index]);

    if (total === 0) {
        return null;
    }

    const centerVehicle = vehicles[index];

    const rightVehicle =
        total > 1
            ? vehicles[(index + 1) % total]
            : null;

    const item = getVehicleCardData(centerVehicle);

    return (
        <div
            className="
                relative
                w-full
                min-w-0
            "
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
        >
            {/* =========================================================
                MAIN CAROUSEL LAYOUT

                Desktop:
                left information | main vehicle | next vehicle

                Grid prevents the three areas from fighting for width.
            ========================================================== */}
            <div
                className="
                    grid
                    w-full
                    min-w-0
                    grid-cols-1
                    items-center
                    gap-8
                    lg:grid-cols-[210px_minmax(0,1fr)_190px]
                    lg:gap-6
                "
            >
                {/* =====================================================
                    LEFT VEHICLE INFORMATION
                ====================================================== */}
                <div
                    className="
                        order-1
                        min-w-0
                        text-center
                        lg:order-none
                        lg:w-full
                        lg:pl-3
                        lg:text-left
                    "
                >
                    <SwapLayer
                        swap={SLIDE_LEFT_SWAP}
                        hidden={hidden}
                    >
                    <AnimatePresence
                        mode="wait"
                        initial={false}
                    >
                        <motion.p
                            key={item.id}
                            initial={{
                                opacity: 0,
                                y: 8,
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                            }}
                            exit={{
                                opacity: 0,
                                y: -8,
                            }}
                            transition={TEXT_TRANSITION}
                            className="
                                text-xs
                                font-bold
                                uppercase
                                tracking-[0.3em]
                                text-gray-400
                                dark:text-gray-500
                            "
                        >
                            {item.brand || "—"}
                        </motion.p>
                    </AnimatePresence>

                    <AnimatePresence
                        mode="wait"
                        initial={false}
                    >
                        <motion.h2
                            key={item.id}
                            initial={{
                                opacity: 0,
                                y: 8,
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                            }}
                            exit={{
                                opacity: 0,
                                y: -8,
                            }}
                            transition={TEXT_TRANSITION}
                            className="
                                mt-1
                                text-4xl
                                font-black
                                leading-[0.95]
                                tracking-tight
                                text-gray-900
                                dark:text-white
                                sm:text-5xl
                            "
                        >
                            {item.model || item.name}
                        </motion.h2>
                    </AnimatePresence>
                    </SwapLayer>

                    <SwapLayer
                        as="p"
                        swap={SLIDE_LEFT_SWAP}
                        hidden={hidden}
                        delay={0.06}
                        className="
                            mx-auto
                            mt-3
                            max-w-[220px]
                            text-sm
                            leading-6
                            text-gray-500
                            dark:text-gray-400
                            lg:mx-0
                            lg:max-w-none
                        "
                    >
                        {item.vehicleType}. {item.transmission}.{" "}
                        Ready for your next trip.
                    </SwapLayer>

                    <SwapLayer
                        swap={SLIDE_LEFT_SWAP}
                        hidden={hidden}
                        delay={0.12}
                        className="
                            mt-4
                            flex
                            flex-col
                            items-center
                            gap-1.5
                            text-sm
                            font-medium
                            text-gray-700
                            dark:text-gray-300
                            lg:items-start
                        "
                    >
                        <span className="flex items-center gap-2">
                            <Users size={16} />
                            {item.seats} Seats
                        </span>

                        <span className="flex items-center gap-2">
                            <Settings2 size={16} />
                            {item.transmission}
                        </span>

                        <span className="flex items-center gap-2">
                            <Fuel size={16} />
                            {item.fuelType}
                        </span>
                    </SwapLayer>

                    {item.featured && (
                        <SwapLayer
                            swap={SLIDE_LEFT_SWAP}
                            hidden={hidden}
                            delay={0.18}
                            className="
                                mt-4
                                flex
                                justify-center
                                lg:justify-start
                            "
                        >
                            <Badge variant="warning">
                                Featured
                            </Badge>
                        </SwapLayer>
                    )}
                </div>

                {/* =====================================================
                    CENTER VEHICLE AREA
                ====================================================== */}
                <div
                    className="
                        order-2
                        flex
                        min-w-0
                        w-full
                        flex-col
                        items-center
                        gap-5
                        lg:order-none
                    "
                >
                    {/* =================================================
                        IMAGE ROW
                    ================================================== */}
                    <div
                        className="
                            flex
                            w-full
                            min-w-0
                            items-center
                            justify-center
                            gap-2
                            sm:gap-3
                        "
                    >
                        {/* Previous button */}
                        {total > 1 && (
                            <SwapLayer
                                swap={NUDGE_LEFT_SWAP}
                                hidden={hidden}
                                delay={0.2}
                                className="z-30 shrink-0"
                            >
                            <motion.button
                                type="button"
                                onClick={goPrev}
                                aria-label="Previous vehicle"
                                whileHover={{
                                    scale: 1.08,
                                }}
                                whileTap={{
                                    scale: 0.92,
                                }}
                                transition={DEFAULT_SPRING}
                                className="
                                    z-30
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    border
                                    border-gray-200
                                    bg-white
                                    text-gray-500
                                    shadow-md
                                    transition-colors
                                    hover:border-gray-300
                                    hover:text-gray-900
                                    dark:border-gray-700
                                    dark:bg-gray-900
                                    dark:text-gray-400
                                    dark:hover:border-gray-600
                                    dark:hover:text-white
                                "
                            >
                                <ChevronLeft size={18} />
                            </motion.button>
                            </SwapLayer>
                        )}

                        {/* =================================================
                            IMAGE VIEWPORT
                        ================================================== */}
                        <SwapLayer
                            swap={ZOOM_SWAP}
                            hidden={hidden}
                            delay={0.05}
                            onTouchStart={handleTouchStart}
                            onTouchEnd={handleTouchEnd}
                            className="
                                relative
                                flex
                                min-w-0
                                flex-1
                                touch-pan-y
                                items-center
                                justify-center
                                overflow-hidden
                            "
                        >
                            {/* Small vehicle watermark — only while the frame is off */}
                            <div
                                aria-hidden="true"
                                className={`pointer-events-none absolute inset-0 z-0 transition-opacity duration-500 ${
                                    showFeaturedImageFrame
                                        ? "opacity-0"
                                        : "opacity-100"
                                }`}
                            >
                            <AnimatePresence
                                mode="wait"
                                initial={false}
                            >
                                <motion.span
                                    key={item.id}
                                    aria-hidden="true"
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
                                        duration: 0.6,
                                        ease: "easeOut",
                                    }}
                                    className="
                                        pointer-events-none
                                        absolute
                                        inset-0
                                        z-0
                                        flex
                                        items-center
                                        justify-center
                                        overflow-hidden
                                        px-3
                                        text-center
                                        text-[3rem]
                                        font-black
                                        uppercase
                                        leading-none
                                        tracking-[-0.05em]
                                        text-gray-900/[0.12]
                                        sm:text-[4.5rem]
                                        lg:text-[6rem]
                                        dark:text-white/[0.11]
                                    "
                                >
                                    {item.model || item.name}
                                </motion.span>
                            </AnimatePresence>
                            </div>

                            {/* Ground shadow */}
                            <div
                                aria-hidden="true"
                                className="
                                    pointer-events-none
                                    absolute
                                    bottom-3
                                    left-1/2
                                    z-0
                                    h-5
                                    w-2/3
                                    -translate-x-1/2
                                    rounded-full
                                    bg-black/15
                                    blur-xl
                                    dark:bg-black/40
                                "
                            />

                            {/* =================================================
                                FIXED IMAGE CONTAINER

                                This is ONLY for the vehicle image.
                            ================================================== */}
                            <motion.div
                                whileHover={{
                                    scale: 1.015,
                                }}
                                transition={DEFAULT_SPRING}
                                className={`
                                    relative
                                    z-10
                                    flex
                                    h-[230px]
                                    w-full
                                    max-w-[420px]
                                    shrink-0
                                    items-center
                                    justify-center
                                    overflow-hidden
                                    rounded-3xl
                                    border
                                    transition-[background-color,border-color,box-shadow,backdrop-filter]
                                    duration-500
                                    sm:h-[260px]
                                    sm:max-w-[480px]
                                    lg:h-[285px]
                                    lg:max-w-[500px]
                                    ${
                                        showFeaturedImageFrame
                                            ? "border-gray-200/70 bg-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ring-1 ring-gray-900/[0.025] backdrop-blur-[2px] dark:border-gray-700/70 dark:bg-gray-900/20 dark:ring-white/[0.025]"
                                            : "border-transparent bg-transparent shadow-none ring-0"
                                    }
                                `}
                            >
                                {/* Subtle image texture */}
                                <div
                                    aria-hidden="true"
                                    className={`
                                        pointer-events-none
                                        absolute
                                        inset-0
                                        transition-opacity
                                        duration-500
                                        ${
                                            showFeaturedImageFrame
                                                ? "opacity-60 dark:opacity-25"
                                                : "opacity-0"
                                        }
                                    `}
                                    style={{
                                        backgroundImage:
                                            "radial-gradient(circle at 1px 1px, rgba(59,130,246,0.16) 1px, transparent 0)",
                                        backgroundSize:
                                            "24px 24px",
                                    }}
                                />

                                {/* Image glow */}
                                <div
                                    aria-hidden="true"
                                    className={`
                                        pointer-events-none
                                        absolute
                                        left-1/2
                                        top-1/2
                                        h-36
                                        w-3/4
                                        -translate-x-1/2
                                        -translate-y-1/2
                                        rounded-full
                                        bg-blue-500/10
                                        blur-3xl
                                        dark:bg-blue-500/10
                                        ${frameFade}
                                    `}
                                />

                                {/* =================================================
                                    ACTUAL VEHICLE IMAGE
                                ================================================== */}
                                <div
                                    className="
                                        relative
                                        flex
                                        h-full
                                        w-full
                                        items-center
                                        justify-center
                                        overflow-hidden
                                        px-4
                                        py-4
                                        sm:px-6
                                        lg:px-8
                                    "
                                >
                                    <AnimatePresence
                                        mode="wait"
                                        initial={false}
                                    >
                                        {item.image ? (
                                            <motion.img
                                                key={item.id}
                                                src={item.image}
                                                alt={item.name}
                                                initial={{
                                                    opacity: 0,
                                                    scale: 0.92,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: 1,
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    scale: 0.92,
                                                }}
                                                transition={
                                                    IMAGE_TRANSITION
                                                }
                                                className="
                                                    relative
                                                    z-10
                                                    block
                                                    h-auto
                                                    w-auto
                                                    max-h-[88%]
                                                    max-w-[94%]
                                                    rounded-2xl
                                                    object-contain
                                                    object-center
                                                    select-none
                                                    drop-shadow-2xl
                                                "
                                            />
                                        ) : (
                                            <motion.div
                                                key={`${item.id}-empty`}
                                                initial={{
                                                    opacity: 0,
                                                    scale: 0.92,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: 1,
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    scale: 0.92,
                                                }}
                                                transition={
                                                    IMAGE_TRANSITION
                                                }
                                                className="
                                                    flex
                                                    h-full
                                                    w-full
                                                    items-center
                                                    justify-center
                                                "
                                            >
                                                <div
                                                    className="
                                                        flex
                                                        flex-col
                                                        items-center
                                                        justify-center
                                                        gap-2
                                                        text-gray-400
                                                        dark:text-gray-600
                                                    "
                                                >
                                                    <ImageOff
                                                        size={36}
                                                        strokeWidth={
                                                            1.5
                                                        }
                                                    />

                                                    <span className="text-sm font-medium">
                                                        No Image
                                                    </span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Corner accents */}
                                <span
                                    aria-hidden="true"
                                    className={`
                                        pointer-events-none
                                        absolute
                                        left-3
                                        top-3
                                        h-5
                                        w-5
                                        border-l
                                        border-t
                                        border-blue-400/35
                                        ${frameFade}
                                    `}
                                />

                                <span
                                    aria-hidden="true"
                                    className={`
                                        pointer-events-none
                                        absolute
                                        right-3
                                        top-3
                                        h-5
                                        w-5
                                        border-r
                                        border-t
                                        border-blue-400/35
                                        ${frameFade}
                                    `}
                                />

                                <span
                                    aria-hidden="true"
                                    className={`
                                        pointer-events-none
                                        absolute
                                        bottom-3
                                        left-3
                                        h-5
                                        w-5
                                        border-b
                                        border-l
                                        border-blue-400/35
                                        ${frameFade}
                                    `}
                                />

                                <span
                                    aria-hidden="true"
                                    className={`
                                        pointer-events-none
                                        absolute
                                        bottom-3
                                        right-3
                                        h-5
                                        w-5
                                        border-b
                                        border-r
                                        border-blue-400/35
                                        ${frameFade}
                                    `}
                                />
                            </motion.div>
                        </SwapLayer>

                        {/* Next button */}
                        {total > 1 && (
                            <SwapLayer
                                swap={NUDGE_RIGHT_SWAP}
                                hidden={hidden}
                                delay={0.2}
                                className="z-30 shrink-0"
                            >
                            <motion.button
                                type="button"
                                onClick={goNext}
                                aria-label="Next vehicle"
                                whileHover={{
                                    scale: 1.08,
                                }}
                                whileTap={{
                                    scale: 0.92,
                                }}
                                transition={DEFAULT_SPRING}
                                className="
                                    z-30
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    border
                                    border-gray-200
                                    bg-white
                                    text-gray-500
                                    shadow-md
                                    transition-colors
                                    hover:border-gray-300
                                    hover:text-gray-900
                                    dark:border-gray-700
                                    dark:bg-gray-900
                                    dark:text-gray-400
                                    dark:hover:border-gray-600
                                    dark:hover:text-white
                                "
                            >
                                <ChevronRight size={18} />
                            </motion.button>
                            </SwapLayer>
                        )}
                    </div>

                    {/* =================================================
                        PRICE
                    ================================================== */}
                    <div
                        className="
                            flex
                            flex-col
                            items-center
                            gap-4
                        "
                    >
                        <SwapLayer
                            swap={RISE_SWAP}
                            hidden={hidden}
                            delay={0.15}
                        >
                        <AnimatePresence
                            mode="wait"
                            initial={false}
                        >
                            <motion.div
                                key={item.id}
                                initial={{
                                    opacity: 0,
                                    y: 8,
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                }}
                                exit={{
                                    opacity: 0,
                                    y: -8,
                                }}
                                transition={TEXT_TRANSITION}
                                className="
                                    flex
                                    flex-col
                                    items-start
                                "
                            >
                                {item.activeDiscount && (
                                    <div className="mb-1.5 flex items-center gap-2">
                                        <DiscountBadge
                                            discount={item.activeDiscount}
                                            size="md"
                                        />
                                        <OriginalPrice
                                            discount={item.activeDiscount}
                                            reservationFee={item.reservationFee}
                                            className="text-base"
                                        />
                                    </div>
                                )}

                                <div className="flex items-baseline gap-1.5">
                                <Price
                                    value={Number(item.effectiveDailyRate) + Number(item.reservationFee || 0)}
                                    className="
                                        text-3xl
                                        font-black
                                        tracking-tight
                                        text-gray-900
                                        dark:text-white
                                    "
                                />

                                <span
                                    className="
                                        text-sm
                                        font-semibold
                                        uppercase
                                        tracking-wide
                                        text-gray-400
                                        dark:text-gray-500
                                    "
                                >
                                    /day
                                </span>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                        </SwapLayer>

                        {/* =================================================
                            ACTIONS
                        ================================================== */}
                        <div
                            className="
                                flex
                                flex-wrap
                                items-center
                                justify-center
                                gap-3
                            "
                        >
                            <SwapLayer
                                swap={BUTTON_SWAP}
                                hidden={hidden}
                            >
                            <Link
                                to={`/vehicles/${item.id}`}
                            >
                                <Button
                                    variant="primary"
                                    size="md"
                                    rightIcon={
                                        <ArrowRight
                                            size={16}
                                        />
                                    }
                                    className="
                                        rounded-full
                                        px-6
                                        shadow-lg
                                        shadow-blue-600/20
                                    "
                                >
                                    View Details
                                </Button>
                            </Link>
                            </SwapLayer>

                            <SwapLayer
                                swap={BUTTON_SWAP}
                                hidden={hidden}
                                delay={0.08}
                            >
                            <Button
                                type="button"
                                variant="outline"
                                size="md"
                                onClick={() =>
                                    setDatesVehicle(
                                        centerVehicle
                                    )
                                }
                                leftIcon={
                                    <CalendarDays
                                        size={16}
                                    />
                                }
                                className="
                                    rounded-full
                                    px-6
                                    shadow-lg
                                "
                            >
                                Available Dates
                            </Button>
                            </SwapLayer>
                        </div>
                    </div>
                </div>

                {/* =====================================================
                    RIGHT / NEXT VEHICLE
                ====================================================== */}
                {rightVehicle && (
                    <SwapLayer
                        swap={SLIDE_RIGHT_SWAP}
                        hidden={hidden}
                        delay={0.1}
                        className="
                            order-3
                            flex
                            min-w-0
                            w-full
                            items-center
                            justify-center
                            lg:order-none
                            lg:w-full
                            lg:self-center
                        "
                    >
                        <button
                            type="button"
                            onClick={goNext}
                            aria-label={`Show ${
                                getVehicleCardData(
                                    rightVehicle
                                ).name
                            }`}
                            className="
                                flex
                                w-full
                                items-center
                                justify-center
                            "
                        >
                            <div
                                className="
                                    flex
                                    flex-col
                                    items-center
                                    gap-2
                                "
                            >
                                <span
                                    className="
                                        text-[10px]
                                        font-bold
                                        uppercase
                                        tracking-[0.24em]
                                        text-gray-400
                                        dark:text-gray-500
                                    "
                                >
                                    Next Vehicle
                                </span>

                                <SidePreview
                                    vehicle={rightVehicle}
                                />
                            </div>
                        </button>
                    </SwapLayer>
                )}
            </div>

            {/* =============================================================
                CAROUSEL INDICATORS
            ============================================================= */}
            {total > 1 && (
                <SwapLayer
                    swap={RISE_SWAP}
                    hidden={hidden}
                    delay={0.3}
                    className="
                        mt-7
                        flex
                        items-center
                        justify-center
                        gap-2
                    "
                >
                    {vehicles.map(
                        (vehicle, position) => (
                            <button
                                key={getId(vehicle)}
                                type="button"
                                onClick={() =>
                                    setIndex(position)
                                }
                                aria-label={`Go to vehicle ${
                                    position + 1
                                }`}
                                className={[
                                    "h-2",
                                    "rounded-full",
                                    "transition-all",
                                    "duration-300",
                                    position === index
                                        ? "w-6 bg-blue-600 dark:bg-blue-500"
                                        : "w-2 bg-gray-300 hover:bg-gray-400 dark:bg-gray-700 dark:hover:bg-gray-600",
                                ].join(" ")}
                            />
                        )
                    )}
                </SwapLayer>
            )}

            {/* =============================================================
                AVAILABLE DATES MODAL
            ============================================================= */}
            <Modal
                isOpen={Boolean(datesVehicle)}
                onClose={() => {
                    setDatesVehicle(null);
                    // The pointer may have left via the modal, whose leave
                    // event never reaches the carousel — don't stay paused.
                    setIsPaused(false);
                }}
                title={
                    datesVehicle
                        ? `Available Dates — ${
                              getVehicleCardData(
                                  datesVehicle
                              ).name
                          }`
                        : "Available Dates"
                }
                size="lg"
            >
                {datesVehicle && (
                    <AvailabilityCalendar
                        vehicleId={getId(datesVehicle)}
                    />
                )}
            </Modal>
        </div>
    );
};

/* =========================================================================
   SIDE PREVIEW
========================================================================= */

const SidePreview = ({ vehicle }) => {
    const item = getVehicleCardData(vehicle);

    return (
        <motion.div
            initial={{
                opacity: 0,
                scale: 0.9,
            }}
            animate={{
                opacity: 0.65,
                scale: 0.94,
            }}
            whileHover={{
                opacity: 0.95,
                scale: 0.98,
            }}
            transition={IMAGE_TRANSITION}
            className="
                flex
                w-[165px]
                flex-col
                items-center
                gap-3
                lg:w-[165px]
            "
        >
            {/* Preview image container */}
            <div
                className="
                    aspect-[4/3]
                    w-full
                    overflow-hidden
                    rounded-3xl
                    border
                    border-gray-200/60
                    bg-white/45
                    shadow-sm
                    dark:border-gray-700/60
                    dark:bg-gray-900/40
                "
            >
                {item.image ? (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="
                            h-full
                            w-full
                            object-contain
                            p-3
                        "
                    />
                ) : (
                    <div
                        className="
                            flex
                            h-full
                            items-center
                            justify-center
                            bg-gray-100
                            text-gray-300
                            dark:bg-gray-900
                            dark:text-gray-700
                        "
                    >
                        <ImageOff
                            size={22}
                            strokeWidth={1.5}
                        />
                    </div>
                )}
            </div>

            <p
                className="
                    max-w-full
                    truncate
                    text-sm
                    font-semibold
                    text-gray-500
                    dark:text-gray-500
                "
            >
                {item.name}
            </p>
        </motion.div>
    );
};

export default FeaturedVehicleCarousel;
