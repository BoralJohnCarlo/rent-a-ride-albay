import {
    motion,
    useMotionValueEvent,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion";

import defaultHeroVideo from "../../assets/videos/hero-video.mp4";
import defaultHeroImage from "../../assets/images/hero/DefaultHeroImage.png";

import {
    ArrowRight,
    CheckCircle,
    ChevronDown,
    Heart,
    MapPin,
    ShieldCheck,
} from "lucide-react";
import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Link } from "react-router-dom";

import Button from "../common/Button";
import SwapLayer from "../common/SwapLayer";
import { BUTTON_SWAP } from "../../constants/swapAnimations";
import PageContainer from "./PageContainer";
import Section from "./Section";

import useAuth from "../../hooks/auth/useAuth";
import useVehicleCategory from "../../hooks/categories";
import useTheme from "../../hooks/theme/useTheme";
import AlbayHeroWidget from "../explore/AlbayHeroWidget";
import HeroSearchBar from "./HeroSearchBar";
import { HERO_RIBBON_PATH, HERO_WAVE_EDGE } from "./heroRibbon";

const containerVariants = {
    hidden: {},

    visible: {
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: {
        opacity: 0,
        y: 18,
    },

    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: "easeOut",
        },
    },
};

/* Same feel as the Albay widget's exit, so everything glides together. */
const EXIT_SPRING = { stiffness: 260, damping: 32, mass: 0.6 };

/*
 * Scroll-linked exits. Ranges are fractions of the hero's height scrolled
 * past (so short and tall screens get the same choreography), finishing
 * before a piece would slide under the navbar. Being scroll-scrubbed, they
 * play back in reverse when scrolling up. Meanwhile the Albay widget slides
 * out right.
 *   badge    — floats up and shrinks
 *   trust    — drop away one at a time: Verified Owners, Based in Albay,
 *              Quality Vehicles (so they come back in the opposite order)
 *   search   — waits for the trust row, then recedes (HeroSearchBar)
 * The headline, paragraph and buttons aren't scrubbed — see SWAPS.
 */
const EXITS = {
    hint: { range: [0, 0.1], move: { y: 14, fadeFrom: 0 } },
    badge: { range: [0, 0.1], move: { y: -16, scale: 0.85, fadeFrom: 0 } },
    trustLeft: { range: [0.04, 0.14], move: { y: 24, fadeFrom: 0 } },
    trustMid: { range: [0.14, 0.24], move: { y: 24, fadeFrom: 0 } },
    trustRight: { range: [0.24, 0.34], move: { y: 24, fadeFrom: 0 } },
    search: { range: [0.34, 0.6] },
};

/* Scroll past these fractions of the hero and those pieces play their
   SWAPS "out"; scroll back above and they play "in". */
const COPY_HIDE_AT = 0.06;
const BUTTONS_HIDE_AT = 0.12;

const HEADLINE_SWAP = { duration: 0.32, ease: "easeOut" };
const COPY_SWAP = { duration: 0.18, ease: "easeOut" };

/*
 * Played when a scroll threshold is crossed (SwapLayer presets).
 *   copy     — BaseNavbar's (admin navbar) page-title swap, exactly: leaves
 *              fading upward, comes back fading in from below.
 *   headline — the same swap scaled for 60px type (8px over 0.18s is lost
 *              on it mid-scroll); the paragraph waits for it to finish.
 *   button   — the shared BUTTON_SWAP (also used by the featured section).
 */
const SWAPS = {
    headline: {
        out: [{ opacity: 0, y: -24 }, HEADLINE_SWAP],
        in: [{ opacity: [0, 1], y: [24, 0] }, HEADLINE_SWAP],
    },
    copy: {
        out: [
            { opacity: 0, y: -8 },
            { ...COPY_SWAP, delay: HEADLINE_SWAP.duration },
        ],
        in: [
            { opacity: [0, 1], y: [8, 0] },
            { ...COPY_SWAP, delay: HEADLINE_SWAP.duration },
        ],
    },
    button: BUTTON_SWAP,
};

/* Springed 0 → 1 progress of one exit (clamped to its scroll range). */
const useExitProgress = (heroProgress, [start, end]) =>
    useSpring(
        useTransform(heroProgress, [start, end], [0, 1]),
        EXIT_SPRING
    );

/*
 * Wraps one hero piece in its exit. Carries only the exit's transform and
 * opacity, so a piece's entrance animation goes on a parent or a child and
 * the two never fight. Static under reduced motion.
 */
const ExitLayer = ({
    progress,
    x = 0,
    y = 0,
    scale = 1,
    fadeFrom = 0.35,
    className = "",
    children,
}) => {
    const reduceMotion = useReducedMotion();

    const exitX = useTransform(progress, [0, 1], [0, x]);
    const exitY = useTransform(progress, [0, 1], [0, y]);
    const exitScale = useTransform(progress, [0, 1], [1, scale]);
    const exitOpacity = useTransform(progress, [fadeFrom, 1], [1, 0]);

    return (
        <motion.div
            className={className}
            style={
                reduceMotion
                    ? undefined
                    : {
                          x: exitX,
                          y: exitY,
                          scale: exitScale,
                          opacity: exitOpacity,
                      }
            }
        >
            {children}
        </motion.div>
    );
};

const HeroSection = () => {
    /* Admin-configurable background (Settings → Themes & Display).
       undefined = not known yet on this device → render no video rather
       than flash the default and swap; null = the bundled default. A custom
       video that fails to load falls back to the default. */
    const { heroVideoUrl, heroMediaType, heroImageUrl } = useTheme();

    // Signed-in customers can't use /register-operator (guest-only — it
    // just bounces them back here), so the second button swaps to
    // something that actually does something for them.
    const { isAuthenticated } = useAuth();

    const reduceMotion = useReducedMotion();
    /* 0 → 1 as the hero scrolls up past the top of the viewport. Measured
       on the background layer, which always spans the whole hero. */
    const heroRef = useRef(null);
    const { scrollYProgress: heroProgress } = useScroll({
        target: heroRef,
        offset: ["start start", "end start"],
    });
    const exit = {
        hint: useExitProgress(heroProgress, EXITS.hint.range),
        badge: useExitProgress(heroProgress, EXITS.badge.range),
        search: useExitProgress(heroProgress, EXITS.search.range),
        trustLeft: useExitProgress(heroProgress, EXITS.trustLeft.range),
        trustMid: useExitProgress(heroProgress, EXITS.trustMid.range),
        trustRight: useExitProgress(heroProgress, EXITS.trustRight.range),
    };

    /* Props for one piece's ExitLayer: its progress + its motion. */
    const exitOf = (name) => ({
        progress: exit[name],
        ...EXITS[name].move,
    });

    const [copyHidden, setCopyHidden] = useState(false);
    const [buttonsHidden, setButtonsHidden] = useState(false);

    useMotionValueEvent(heroProgress, "change", (value) => {
        setCopyHidden(!reduceMotion && value > COPY_HIDE_AT);
        setButtonsHidden(!reduceMotion && value > BUTTONS_HIDE_AT);
    });

    const [failedVideoUrl, setFailedVideoUrl] = useState(null);
    const [failedImageUrl, setFailedImageUrl] = useState(null);

    /* Video or still image, per the admin's Hero Background mode. While the
       mode isn't known yet on this device (first visit), neither renders. */
    const showImage = heroMediaType === "image";

    const heroVideoSrc =
        heroMediaType !== "video" || heroVideoUrl === undefined
            ? null
            : heroVideoUrl && heroVideoUrl !== failedVideoUrl
              ? heroVideoUrl
              : defaultHeroVideo;

    const heroImageSrc = !showImage
        ? null
        : heroImageUrl && heroImageUrl !== failedImageUrl
          ? heroImageUrl
          : defaultHeroImage;

    const {
        vehicleCategories,
        getVehicleCategories,
    } = useVehicleCategory();

    useEffect(() => {
        getVehicleCategories();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activeCategories = useMemo(() => {
        return (
            vehicleCategories
                ?.filter(
                    (item) =>
                        item.status ===
                        "Active"
                )
                ?.sort(
                    (a, b) =>
                        (a.displayOrder ?? 0) -
                        (b.displayOrder ?? 0)
                ) ?? []
        );
    }, [vehicleCategories]);

    return (
        <Section
            spacing="NONE"
            className="
                relative
                min-h-screen
                overflow-x-clip
                bg-gray-950
            "
        >
            <div
                ref={heroRef}
                className="
                    absolute
                    inset-0
                    overflow-hidden
                "
            >
                {heroVideoSrc && (
                <video
                    key={heroVideoSrc}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    aria-hidden="true"
                    onError={() => {
                        if (heroVideoSrc !== defaultHeroVideo) {
                            setFailedVideoUrl(heroVideoSrc);
                        }
                    }}
                    className="
                        absolute
                        inset-0
                        h-full
                        w-full
                        object-cover
                        object-center
                    "
                >
                    <source
                        src={heroVideoSrc}
                        onError={() => {
                            if (heroVideoSrc !== defaultHeroVideo) {
                                setFailedVideoUrl(heroVideoSrc);
                            }
                        }}
                    />
                </video>
                )}

                {heroImageSrc && (
                    <img
                        key={heroImageSrc}
                        src={heroImageSrc}
                        alt=""
                        aria-hidden="true"
                        fetchPriority="high"
                        onError={() => {
                            if (heroImageSrc !== defaultHeroImage) {
                                setFailedImageUrl(heroImageSrc);
                            }
                        }}
                        // Anchored right of centre: the default panorama's
                        // volcano sits on the right, so it stays in frame
                        // when narrower screens crop the sides.
                        className="absolute inset-0 h-full w-full object-cover object-[70%_center]"
                    />
                )}

                {/*
                    Shade only where text sits, so the footage stays bright
                    and crisp elsewhere: a light overall wash, a left-side
                    gradient behind the headline/copy, and top/bottom edges
                    for the navbar and the search bar + trust badges.
                */}
                <div
                    className="
                        absolute
                        inset-0
                        bg-black/15
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        bg-gradient-to-r
                        from-black/75
                        via-black/35
                        to-transparent
                    "
                />

                <div
                    className="
                        absolute
                        inset-0
                        bg-gradient-to-t
                        from-black/65
                        via-transparent
                        to-black/30
                    "
                />
            </div>

            {/*
                Light mode only: a gentle wave in the Featured section's
                background colour (slate-50) so the dark video flows into
                the pale section below instead of stopping at a hard edge,
                with a glowing golden ribbon riding the curve. It's
                shallowest mid-page, under the trust badges. Dark mode needs
                none — both sections are dark there.

                The ribbon is its own SVG so its glow can be a CSS
                drop-shadow: an SVG blur would be stretched along with the
                non-uniformly scaled viewBox.
            */}
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-px dark:hidden"
            >
                <svg
                    viewBox="0 0 1440 80"
                    preserveAspectRatio="none"
                    className="block h-12 w-full sm:h-16"
                >
                    <path
                        d="M0,40 C360,80 1080,0 1440,48 L1440,80 L0,80 Z"
                        fill="#f8fafc"
                    />
                </svg>

                <svg
                    viewBox="0 0 1440 80"
                    preserveAspectRatio="none"
                    className="absolute inset-0 block h-full w-full [filter:drop-shadow(0_0_4px_rgba(250,204,21,0.5))_drop-shadow(0_0_12px_rgba(250,204,21,0.2))]"
                >
                    <defs>
                        <linearGradient
                            id="hero-ribbon-gradient"
                            x1="0"
                            y1="0"
                            x2="1"
                            y2="0"
                        >
                            <stop offset="0%" stopColor="#fde047" />
                            <stop offset="45%" stopColor="#facc15" />
                            <stop offset="75%" stopColor="#eab308" />
                            <stop offset="100%" stopColor="#f59e0b" />
                        </linearGradient>
                    </defs>

                    {/* Ribbon band — swells on the sweeps, twists thin
                        mid-page (see heroRibbon.js) */}
                    <path
                        d={HERO_RIBBON_PATH}
                        fill="url(#hero-ribbon-gradient)"
                    />

                    {/* Satin sheen along the middle of the band */}
                    <path
                        d={HERO_WAVE_EDGE}
                        fill="none"
                        stroke="#ffffff"
                        strokeOpacity="0.5"
                        strokeWidth="1"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                    />
                </svg>
            </div>

<PageContainer
    className="
        relative
        z-20
        flex
        min-h-screen
        flex-col
        justify-center
        pb-12
        pt-24
        sm:pb-14
        sm:pt-28
        lg:pb-16
        [@media(max-height:820px)]:pb-8
        [@media(max-height:820px)]:pt-20
    "
>
                <div className="w-full">
                {/* Copy on the left, Explore Albay widget on the right (xl+,
                    where there's room beside the headline). */}
                <div className="xl:flex xl:items-center xl:justify-between xl:gap-8">
<motion.div
    variants={containerVariants}
    initial="hidden"
    animate="visible"
    className="
        max-w-xl
        lg:ml-[16%]
    "
>
                        <motion.div variants={itemVariants}>
                        <ExitLayer
                            {...exitOf("badge")}
                            className="
                                inline-flex
                                origin-left
                                items-center
                                gap-1.5
                                rounded-full
                                border
                                border-yellow-400/30
                                bg-yellow-400/10
                                px-2.5
                                py-1
                                text-[10px]
                                font-semibold
                                text-yellow-300
                                backdrop-blur-md
                            "
                        >
                            <ShieldCheck
                                size={13}
                                strokeWidth={2}
                            />

                            <span>
                                Trusted Vehicle Rental in Albay
                            </span>
                        </ExitLayer>
                        </motion.div>

                        <motion.h1
                            variants={itemVariants}
                            className="
                                mt-3
                                max-w-xl
                                text-4xl
                                font-black
                                leading-[1]
                                tracking-tight
                                text-white
                                drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]
                                sm:text-[clamp(2.25rem,7vh,3rem)]
                                lg:text-[clamp(2.5rem,7.6vh,3.75rem)]
                            "
                        >
                            <SwapLayer
                                as="span"
                                swap={SWAPS.headline}
                                hidden={copyHidden}
                                className="block"
                            >
                                Your Journey
                                <br />
                                in{" "}
                                <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                                    Albay
                                </span>
                                <br />
                                Starts Here
                            </SwapLayer>
                        </motion.h1>

                        <motion.p
                            variants={itemVariants}
                            className="
                                mt-3
                                max-w-lg
                                text-[13px]
                                leading-5.5
                                text-white/85
                                drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]
                                sm:text-sm
                                sm:leading-6
                            "
                        >
                            {/* Follows the headline: starts as its swap ends. */}
                            <SwapLayer
                                as="span"
                                swap={SWAPS.copy}
                                hidden={copyHidden}
                                className="block"
                            >
                                Rent reliable cars and
                                motorcycles with transparent
                                pricing, verified owners, and
                                trusted local service for
                                vacations, business trips,
                                family travel, and everyday
                                transportation across Albay.
                            </SwapLayer>
                        </motion.p>

                        <motion.div
                            variants={itemVariants}
                            className="
                                mt-5
                                flex
                                flex-col
                                gap-2
                                sm:flex-row
                                [@media(max-height:820px)]:mt-4
                            "
                        >
                            <SwapLayer
                                swap={SWAPS.button}
                                hidden={buttonsHidden}
                                className="w-full sm:w-auto"
                            >
                            <Link
                                to="/vehicles"
                                className="
                                    group
                                    block
                                    w-full
                                    sm:w-auto
                                "
                            >
                                <Button
                                    variant="primary"
                                    size="md"
                                    rightIcon={
                                        <ArrowRight
                                            size={15}
                                            className="
                                                transition-transform
                                                duration-200
                                                group-hover:translate-x-1
                                            "
                                        />
                                    }
                                    className="
                                        w-full
                                        rounded-xl
                                        border-yellow-500
                                        !bg-yellow-500
                                        px-5
                                        !text-gray-950
                                        shadow-lg
                                        shadow-yellow-500/15
                                        transition-transform
                                        hover:!bg-yellow-400
                                        hover:-translate-y-0.5
                                        sm:w-auto
                                    "
                                >
                                    Browse Vehicles
                                </Button>
                            </Link>
                            </SwapLayer>

                            <SwapLayer
                                swap={SWAPS.button}
                                hidden={buttonsHidden}
                                delay={0.08}
                                className="w-full sm:w-auto"
                            >
                            <Link
                                to={
                                    isAuthenticated
                                        ? "/customer/favorites"
                                        : "/register-operator"
                                }
                                className="
                                    block
                                    w-full
                                    sm:w-auto
                                "
                            >
                                <Button
                                    variant="outline"
                                    size="md"
                                    leftIcon={
                                        isAuthenticated ? (
                                            <Heart size={15} />
                                        ) : undefined
                                    }
                                    className="
                                        w-full
                                        rounded-xl
                                        border-white/25
                                        !bg-white/10
                                        px-5
                                        !text-white
                                        backdrop-blur-md
                                        hover:border-white/50
                                        hover:!bg-white
                                        hover:!text-gray-950
                                        sm:w-auto
                                    "
                                >
                                    {isAuthenticated
                                        ? "View Favorites"
                                        : "Become a Partner"}
                                </Button>
                            </Link>
                            </SwapLayer>
                        </motion.div>
                    </motion.div>

                    {/* Pulled into the page gutter: by the space outside the 80rem container
    plus most of its 2rem padding, so it sits ~1.5rem from the screen edge
    at every width — the calc keeps it inside the viewport, so it never
    causes horizontal scroll. */}
<AlbayHeroWidget className="hidden shrink-0 xl:-mr-[calc(max(0px,(100vw_-_80rem)/2)_+_0.5rem)] xl:block" />
                </div>

                    <HeroSearchBar
                        categories={activeCategories}
                        exitProgress={
                            reduceMotion ? undefined : exit.search
                        }
                    />

                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 16,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        transition={{
                            duration: 0.5,
                            delay: 0.55,
                            ease: "easeOut",
                        }}
                        className="
                            mx-auto
                            mt-5
                            grid
                            w-full
                            max-w-xl
                            [@media(max-height:820px)]:mt-4
                            grid-cols-1
                            justify-items-center
                            gap-3
                            sm:grid-cols-3
                            sm:gap-4
                        "
                    >
                        <ExitLayer
                            {...exitOf("trustLeft")}
                            className="group flex items-center gap-2"
                        >
                            <div
                                className="
                                    flex
                                    h-8
                                    w-8
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-yellow-400/15
                                    text-yellow-300
                                    backdrop-blur-sm
                                    transition-transform
                                    duration-200
                                    group-hover:scale-110
                                    group-hover:bg-yellow-400/25
                                "
                            >
                                <ShieldCheck
                                    size={15}
                                />
                            </div>

                            <div>
                                <p
                                    className="
                                        text-[11px]
                                        font-semibold
                                        text-white
                                        sm:text-xs
                                    "
                                >
                                    Verified Owners
                                </p>

                                <p
                                    className="
                                        mt-0.5
                                        text-[10px]
                                        text-white/60
                                    "
                                >
                                    Trusted Partners
                                </p>
                            </div>
                        </ExitLayer>

                        <ExitLayer
                            {...exitOf("trustMid")}
                            className="group flex items-center gap-2"
                        >
                            <div
                                className="
                                    flex
                                    h-8
                                    w-8
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-yellow-400/15
                                    text-yellow-300
                                    backdrop-blur-sm
                                    transition-transform
                                    duration-200
                                    group-hover:scale-110
                                    group-hover:bg-yellow-400/25
                                "
                            >
                                <MapPin
                                    size={15}
                                />
                            </div>

                            <div>
                                <p
                                    className="
                                        text-[11px]
                                        font-semibold
                                        text-white
                                        sm:text-xs
                                    "
                                >
                                    Based in Albay
                                </p>

                                <p
                                    className="
                                        mt-0.5
                                        text-[10px]
                                        text-white/60
                                    "
                                >
                                    Local & Reliable
                                </p>
                            </div>
                        </ExitLayer>

                        <ExitLayer
                            {...exitOf("trustRight")}
                            className="group flex items-center gap-2"
                        >
                            <div
                                className="
                                    flex
                                    h-8
                                    w-8
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-full
                                    bg-yellow-400/15
                                    text-yellow-300
                                    backdrop-blur-sm
                                    transition-transform
                                    duration-200
                                    group-hover:scale-110
                                    group-hover:bg-yellow-400/25
                                "
                            >
                                <CheckCircle
                                    size={15}
                                />
                            </div>

                            <div>
                                <p
                                    className="
                                        text-[11px]
                                        font-semibold
                                        text-white
                                        sm:text-xs
                                    "
                                >
                                    Quality Vehicles
                                </p>

                                <p
                                    className="
                                        mt-0.5
                                        text-[10px]
                                        text-white/60
                                    "
                                >
                                    Ready for Every Trip
                                </p>
                            </div>
                        </ExitLayer>
                    </motion.div>
                </div>
            </PageContainer>

            <motion.div
                initial={{
                    opacity: 0,
                }}
                animate={{
                    opacity: 1,
                }}
                transition={{
                    duration: 0.6,
                    delay: 0.9,
                }}
                className="
                    pointer-events-none
                    absolute
                    inset-x-0
                    bottom-20
                    dark:bottom-6
                    z-10
                    hidden
                    flex-col
                    [@media(max-height:820px)]:!hidden
                    items-center
                    text-white/60
                    sm:flex
                "
            >
                <ExitLayer
                    {...exitOf("hint")}
                    className="flex flex-col items-center gap-1.5"
                >
                <span
                    className="
                        text-[10px]
                        font-semibold
                        uppercase
                        tracking-wider
                    "
                >
                    Scroll to explore
                </span>

                <motion.div
                    animate={{
                        y: [0, 6, 0],
                    }}
                    transition={{
                        duration: 1.6,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                >
                    <ChevronDown size={18} />
                </motion.div>
                </ExitLayer>
            </motion.div>
        </Section>
    );
};

export default HeroSection;