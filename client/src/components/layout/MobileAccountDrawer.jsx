import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    Check,
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    LoaderCircle,
    LogOut,
    Palette,
    X,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    getThemeLabel,
    getThemeOptions,
} from "../../config/themeOptions";
import useAuth from "../../hooks/auth/useAuth";
import useTheme from "../../hooks/theme/useTheme";

const CLOSE_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 18,
    mass: 0.55,
};

// Main list ↔ theme menu inside the drawer.
const PANEL_TRANSITION = {
    duration: 0.2,
    ease: [0.22, 1, 0.36, 1],
};

// Customer pages are yellow-accented, the dashboards blue.
const ACCENTS = {
    yellow: {
        avatar: "bg-yellow-500 text-gray-950",
        chip: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
        option: "bg-yellow-50 text-gray-950 dark:bg-yellow-500/10 dark:text-white",
        icon: "text-yellow-600 dark:text-yellow-400",
    },
    blue: {
        avatar: "bg-blue-600 text-white",
        chip: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
        option: "bg-blue-50 text-gray-950 dark:bg-blue-500/10 dark:text-white",
        icon: "text-blue-600 dark:text-blue-400",
    },
};

const ROW_CHEVRON = (
    <ChevronRight
        size={17}
        className="text-gray-400 dark:text-gray-500"
    />
);

const ROUND_BUTTON_CLASSES = `
    flex
    h-10
    w-10
    shrink-0
    items-center
    justify-center
    rounded-full
    border
    border-gray-200
    text-gray-600
    transition-colors
    duration-200
    hover:bg-gray-100
    hover:text-gray-900
    dark:border-gray-800
    dark:text-gray-400
    dark:hover:bg-gray-900
    dark:hover:text-white
`;

/* Small uppercase label above a group in the drawer. */
export const DrawerHeading = ({ children }) => (
    <p className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
        {children}
    </p>
);

/* One row of the drawer's grouped account card. */
const DrawerRow = ({
    icon: Icon,
    label,
    hint,
    disabled = false,
    onClick,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="
            flex
            w-full
            items-center
            gap-3
            px-4
            py-3.5
            text-left
            text-sm
            font-semibold
            text-gray-700
            transition-colors
            hover:bg-gray-100
            disabled:cursor-not-allowed
            disabled:opacity-60
            dark:text-gray-200
            dark:hover:bg-gray-800/70
        "
    >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
            <Icon size={16} />
        </span>

        <span className="flex-1">{label}</span>

        {hint && (
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {hint}
            </span>
        )}

        {ROW_CHEVRON}
    </button>
);

/**
 * The phone account panel (customer navbar + dashboards): who's signed in,
 * optional extra links (`children`), account rows, a Theme sub-panel with
 * Back, and Log out. Replaces the hover UserMenu below lg.
 */
const MobileAccountDrawer = ({
    open,
    onClose,
    brand,
    roleLabel,
    accent = "yellow",
    accountRows = [],
    // Room at the bottom of the scroll area (e.g. for a floating chat bubble).
    bottomPaddingClassName = "pb-10",
    children,
}) => {
    // "main" (links + account) or "theme" (the theme menu).
    const [view, setView] = useState("main");

    const { user, logout, logoutLoading } = useAuth();

    const {
        configuration,
        setColorTheme,
        isChristmasAvailable,
    } = useTheme();

    const navigate = useNavigate();

    const colors = ACCENTS[accent] ?? ACCENTS.yellow;

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";

        return () => {
            document.body.style.overflow = "";
        };
    }, [open]);

    // Always reopen on the main list.
    useEffect(() => {
        if (!open) setView("main");
    }, [open]);

    const close = () => {
        if (logoutLoading) return;

        onClose();
    };

    const goTo = (path) => {
        close();
        navigate(path);
    };

    // Same as the desktop user menu: pick a theme, back to the list.
    const handleThemeChange = (theme) => {
        setColorTheme(theme);
        setView("main");
    };

    const handleLogout = async () => {
        if (logoutLoading) return;

        try {
            await logout();

            onClose();

            navigate("/login", {
                replace: true,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const displayName = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .join(" ");

    const initials = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .map((name) => name.charAt(0).toUpperCase())
        .join("");

    const themeOptions = getThemeOptions({
        christmasAvailable: isChristmasAvailable,
        includeLight: true,
    });

    const panelClassName = `absolute inset-0 overflow-y-auto px-5 pt-5 ${bottomPaddingClassName}`;

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={close}
                        className="
                            fixed
                            inset-0
                            z-40
                            bg-black/40
                            backdrop-blur-sm
                            dark:bg-black/60
                            lg:hidden
                        "
                    />

                    <motion.aside
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            mass: 0.8,
                        }}
                        className="
                            fixed
                            right-0
                            top-0
                            z-50
                            flex
                            h-dvh
                            w-full
                            max-w-sm
                            flex-col
                            bg-white
                            shadow-2xl
                            dark:bg-gray-950
                            dark:shadow-black/40
                            lg:hidden
                        "
                    >
                        <div
                            className="
                                flex
                                h-[72px]
                                shrink-0
                                items-center
                                justify-between
                                border-b
                                border-gray-200
                                px-5
                                dark:border-gray-800
                            "
                        >
                            <div className="flex min-w-0 items-center gap-2.5">
                                {brand}
                            </div>

                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.92 }}
                                transition={CLOSE_SPRING}
                                onClick={close}
                                className={ROUND_BUTTON_CLASSES}
                                aria-label="Close menu"
                            >
                                <X size={20} />
                            </motion.button>
                        </div>

                        <div className="relative flex-1 overflow-hidden">
                            <AnimatePresence
                                initial={false}
                                mode="wait"
                            >
                                {view === "theme" ? (
                                    <motion.div
                                        key="theme"
                                        initial={{ opacity: 0, x: 24 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 24 }}
                                        transition={PANEL_TRANSITION}
                                        className={panelClassName}
                                    >
                                        <div className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setView("main")
                                                }
                                                aria-label="Back"
                                                className={ROUND_BUTTON_CLASSES}
                                            >
                                                <ChevronLeft size={20} />
                                            </button>

                                            <div>
                                                <p className="text-base font-bold text-gray-950 dark:text-white">
                                                    Theme
                                                </p>

                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Choose how the site looks
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-6 divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:divide-gray-800/80 dark:border-gray-800 dark:bg-gray-900/70">
                                            {themeOptions.map(
                                                ({
                                                    value,
                                                    label,
                                                    icon: Icon,
                                                }) => {
                                                    const isActive =
                                                        configuration?.colorTheme ===
                                                        value;

                                                    return (
                                                        <button
                                                            key={value}
                                                            type="button"
                                                            onClick={() =>
                                                                handleThemeChange(
                                                                    value
                                                                )
                                                            }
                                                            className={`
                                                                flex
                                                                w-full
                                                                items-center
                                                                gap-3
                                                                px-4
                                                                py-3.5
                                                                text-left
                                                                text-sm
                                                                font-semibold
                                                                transition-colors
                                                                ${
                                                                    isActive
                                                                        ? colors.option
                                                                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800/70"
                                                                }
                                                            `}
                                                        >
                                                            <Icon
                                                                size={18}
                                                                className={
                                                                    isActive
                                                                        ? colors.icon
                                                                        : "text-gray-500 dark:text-gray-400"
                                                                }
                                                            />

                                                            <span className="flex-1">
                                                                {label}
                                                            </span>

                                                            {isActive && (
                                                                <Check
                                                                    size={18}
                                                                    className={colors.icon}
                                                                />
                                                            )}
                                                        </button>
                                                    );
                                                }
                                            )}
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="main"
                                        initial={{ opacity: 0, x: -24 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -24 }}
                                        transition={PANEL_TRANSITION}
                                        className={panelClassName}
                                    >
                                        {/* Who's signed in. */}
                                        <div
                                            className="
                                                flex
                                                items-center
                                                gap-3
                                                rounded-2xl
                                                border
                                                border-gray-200
                                                bg-gray-50
                                                p-3.5
                                                dark:border-gray-800
                                                dark:bg-gray-900/70
                                            "
                                        >
                                            <span
                                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${colors.avatar}`}
                                                aria-hidden="true"
                                            >
                                                {initials || (
                                                    <CircleUserRound size={22} />
                                                )}
                                            </span>

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-gray-950 dark:text-white">
                                                    {displayName || roleLabel}
                                                </p>

                                                <span
                                                    className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${colors.chip}`}
                                                >
                                                    {roleLabel}
                                                </span>
                                            </div>
                                        </div>

                                        {children}

                                        <DrawerHeading>Account</DrawerHeading>

                                        {/* Account options, always listed (no dropdown to open). */}
                                        <div
                                            className="
                                                divide-y
                                                divide-gray-100
                                                overflow-hidden
                                                rounded-2xl
                                                border
                                                border-gray-200
                                                bg-gray-50
                                                dark:divide-gray-800/80
                                                dark:border-gray-800
                                                dark:bg-gray-900/70
                                            "
                                        >
                                            {accountRows.map((row) => (
                                                <DrawerRow
                                                    key={row.path}
                                                    icon={row.icon}
                                                    label={row.label}
                                                    disabled={logoutLoading}
                                                    onClick={() =>
                                                        goTo(row.path)
                                                    }
                                                />
                                            ))}

                                            <DrawerRow
                                                icon={Palette}
                                                label="Theme"
                                                hint={getThemeLabel(
                                                    configuration?.colorTheme
                                                )}
                                                disabled={logoutLoading}
                                                onClick={() =>
                                                    setView("theme")
                                                }
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            disabled={logoutLoading}
                                            className="
                                                mt-4
                                                flex
                                                w-full
                                                items-center
                                                justify-center
                                                gap-2
                                                rounded-2xl
                                                border
                                                border-red-200
                                                bg-red-50
                                                px-4
                                                py-3
                                                text-sm
                                                font-semibold
                                                text-red-600
                                                transition-colors
                                                hover:bg-red-100
                                                disabled:cursor-wait
                                                disabled:opacity-70
                                                dark:border-red-500/20
                                                dark:bg-red-500/10
                                                dark:text-red-400
                                                dark:hover:bg-red-500/15
                                            "
                                        >
                                            {logoutLoading ? (
                                                <LoaderCircle
                                                    size={18}
                                                    className="animate-spin"
                                                />
                                            ) : (
                                                <LogOut size={18} />
                                            )}

                                            {logoutLoading
                                                ? "Logging out..."
                                                : "Log out"}
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
};

export default MobileAccountDrawer;
