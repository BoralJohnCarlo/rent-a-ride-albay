import {
    animate,
    motion,
    useMotionValue,
    useMotionValueEvent,
} from "framer-motion";

import { ChevronLeft, ChevronRight } from "lucide-react";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

/*
 * Cover-flow page switcher for the dashboards on phones/tablets (below lg).
 * The page in the middle is the selected one: drag the strip or tap the
 * arrows to move, and the page opens once the strip settles (so flicking
 * past GPS on the way doesn't load it). Tapping an item opens it at once.
 *
 * Positions are computed from a single `focus` motion value (a fractional
 * item index) and written straight to the DOM, so dragging never re-renders.
 */

const SLOT = 44; // collapsed item (icon circle)
const GAP = 6;
const LABEL_GAP = 2; // icon box already has side room
const LABEL_END_PAD = 16;
const MAX_PILL_SHARE = 0.7; // of the strip, so neighbours stay in view
const DRAG_PITCH = 64; // px of finger travel per item
const NEIGHBOUR_SCALE = 0.88;
const MIN_SCALE = 0.68;
const SCALE_STEP = 0.1; // per item beyond the neighbours
const MIN_OPACITY = 0.3;
const OPACITY_STEP = 0.2;
const RUBBER_BAND = 0.3;
const FLICK_PROJECTION = 0.16; // seconds of velocity carried into the snap
const OPEN_DELAY_MS = 420; // after the last drag/arrow before opening
const ARROW_EDGE_INSET = 0.1; // viewport share hidden under the fade mask

const EDGE_FADE =
    "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)";

const SNAP_SPRING = {
    type: "spring",
    stiffness: 380,
    damping: 36,
};

const clamp = (value, min, max) =>
    Math.min(max, Math.max(min, value));

// Rough label width until the real one is measured.
const estimateExtra = (label) =>
    label.length * 7.5 + LABEL_GAP + LABEL_END_PAD;

/*
 * Where every item sits for a given focus. Items are laid out edge to edge
 * (scaled widths + gap) and the whole row is shifted so the focus point —
 * interpolated between the two nearest item centres — lands at x = 0.
 */
const computeLayout = (focus, extras, maxExtra) => {
    const count = extras.length;
    const items = [];

    let cursor = 0;

    for (let index = 0; index < count; index += 1) {
        const distance = Math.abs(index - focus);
        const expand = Math.max(0, 1 - distance);
        const beyond = Math.max(0, distance - 1);

        const scale =
            distance <= 1
                ? 1 - (1 - NEIGHBOUR_SCALE) * distance
                : Math.max(
                      MIN_SCALE,
                      NEIGHBOUR_SCALE - beyond * SCALE_STEP
                  );

        const width =
            SLOT + Math.min(extras[index], maxExtra) * expand;
        const visualWidth = width * scale;

        items.push({
            left: cursor,
            width,
            visualWidth,
            scale,
            expand,
            opacity: Math.max(
                MIN_OPACITY,
                1 - beyond * OPACITY_STEP
            ),
        });

        cursor += visualWidth + GAP;
    }

    const centre = (index) =>
        items[index].left + items[index].visualWidth / 2;

    let focusPoint;

    if (focus <= 0) {
        focusPoint = centre(0) + focus * (SLOT + GAP);
    } else if (focus >= count - 1) {
        focusPoint =
            centre(count - 1) +
            (focus - (count - 1)) * (SLOT + GAP);
    } else {
        const low = Math.floor(focus);
        const high = Math.min(count - 1, low + 1);

        focusPoint =
            centre(low) +
            (centre(high) - centre(low)) * (focus - low);
    }

    return items.map((item) => ({
        ...item,
        x: item.left - focusPoint,
    }));
};

const findActiveIndex = (items, pathname) =>
    items.findIndex((item) =>
        item.end
            ? pathname === item.path
            : pathname === item.path ||
              pathname.startsWith(`${item.path}/`)
    );

// Ring matches the item behind it (grey chip, or the blue pill when focused).
const BADGE_RING =
    "ring-2 ring-gray-100 group-data-[focused=true]:ring-blue-600 dark:ring-gray-800 dark:group-data-[focused=true]:ring-blue-600";

const Badge = ({ count }) =>
    count === 1 ? (
        <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ${BADGE_RING}`} />
    ) : (
        <span className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ${BADGE_RING}`}>
            {count > 9 ? "9+" : count}
        </span>
    );

const ArrowButton = ({
    direction,
    disabled,
    hasHiddenBadge,
    onClick,
}) => {
    const Icon =
        direction === "left" ? ChevronLeft : ChevronRight;

    return (
        <motion.button
            type="button"
            onClick={onClick}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.88 }}
            aria-label={
                direction === "left"
                    ? "Previous page"
                    : "Next page"
            }
            className="
                relative
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-full
                border
                border-gray-200
                bg-white
                text-gray-600
                shadow-sm
                transition-[opacity,color,background-color]
                hover:bg-gray-100
                hover:text-gray-900
                disabled:opacity-35
                disabled:shadow-none
                dark:border-gray-800
                dark:bg-gray-900
                dark:text-gray-300
                dark:hover:bg-gray-800
                dark:hover:text-white
            "
        >
            <Icon size={18} />

            {/* A page with activity is scrolled out of view this way. */}
            {hasHiddenBadge && (
                <span className="absolute -top-0.5 right-0 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-950" />
            )}
        </motion.button>
    );
};

/**
 * @param items  [{ path, label, icon, end?, badgeKey? }] in display order
 * @param counts activity counts keyed by item.badgeKey
 */
const DashboardDock = ({ items, counts = {} }) => {
    const navigate = useNavigate();
    const { pathname } = useLocation();

    const count = items.length;
    const activeIndex = findActiveIndex(items, pathname);

    const focus = useMotionValue(Math.max(0, activeIndex));

    const [extras, setExtras] = useState(() =>
        items.map((item) => estimateExtra(item.label))
    );

    // Where the strip last came to rest (drives the arrows' state).
    const [settledIndex, setSettledIndex] = useState(
        Math.max(0, activeIndex)
    );

    const [viewportWidth, setViewportWidth] = useState(0);

    // Longest the middle pill's label may grow before it ellipsizes.
    const maxExtra = viewportWidth
        ? Math.max(0, viewportWidth * MAX_PILL_SHARE - SLOT)
        : Infinity;

    const viewportRef = useRef(null);
    const itemRefs = useRef([]);
    const fillRefs = useRef([]);
    const labelRefs = useRef([]);
    const extrasRef = useRef(extras);
    const maxExtraRef = useRef(maxExtra);
    const targetRef = useRef(Math.max(0, activeIndex));
    const animationRef = useRef(null);
    const openTimerRef = useRef(null);
    const panStartRef = useRef(0);
    const pannedRef = useRef(false);
    const pathnameRef = useRef(pathname);
    // On a page that isn't in the dock (e.g. Notifications) nothing is
    // highlighted until the user starts moving the strip.
    const unlistedRef = useRef(activeIndex === -1);
    const browsingRef = useRef(false);

    const apply = useCallback((value) => {
        const layout = computeLayout(
            value,
            extrasRef.current,
            maxExtraRef.current
        );

        const highlight =
            !unlistedRef.current || browsingRef.current;

        layout.forEach((item, index) => {
            const element = itemRefs.current[index];

            if (!element) return;

            element.style.width = `${item.width}px`;
            element.style.transform = `translate3d(${item.x}px, -50%, 0) scale(${item.scale})`;
            element.style.opacity = item.opacity;
            element.dataset.focused =
                highlight && item.expand > 0.5 ? "true" : "false";

            const fill = fillRefs.current[index];
            if (fill) fill.style.opacity = highlight ? item.expand : 0;

            const label = labelRefs.current[index];
            if (label) label.style.opacity = item.expand ** 2;
        });
    }, []);

    useMotionValueEvent(focus, "change", apply);

    // Real label widths (and again once web fonts have loaded).
    useLayoutEffect(() => {
        const measure = () => {
            setExtras(
                items.map((item, index) => {
                    const label = labelRefs.current[index];

                    // Natural width, incl. its pr-4 end padding.
                    return label
                        ? label.scrollWidth + LABEL_GAP
                        : estimateExtra(item.label);
                })
            );
        };

        measure();

        let cancelled = false;

        document.fonts?.ready.then(() => {
            if (!cancelled) measure();
        });

        return () => {
            cancelled = true;
        };
    }, [items]);

    useLayoutEffect(() => {
        extrasRef.current = extras;
        maxExtraRef.current = maxExtra;
        apply(focus.get());
    }, [extras, maxExtra, apply, focus]);

    useLayoutEffect(() => {
        pathnameRef.current = pathname;
        unlistedRef.current = activeIndex === -1;
        browsingRef.current = false;
        apply(focus.get());
    }, [pathname, activeIndex, apply, focus]);

    const startBrowsing = () => {
        if (browsingRef.current) return;

        browsingRef.current = true;
        apply(focus.get());
    };

    useEffect(() => {
        const element = viewportRef.current;

        if (!element) return undefined;

        const observer = new ResizeObserver(([entry]) => {
            setViewportWidth(entry.contentRect.width);
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    useEffect(
        () => () => {
            clearTimeout(openTimerRef.current);
            animationRef.current?.stop();
        },
        []
    );

    const openIndex = useCallback(
        (index) => {
            const item = items[index];

            // Also from a sub-page (e.g. a Settings tab) back to the
            // section's main page.
            if (item && pathnameRef.current !== item.path) {
                navigate(item.path);
            }
        },
        [items, navigate]
    );

    /*
     * Spring the strip to `index`. `openAfter` is the delay before opening
     * that page (null = just move, e.g. following a route change).
     */
    const settleTo = useCallback(
        (index, openAfter = OPEN_DELAY_MS) => {
            const target = clamp(index, 0, count - 1);

            targetRef.current = target;

            clearTimeout(openTimerRef.current);
            animationRef.current?.stop();

            animationRef.current = animate(
                focus,
                target,
                {
                    ...SNAP_SPRING,
                    onComplete: () => setSettledIndex(target),
                }
            );

            if (openAfter === null) return;

            if (openAfter === 0) {
                openIndex(target);
            } else {
                openTimerRef.current = setTimeout(
                    () => openIndex(target),
                    openAfter
                );
            }
        },
        [count, focus, openIndex]
    );

    // Follow navigation from elsewhere (notifications, links, back button).
    useEffect(() => {
        if (
            activeIndex !== -1 &&
            activeIndex !== targetRef.current
        ) {
            settleTo(activeIndex, null);
        }
    }, [activeIndex, settleTo]);

    const handlePanStart = () => {
        startBrowsing();
        clearTimeout(openTimerRef.current);
        animationRef.current?.stop();

        pannedRef.current = true;
        panStartRef.current = focus.get();
    };

    const handlePan = (_event, info) => {
        let next =
            panStartRef.current - info.offset.x / DRAG_PITCH;

        if (next < 0) {
            next *= RUBBER_BAND;
        } else if (next > count - 1) {
            next =
                count - 1 + (next - (count - 1)) * RUBBER_BAND;
        }

        focus.set(next);
    };

    const handlePanEnd = (_event, info) => {
        const projected =
            focus.get() -
            (info.velocity.x / DRAG_PITCH) * FLICK_PROJECTION;

        settleTo(Math.round(projected));
    };

    const handleItemClick = (index) => {
        // The click that ends a drag isn't a tap.
        if (pannedRef.current) {
            pannedRef.current = false;
            return;
        }

        startBrowsing();
        settleTo(index, 0);
    };

    // Is a page with activity hidden past either edge at rest?
    const hiddenBadges = useMemo(() => {
        const result = { left: false, right: false };

        if (!viewportWidth) return result;

        const layout = computeLayout(
            settledIndex,
            extras,
            maxExtra
        );
        const edge = viewportWidth / 2 - viewportWidth * ARROW_EDGE_INSET;

        items.forEach((item, index) => {
            if (
                index === settledIndex ||
                !(item.badgeKey && counts[item.badgeKey] > 0)
            ) {
                return;
            }

            const { x, visualWidth } = layout[index];

            if (x < -edge) result.left = true;
            if (x + visualWidth > edge) result.right = true;
        });

        return result;
    }, [counts, extras, items, maxExtra, settledIndex, viewportWidth]);

    return (
        <nav
            aria-label="Pages"
            className="
                relative
                z-30
                shrink-0
                border-t
                border-gray-200/80
                bg-white/90
                pb-[env(safe-area-inset-bottom)]
                shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]
                backdrop-blur-xl
                dark:border-gray-800/80
                dark:bg-gray-950/90
                dark:shadow-black/40
            "
        >
            <div className="mx-auto flex h-[68px] max-w-2xl items-center gap-2 px-3">
                <ArrowButton
                    direction="left"
                    disabled={settledIndex <= 0}
                    hasHiddenBadge={hiddenBadges.left}
                    onClick={() => {
                        startBrowsing();
                        settleTo(targetRef.current - 1);
                    }}
                />

                <motion.div
                    ref={viewportRef}
                    onPointerDownCapture={() => {
                        pannedRef.current = false;
                    }}
                    onPanStart={handlePanStart}
                    onPan={handlePan}
                    onPanEnd={handlePanEnd}
                    style={{
                        touchAction: "none",
                        maskImage:
                            EDGE_FADE,
                        WebkitMaskImage: EDGE_FADE,
                    }}
                    className="relative h-full min-w-0 flex-1 cursor-grab select-none overflow-hidden active:cursor-grabbing"
                >
                    {items.map((item, index) => {
                        const Icon = item.icon;
                        const badgeCount = item.badgeKey
                            ? counts[item.badgeKey] || 0
                            : 0;

                        return (
                            <button
                                key={item.path}
                                ref={(element) => {
                                    itemRefs.current[index] = element;
                                }}
                                type="button"
                                onClick={() =>
                                    handleItemClick(index)
                                }
                                aria-label={
                                    badgeCount > 0
                                        ? `${item.label} (${badgeCount})`
                                        : item.label
                                }
                                aria-current={
                                    index === activeIndex
                                        ? "page"
                                        : undefined
                                }
                                data-focused="false"
                                draggable={false}
                                className="
                                    group
                                    absolute
                                    left-1/2
                                    top-1/2
                                    flex
                                    h-11
                                    origin-left
                                    items-center
                                    overflow-hidden
                                    rounded-full
                                    bg-gray-100
                                    text-gray-500
                                    outline-none
                                    will-change-transform
                                    focus-visible:ring-2
                                    focus-visible:ring-blue-500
                                    data-[focused=true]:text-white
                                    dark:bg-gray-800/80
                                    dark:text-gray-400
                                "
                            >
                                <span
                                    ref={(element) => {
                                        fillRefs.current[index] = element;
                                    }}
                                    aria-hidden="true"
                                    className="absolute inset-0 rounded-full bg-blue-600 opacity-0 shadow-md shadow-blue-600/30"
                                />

                                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
                                    <span className="relative flex">
                                        <Icon
                                            size={20}
                                            strokeWidth={2}
                                        />

                                        {badgeCount > 0 && (
                                            <Badge count={badgeCount} />
                                        )}
                                    </span>
                                </span>

                                <span
                                    ref={(element) => {
                                        labelRefs.current[index] = element;
                                    }}
                                    className="relative shrink-0 overflow-hidden text-ellipsis whitespace-nowrap pr-4 text-[13px] font-semibold opacity-0"
                                    style={{
                                        marginLeft: LABEL_GAP,
                                        maxWidth: Number.isFinite(maxExtra)
                                            ? maxExtra - LABEL_GAP
                                            : undefined,
                                    }}
                                >
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </motion.div>

                <ArrowButton
                    direction="right"
                    disabled={settledIndex >= count - 1}
                    hasHiddenBadge={hiddenBadges.right}
                    onClick={() => {
                        startBrowsing();
                        settleTo(targetRef.current + 1);
                    }}
                />
            </div>
        </nav>
    );
};

export default DashboardDock;
