import { motion, useReducedMotion } from "framer-motion";

import { Menu } from "lucide-react";

import { useEffect } from "react";
import { NavLink, matchPath, useLocation } from "react-router-dom";

import { CUSTOMER_TABS, isTabBarHidden } from "./customerTabs";

// Marks <body> while the bar is shown; styles/tab-bar.css turns it into
// bottom padding + the --tab-bar-offset the chat bubble sits above (phones).
const BODY_CLASS = "has-tab-bar";

const INDICATOR_SPRING = {
    type: "spring",
    stiffness: 380,
    damping: 34,
    mass: 0.8,
};

/*
 * Icon + label, drawn above the bar's persistent sliding circle.
 */
const TabContent = ({
    icon: Icon,
    label,
    isActive,
}) => (
    <>
        <span className="relative flex h-9 w-9 items-center justify-center">
            <Icon
                size={19}
                strokeWidth={isActive ? 2.4 : 2}
                className={`relative transition-colors ${
                    isActive
                        ? "text-gray-950"
                        : "text-gray-500 dark:text-gray-400"
                }`}
            />
        </span>

        <span
            className={`text-[11px] leading-none transition-colors ${
                isActive
                    ? "font-bold text-gray-950 dark:text-white"
                    : "font-medium text-gray-500 dark:text-gray-400"
            }`}
        >
            {label}
        </span>
    </>
);

const TAB_CLASSES =
    "relative z-10 flex flex-1 flex-col items-center justify-center gap-1 pb-1.5 pt-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-yellow-500";

/**
 * App-style bottom navigation for the customer site on phones (below lg):
 * up to four page tabs plus Menu, which opens the menu sheet. Logged-out
 * visitors pass `tabs={GUEST_TABS}`.
 */
const CustomerTabBar = ({
    tabs = CUSTOMER_TABS,
    isMenuOpen,
    onOpenMenu,
}) => {
    const { pathname, search } = useLocation();
    const reduceMotion = useReducedMotion();
    const activeTabIndex = tabs.findIndex((tab) => {
        const destination = new URL(tab.path, "https://navigation.local");
        return Boolean(matchPath({ path: destination.pathname, end: tab.end ?? false }, pathname)) &&
            (!destination.search || destination.search === search);
    });
    const activeIndex = isMenuOpen || activeTabIndex < 0 ? tabs.length : activeTabIndex;

    const hidden = isTabBarHidden(pathname);

    useEffect(() => {
        if (hidden) return undefined;

        document.body.classList.add(BODY_CLASS);

        return () => {
            document.body.classList.remove(BODY_CLASS);
        };
    }, [hidden]);

    if (hidden) return null;

    return (
        <nav
            aria-label="Main"
            className="
                fixed
                inset-x-0
                bottom-0
                z-40
                border-t
                border-gray-200/80
                bg-white/90
                pb-[env(safe-area-inset-bottom)]
                shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.18)]
                backdrop-blur-xl
                dark:border-gray-800/80
                dark:bg-gray-950/90
                dark:shadow-black/40
                lg:hidden
            "
        >
            <div className="relative mx-auto flex h-16 max-w-lg items-stretch">
                <motion.div
                    aria-hidden="true"
                    initial={false}
                    animate={{ x: `${activeIndex * 100}%` }}
                    transition={reduceMotion ? { duration: 0 } : INDICATOR_SPRING}
                    style={{ width: `${100 / (tabs.length + 1)}%` }}
                    className="pointer-events-none absolute left-0 top-1.5 flex justify-center"
                >
                    <span className="h-9 w-9 shrink-0 rounded-full bg-yellow-400 shadow-md shadow-yellow-500/30" />
                </motion.div>
                {tabs.map((tab, index) => (
                    <NavLink
                        key={tab.path}
                        to={tab.path}
                        end={tab.end}
                        className={TAB_CLASSES}
                    >
                        {() => (
                            <TabContent
                                icon={tab.icon}
                                label={tab.label}
                                isActive={activeIndex === index}
                            />
                        )}
                    </NavLink>
                ))}

                <button
                    type="button"
                    onClick={onOpenMenu}
                    aria-label="Open menu"
                    aria-expanded={isMenuOpen}
                    className={TAB_CLASSES}
                >
                    <TabContent
                        icon={Menu}
                        label="Menu"
                        isActive={activeIndex === tabs.length}
                    />
                </button>
            </div>
        </nav>
    );
};

export default CustomerTabBar;
