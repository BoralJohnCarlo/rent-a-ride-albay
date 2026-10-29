import {
    AnimatePresence,
    motion,
    useDragControls,
} from "framer-motion";

import {
    ArrowRight,
    Check,
    ChevronRight,
    Compass,
    Info,
    LoaderCircle,
    LogIn,
    LogOut,
    Mail,
    CircleHelp,
    Settings,
    User,
    UserPlus,
    X,
} from "lucide-react";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";

import { getThemeOptions } from "../../config/themeOptions";
import useAuth from "../../hooks/auth/useAuth";
import useTheme from "../../hooks/theme/useTheme";

const SHEET_SPRING = {
    type: "spring",
    stiffness: 380,
    damping: 38,
};

// Dragged down this far (or flicked), the sheet closes.
const CLOSE_DRAG_PX = 110;
const CLOSE_DRAG_VELOCITY = 600;

// Icons for the leftover page links (anything else gets the arrow).
const LINK_ICONS = {
    "/about": Info,
    "/contact": Mail,
    "/faq": CircleHelp,
    "/explore": Compass,
};

const SectionLabel = ({ children }) => (
    <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
        {children}
    </p>
);

/* A square shortcut tile (customer account options). */
const Tile = ({ icon: Icon, label, hint, onClick, disabled }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="group flex flex-col items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-yellow-400 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-yellow-500/60"
    >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400/15 text-yellow-700 transition-transform group-hover:scale-105 dark:text-yellow-300">
            <Icon size={19} />
        </span>
        <span className="w-full">
            <span className="flex items-center justify-between text-sm font-bold text-gray-950 dark:text-white">
                {label}
                <ChevronRight size={15} className="text-gray-400" />
            </span>
            {hint && (
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {hint}
                </span>
            )}
        </span>
    </button>
);

/**
 * The phone menu for the customer site — logged out (`guest`) or a signed-in
 * customer. A bottom sheet opened from the tab bar's Menu button: account
 * options first (log in / create account, or the profile card with Profile
 * and Settings), the theme options already open, the pages the tab bar
 * doesn't cover, and Log out. Swipe down, tap outside or press Escape to
 * close. Admin and partner dashboards use their own drawer.
 */
const SiteMenuSheet = ({
    open,
    onClose,
    variant = "guest",
    // [{ path, label, end? }] — pages not already in the tab bar.
    links = [],
}) => {
    const navigate = useNavigate();

    const { user, logout, logoutLoading } = useAuth();

    const {
        configuration,
        setColorTheme,
        isChristmasAvailable,
    } = useTheme();

    const isCustomer = variant === "customer";

    // Only the handle starts a drag, so the content scrolls normally.
    const dragControls = useDragControls();

    useEffect(() => {
        if (!open) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const handleKey = (event) => {
            if (event.key === "Escape" && !logoutLoading) onClose();
        };

        window.addEventListener("keydown", handleKey);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKey);
        };
    }, [open, onClose, logoutLoading]);

    const close = () => {
        if (logoutLoading) return;

        onClose();
    };

    const goTo = (path) => {
        close();
        navigate(path);
    };

    const handleLogout = async () => {
        if (logoutLoading) return;

        try {
            await logout();

            onClose();

            navigate("/login", { replace: true });
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

    if (typeof document === "undefined") return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="menu-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        onClick={close}
                        className="fixed inset-0 z-[55] bg-black/45 backdrop-blur-sm dark:bg-black/65 lg:hidden"
                    />

                    <motion.div
                        key="menu-sheet"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Menu"
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={SHEET_SPRING}
                        drag={logoutLoading ? false : "y"}
                        dragControls={dragControls}
                        dragListener={false}
                        dragConstraints={{ top: 0, bottom: 0 }}
                        dragElastic={{ top: 0, bottom: 0.6 }}
                        onDragEnd={(_event, info) => {
                            if (
                                info.offset.y > CLOSE_DRAG_PX ||
                                info.velocity.y > CLOSE_DRAG_VELOCITY
                            ) {
                                close();
                            }
                        }}
                        className="fixed inset-x-0 bottom-0 z-[56] flex max-h-[90dvh] flex-col rounded-t-[28px] bg-gray-50 pb-[env(safe-area-inset-bottom)] shadow-2xl dark:bg-gray-950 lg:hidden"
                    >
                        {/* Yellow lip + grab handle. */}
                        <div
                            onPointerDown={(event) =>
                                dragControls.start(event)
                            }
                            style={{ touchAction: "none" }}
                            className="relative shrink-0 cursor-grab rounded-t-[28px] pb-3 pt-2.5 active:cursor-grabbing"
                        >
                            <div className="absolute inset-x-0 top-0 h-1 rounded-t-[28px] bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-400" />
                            <span className="mx-auto mt-1 block h-1.5 w-11 rounded-full bg-gray-300 dark:bg-gray-700" />

                            <button
                                type="button"
                                onClick={close}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                aria-label="Close menu"
                                className="absolute right-4 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:text-gray-950 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800 dark:hover:text-white"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 pb-8">
                            {/* Who's here. */}
                            {isCustomer ? (
                                <div className="flex items-center gap-3.5 pr-10">
                                    <span
                                        aria-hidden="true"
                                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-yellow-400 text-lg font-extrabold text-gray-950 shadow-md shadow-yellow-500/30"
                                    >
                                        {initials || <User size={24} />}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                            Signed in as
                                        </p>
                                        <p className="truncate text-lg font-extrabold tracking-tight text-gray-950 dark:text-white">
                                            {displayName || "Customer"}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="pr-10 text-xl font-extrabold tracking-tight text-gray-950 dark:text-white">
                                        Welcome to Rent-A-Ride Albay
                                    </p>
                                    <p className="mt-1 pr-10 text-sm text-gray-500 dark:text-gray-400">
                                        Log in to book a vehicle and keep
                                        track of your rentals.
                                    </p>

                                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => goTo("/login")}
                                            className="flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-2 bg-yellow-400 text-[13px] font-bold text-gray-950 shadow-md shadow-yellow-500/25 transition-colors hover:bg-yellow-300"
                                        >
                                            <LogIn size={17} className="shrink-0" />
                                            Log in
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => goTo("/register")}
                                            className="flex h-12 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-2 border border-gray-300 bg-white text-[13px] font-bold text-gray-900 transition-colors hover:border-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                                        >
                                            <UserPlus size={17} className="shrink-0" />
                                            Create account
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isCustomer && (
                                <div>
                                    <SectionLabel>Account</SectionLabel>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <Tile
                                            icon={User}
                                            label="My Profile"
                                            hint="Details & license"
                                            disabled={logoutLoading}
                                            onClick={() =>
                                                goTo("/customer/profile")
                                            }
                                        />
                                        <Tile
                                            icon={Settings}
                                            label="Settings"
                                            hint="Password & alerts"
                                            disabled={logoutLoading}
                                            onClick={() =>
                                                goTo("/customer/settings")
                                            }
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Already open — no extra tap to change it. */}
                            <div>
                                <SectionLabel>Theme</SectionLabel>
                                <div
                                    role="radiogroup"
                                    aria-label="Theme"
                                    className={`grid gap-1.5 rounded-2xl bg-gray-200/70 p-1.5 dark:bg-gray-900 ${
                                        themeOptions.length > 3
                                            ? "grid-cols-2 min-[440px]:grid-cols-4"
                                            : "grid-cols-3"
                                    }`}
                                >
                                    {themeOptions.map(
                                        ({ value, label, icon: Icon }) => {
                                            const isActive =
                                                configuration?.colorTheme ===
                                                value;

                                            return (
                                                <button
                                                    key={value}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={isActive}
                                                    onClick={() =>
                                                        setColorTheme(value)
                                                    }
                                                    className={`relative flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2.5 text-[11px] font-semibold transition-colors ${
                                                        isActive
                                                            ? "bg-white text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white"
                                                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                                    }`}
                                                >
                                                    <Icon
                                                        size={17}
                                                        className={
                                                            isActive
                                                                ? "text-yellow-600 dark:text-yellow-400"
                                                                : ""
                                                        }
                                                    />
                                                    <span className="w-full truncate text-center">
                                                        {label}
                                                    </span>
                                                    {isActive && (
                                                        <Check
                                                            size={11}
                                                            strokeWidth={3}
                                                            className="absolute right-1.5 top-1.5 text-yellow-600 dark:text-yellow-400"
                                                        />
                                                    )}
                                                </button>
                                            );
                                        }
                                    )}
                                </div>
                            </div>

                            {links.length > 0 && (
                                <div>
                                    <SectionLabel>More</SectionLabel>
                                    <div className="flex flex-wrap gap-2">
                                        {links.map(
                                            ({ path, label, end }) => {
                                                const Icon =
                                                    LINK_ICONS[path] ??
                                                    ArrowRight;

                                                return (
                                                    <NavLink
                                                        key={path}
                                                        to={path}
                                                        end={end}
                                                        onClick={close}
                                                        className={({
                                                            isActive,
                                                        }) =>
                                                            `inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                                                                isActive
                                                                    ? "border-yellow-400 bg-yellow-400/15 text-gray-950 dark:text-white"
                                                                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200"
                                                            }`
                                                        }
                                                    >
                                                        <Icon
                                                            size={15}
                                                            className="text-gray-400"
                                                        />
                                                        {label}
                                                    </NavLink>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                            )}

                            {isCustomer && (
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    disabled={logoutLoading}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-wait disabled:opacity-70 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/15"
                                >
                                    {logoutLoading ? (
                                        <LoaderCircle
                                            size={17}
                                            className="animate-spin"
                                        />
                                    ) : (
                                        <LogOut size={17} />
                                    )}
                                    {logoutLoading ? "Logging out..." : "Log out"}
                                </button>
                            )}

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default SiteMenuSheet;
