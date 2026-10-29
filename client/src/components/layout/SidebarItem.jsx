import { motion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { SIDEBAR_ITEM_SPRING } from "../../constants/animations";

import useSidebar from "../../context/useSidebar";

const ENTRANCE_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 22,
};

const PILL_SPRING = {
    type: "spring",
    stiffness: 400,
    damping: 24,
};

// The little pop the icon does as the sidebar closes.
const ICON_POP_SPRING = {
    type: "spring",
    stiffness: 430,
    damping: 15,
};

const LABEL_SPRING = {
    type: "spring",
    stiffness: 500,
    damping: 30,
};

// Plain shrink (no opacity change) used for the pill collapsing away below
// - not a spring, since that half should read as an even, deliberate
// shrink rather than a bounce.
const GHOST_SHRINK_TRANSITION = {
    duration: 0.34,
};

// The circle appears after a beat (once the pill has visibly dissolved)
// and pops from nothing up to full size with an overshoot-and-settle
// bounce, rather than fading in.
const CIRCLE_EXPAND_DELAY = 0.3;

const CIRCLE_EXPAND_SPRING = {
    type: "spring",
    stiffness: 480,
    damping: 13,
    delay: CIRCLE_EXPAND_DELAY,
};

// How long the fade-based swap stays in control after a collapse starts,
// before handing back to the normal shared-layout pill (which drives the
// expand animation and same-state active-item sliding, both untouched).
// Springs don't have a fixed duration, so this is a generous estimate of
// how long CIRCLE_EXPAND_SPRING takes to fully settle after its delay -
// cutting over any earlier would visibly chop the bounce mid-motion.
const CLOSE_FADE_WINDOW_MS = 950;

const SidebarItem = ({
    to,
    icon: Icon,
    label,
    end = false,
    index = 0,
    badgeCount = 0,
}) => {
    const { collapsed } = useSidebar();

    // Detect the exact render where the sidebar starts closing (collapsed
    // just became true), synchronously during render so there's no
    // one-frame lag - React's documented pattern for reacting to a value
    // change without waiting for an effect.
    const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
    const [closing, setClosing] = useState(false);

    if (collapsed !== prevCollapsed) {
        setPrevCollapsed(collapsed);
        setClosing(collapsed);
    }

    useLayoutEffect(() => {
        if (!closing) {
            return undefined;
        }

        const timer = setTimeout(
            () => setClosing(false),
            CLOSE_FADE_WINDOW_MS
        );

        return () => clearTimeout(timer);
    }, [closing]);

    // Continuously remember the active pill's on-screen box, relative to
    // the stable outer wrapper below, while expanded. That way, the exact
    // instant a collapse starts, we already have a fresh, real measurement
    // to freeze the fade-out ghost at - no guessing at pixel sizes.
    const outerRef = useRef(null);
    const pillRef = useRef(null);
    const lastPillRectRef = useRef(null);

    useLayoutEffect(() => {
        if (
            collapsed ||
            !outerRef.current ||
            !pillRef.current
        ) {
            return;
        }

        const pillBox =
            pillRef.current.getBoundingClientRect();
        const outerBox =
            outerRef.current.getBoundingClientRect();

        lastPillRectRef.current = {
            top: pillBox.top - outerBox.top,
            left: pillBox.left - outerBox.left,
            width: pillBox.width,
            height: pillBox.height,
        };
    });

    const ghostRect = lastPillRectRef.current;

    return (
        <NavLink
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className="block outline-none"
        >
            {({ isActive }) => (
                <motion.div
                    ref={outerRef}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                        ...ENTRANCE_SPRING,
                        delay: Math.min(index * 0.03, 0.28),
                    }}
                    className="relative"
                >
                    <motion.div
                        whileHover={{ x: collapsed ? 0 : 4 }}
                        whileTap={{ scale: 0.95 }}
                        transition={SIDEBAR_ITEM_SPRING}
                        className={`relative flex items-center rounded-full text-[15px] font-medium ${
                            collapsed
                                ? "mx-auto h-11 w-11 justify-center"
                                : "px-4 py-2.5"
                        } ${
                            isActive
                                ? "text-white"
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                        }`}
                    >
                        {isActive && (
                            <motion.span
                                ref={pillRef}
                                layoutId="sidebar-active-pill"
                                initial={false}
                                animate={{
                                    opacity: closing ? 0 : 1,
                                }}
                                transition={{
                                    layout: closing
                                        ? { duration: 0 }
                                        : PILL_SPRING,
                                    // Hiding is a real (if invisible)
                                    // transition, timed to match the
                                    // ghost's own shrink below; reappearing
                                    // is an instant snap, timed to land
                                    // exactly when the expanding circle
                                    // below (already fully settled by
                                    // then) gets removed - both circles
                                    // are pixel-identical at that instant,
                                    // so the handoff is invisible.
                                    opacity: closing
                                        ? GHOST_SHRINK_TRANSITION
                                        : { duration: 0 },
                                }}
                                className="absolute inset-0 rounded-full bg-blue-600 shadow-sm shadow-blue-600/30"
                            />
                        )}

                        {isActive && closing && (
                            <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={
                                    CIRCLE_EXPAND_SPRING
                                }
                                className="absolute inset-0 rounded-full bg-blue-600 shadow-sm shadow-blue-600/30"
                            />
                        )}

                        <span className="relative z-10 flex min-w-0 items-center gap-3.5">
                            {Icon && (
                                <motion.span
                                    animate={{
                                        scale: collapsed ? 1.12 : 1,
                                    }}
                                    transition={ICON_POP_SPRING}
                                    className="relative flex shrink-0 items-center justify-center"
                                >
                                    <Icon
                                        size={22}
                                        strokeWidth={
                                            isActive ? 2 : 1.75
                                        }
                                    />

                                    {badgeCount > 0 &&
                                        (badgeCount === 1 ? (
                                            <span
                                                className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ${
                                                    isActive
                                                        ? "ring-blue-600"
                                                        : "ring-white dark:ring-gray-900"
                                                }`}
                                            />
                                        ) : (
                                            <span
                                                className={`absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ${
                                                    isActive
                                                        ? "ring-blue-600"
                                                        : "ring-white dark:ring-gray-900"
                                                }`}
                                            >
                                                {badgeCount > 9
                                                    ? "9+"
                                                    : badgeCount}
                                            </span>
                                        ))}
                                </motion.span>
                            )}

                            {!collapsed && (
                                <motion.span
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={LABEL_SPRING}
                                    className="truncate"
                                >
                                    {label}
                                </motion.span>
                            )}
                        </span>
                    </motion.div>

                    {isActive && closing && ghostRect && (
                        <motion.span
                            initial={{ scale: 1 }}
                            animate={{ scale: 0 }}
                            transition={
                                GHOST_SHRINK_TRANSITION
                            }
                            style={{
                                position: "absolute",
                                top: ghostRect.top,
                                left: ghostRect.left,
                                width: ghostRect.width,
                                height: ghostRect.height,
                            }}
                            className="pointer-events-none rounded-full bg-blue-600 shadow-sm shadow-blue-600/30"
                        />
                    )}
                </motion.div>
            )}
        </NavLink>
    );
};

export default SidebarItem;
