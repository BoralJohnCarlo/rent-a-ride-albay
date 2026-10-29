import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";

import { getPillSurfaceClasses } from "./pillSurface";

const NAV_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 18,
    mass: 0.55,
};

const INDICATOR_SPRING = {
    type: "spring",
    stiffness: 500,
    damping: 24,
    mass: 0.6,
};

const isItemEnd = (item) => item.end ?? item.path === "/";

// Original look: plain text links with a yellow underline under the active one.
const UnderlineLinks = ({ items, layoutIdPrefix, overHero }) => (
    <nav className="hidden items-center justify-center gap-8 lg:flex">
        {items.map((item) => (
            <NavLink
                key={item.path}
                to={item.path}
                end={isItemEnd(item)}
                className="group relative flex h-10 items-center justify-center whitespace-nowrap px-1 outline-none"
            >
                {({ isActive }) => (
                    <motion.span
                        initial={false}
                        animate={{
                            y: isActive ? -1 : 0,
                            scale: isActive ? 1.01 : 1,
                        }}
                        whileHover={{ y: -2, scale: 1.035 }}
                        whileTap={{ y: 1, scale: 0.94 }}
                        transition={NAV_SPRING}
                        className={`relative flex h-full items-center text-sm font-semibold tracking-tight ${
                            overHero
                                ? "text-white/90 hover:text-white"
                                : isActive
                                  ? "text-gray-950 dark:text-white"
                                  : "text-gray-600 hover:text-gray-950 dark:text-gray-400 dark:hover:text-white"
                        }`}
                    >
                        {item.label}

                        {isActive && (
                            <motion.span
                                layoutId={`${layoutIdPrefix}-active-underline`}
                                className="absolute bottom-1 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-yellow-500"
                                transition={INDICATOR_SPRING}
                            />
                        )}

                        {!isActive && (
                            <motion.span
                                initial={{ width: 0, opacity: 0 }}
                                whileHover={{ width: 18, opacity: 1 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 22,
                                    mass: 0.5,
                                }}
                                className="absolute bottom-1 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-yellow-500/80"
                            />
                        )}
                    </motion.span>
                )}
            </NavLink>
        ))}
    </nav>
);

/*
 * Pill look: a soft yellow capsule slides behind whichever link is active.
 * Text colours sit on the inner span, not the <a>: index.css has an
 * unlayered `a { color: inherit }` that beats Tailwind's layered utilities.
 */
const PillLinks = ({ items, layoutIdPrefix, overHero, isScrolled }) => (
    <nav
        className={`hidden h-12 items-center justify-center gap-1 p-1.5 lg:flex ${getPillSurfaceClasses(
            { overHero, isScrolled }
        )}`}
    >
        {items.map((item) => (
            <NavLink
                key={item.path}
                to={item.path}
                end={isItemEnd(item)}
                className={({ isActive }) =>
                    `group relative flex h-9 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold tracking-tight outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-yellow-500/60 ${
                        isActive
                            ? ""
                            : overHero
                              ? "hover:bg-white/10"
                              : "hover:bg-gray-100/80 dark:hover:bg-white/5"
                    }`
                }
            >
                {({ isActive }) => (
                    <>
                        {isActive && (
                            <motion.span
                                layoutId={`${layoutIdPrefix}-active-pill`}
                                className={`absolute inset-0 rounded-full ${
                                    overHero
                                        ? "bg-yellow-400/30 ring-1 ring-yellow-300/40"
                                        : "bg-yellow-100 ring-1 ring-yellow-200/70 dark:bg-yellow-500/15 dark:ring-yellow-500/20"
                                }`}
                                transition={INDICATOR_SPRING}
                            />
                        )}

                        <motion.span
                            whileTap={{ scale: 0.94 }}
                            transition={NAV_SPRING}
                            className={`relative z-10 transition-colors duration-200 ${
                                overHero
                                    ? isActive
                                        ? "text-white"
                                        : "text-white/80 group-hover:text-white"
                                    : isActive
                                      ? "text-gray-950 dark:text-white"
                                      : "text-gray-600 group-hover:text-gray-950 dark:text-gray-400 dark:group-hover:text-white"
                            }`}
                        >
                            {item.label}
                        </motion.span>
                    </>
                )}
            </NavLink>
        ))}
    </nav>
);

/*
 * Desktop link row shared by PublicNavbar and CustomerNavbar. `end` defaults
 * to exact-matching only "/", which is what the public navbar relied on.
 */
const PublicNavLinks = ({ isPill, ...props }) =>
    isPill ? <PillLinks {...props} /> : <UnderlineLinks {...props} />;

export default PublicNavLinks;
