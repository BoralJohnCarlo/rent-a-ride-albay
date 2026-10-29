import {
    useEffect,
    useRef,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import { useNavigate } from "react-router-dom";

import {
    Bell,
    Check,
    ChevronDown,
    ChevronLeft,
    CircleUserRound,
    LoaderCircle,
    LogIn,
    LogOut,
    Palette,
    Settings,
    UserPlus,
    User,
} from "lucide-react";

import useTheme from "../../hooks/theme/useTheme";
import useAuth from "../../hooks/auth/useAuth";

import {
    getThemeOptions,
} from "../../config/themeOptions";

const SPRING = {
    type: "spring",
    stiffness: 200,
    damping: 28,
};

const ROLE_LABELS = {
    admin: "Admin",
    systemadministrator: "Admin",
    "system administrator": "Admin",
    customer: "Customer",
    operator: "Partner",
};

const SETTINGS_PATH_BY_ROLE = {
    admin: "/admin/settings",
    operator: "/operator/settings",
    customer: "/customer/settings",
};

const getRoleLabel = (role) => {
    if (!role) return "User";
    return ROLE_LABELS[role.toLowerCase()] || role.charAt(0).toUpperCase() + role.slice(1);
};

const UserMenu = ({
    user,
    onLogout,
    isPublic = false,
    notificationPath = "/admin/notifications",
    onHoverChange,
    // Fully rounded trigger, to sit inside the pill navbar.
    pill = false,
    // Glass look while floating over the home hero (see useNavbarOverHero).
    overHero = false,
}) => {
    const navigate = useNavigate();

    const menuRef = useRef(null);

    const collapseTimeout =
        useRef(null);

    const [expanded, setExpanded] =
        useState(false);

    const [open, setOpen] =
        useState(false);

    const [themeOpen, setThemeOpen] =
        useState(false);

    const {
        logoutLoading,
    } = useAuth();

    const {
        configuration,
        setColorTheme,
        isChristmasAvailable,
    } = useTheme();

const collapsedLabel = isPublic
        ? "Login"
        : user?.role
            ? getRoleLabel(user.role)
            : "User";

    // The admin account's name ("System Administrator") is long enough to
    // stretch the menu — show just the first name for that role.
    const displayName =
        user?.role === "admin"
            ? user?.firstName
            : [user?.firstName, user?.lastName]
                  .filter(Boolean)
                  .join(" ");

    useEffect(() => {
        const handleClickOutside = (
            event
        ) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(
                    event.target
                )
            ) {
                if (logoutLoading) {
                    return;
                }

                setOpen(false);
                setThemeOpen(false);
                setExpanded(false);
            }
        };

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );

            clearTimeout(
                collapseTimeout.current
            );
        };
    }, [logoutLoading]);

    useEffect(() => {
        if (onHoverChange) onHoverChange(expanded);
    }, [expanded, onHoverChange]);

    const handleMouseEnter = () => {
        clearTimeout(
            collapseTimeout.current
        );

        setExpanded(true);
    };

    const handleMouseLeave = () => {
        if (
            logoutLoading ||
            open ||
            themeOpen
        ) {
            return;
        }

        collapseTimeout.current =
            setTimeout(() => {
                setExpanded(false);
            }, 120);
    };

    const toggleMenu = () => {
        if (logoutLoading) {
            return;
        }

        setExpanded(true);

        setOpen(
            (previous) => {
                const next =
                    !previous;

                if (!next) {
                    setThemeOpen(false);
                }

                return next;
            }
        );
    };

    const handleThemeToggle = () => {
        if (logoutLoading) {
            return;
        }

        setExpanded(true);

        setThemeOpen(
            (previous) => !previous
        );
    };

    const handleThemeChange = (
        theme
    ) => {
        if (logoutLoading) {
            return;
        }

        setColorTheme(theme);
        setThemeOpen(false);
        setOpen(true);
        setExpanded(true);
    };

    const handlePublicNavigation = (
        path
    ) => {
        if (logoutLoading) {
            return;
        }

        setOpen(false);
        setThemeOpen(false);
        setExpanded(false);

        navigate(path);
    };

    const handleMenuNavigation = (
        path
    ) => {
        if (logoutLoading) {
            return;
        }

        setOpen(false);
        setThemeOpen(false);
        setExpanded(false);

        navigate(path);
    };

    const handleProfileNavigation = () => {
        if (logoutLoading) {
            return;
        }

        setOpen(false);
        setThemeOpen(false);
        setExpanded(false);

        navigate(
            user?.role === "operator"
                ? "/operator/profile"
                : "/customer/profile"
        );
    };

    const handleLogout =
        async () => {
            if (
                isPublic ||
                logoutLoading ||
                !onLogout
            ) {
                return;
            }

            setThemeOpen(false);
            setOpen(true);
            setExpanded(true);

            try {
                await onLogout();

                navigate("/login", {
                    replace: true,
                });
            } catch (error) {
                console.error(error);

                setOpen(false);
                setThemeOpen(false);
                setExpanded(false);
            }
        };

    const themeOptions = getThemeOptions({
        christmasAvailable: isChristmasAvailable,
    });

    return (
        <div
            ref={menuRef}
            className="relative"
            onMouseEnter={
                handleMouseEnter
            }
            onMouseLeave={
                handleMouseLeave
            }
        >
            <motion.button
                layout
                type="button"
                onClick={toggleMenu}
                disabled={logoutLoading}
                whileHover={
                    logoutLoading
                        ? undefined
                        : {
                              y: -2,
                          }
                }
                whileTap={
                    logoutLoading
                        ? undefined
                        : {
                              scale: 0.98,
                          }
                }
                animate={{
                    boxShadow: expanded
                        ? "0 10px 30px rgba(0,0,0,0.12)"
                        : "0 1px 3px rgba(0,0,0,0.08)",
                }}
                transition={{
                    ...SPRING,
                    boxShadow: {
                        duration: 0.18,
                    },
                }}
                className={`
                    flex
                    items-center
                    gap-3
                    overflow-hidden
                    ${pill ? "rounded-full" : "rounded-2xl"}
                    border
                    px-3
                    py-2
                    transition-all
                    duration-500
                    ${
                        overHero
                            ? "border-white/15 bg-gray-950/25 text-white shadow-lg shadow-black/10 backdrop-blur-xl hover:bg-gray-950/40 [&_p]:!text-white [&_p+p]:!text-white/60 [&_svg]:!text-white"
                            : "border-gray-200 bg-white text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                    }
                    disabled:cursor-wait
                    disabled:opacity-80
                `}
            >
                <motion.div
                    animate={{
                        scale: expanded
                            ? 1.08
                            : 1,
                    }}
                    transition={SPRING}
                >
                    {logoutLoading ? (
                        <LoaderCircle
                            size={24}
                            className="
                                animate-spin
                                text-gray-500
                                dark:text-gray-400
                            "
                        />
                    ) : (
                        <CircleUserRound
                            size={24}
                            className="
                                text-gray-700
                                dark:text-gray-200
                            "
                        />
                    )}
                </motion.div>

                <motion.div
                    layout
                    transition={SPRING}
                    className="
                        flex
                        items-center
                        overflow-hidden
                    "
                >
                    <AnimatePresence
                        initial={false}
                        mode="popLayout"
                    >
                        {expanded ? (
                            <motion.div
                                key="expanded"
                                layout
                                initial={{
                                    opacity: 0,
                                    x: -8,
                                }}
                                animate={{
                                    opacity: 1,
                                    x: 0,
                                }}
                                exit={{
                                    opacity: 0,
                                    x: -8,
                                }}
                                transition={SPRING}
                                className="
                                    whitespace-nowrap
                                    text-left
                                "
                            >
                                {logoutLoading ? (
                                    <p className="
                                        text-sm
                                        font-medium
                                        text-gray-700
                                        dark:text-gray-200
                                    ">
                                        Logging out...
                                    </p>
                                ) : isPublic ? (
                                    <p className="
                                        text-sm
                                        font-medium
                                        text-gray-900
                                        dark:text-gray-100
                                    ">
                                        Login
                                    </p>
                                ) : (
                                    <>
                                        <p className="
                                            text-sm
                                            font-medium
                                            text-gray-900
                                            dark:text-gray-100
                                        ">
                                            {displayName}
                                        </p>

                                        <p className="
                                            text-xs
                                            capitalize
                                            text-gray-500
                                            dark:text-gray-400
                                        ">
                                            {getRoleLabel(user?.role)}
                                        </p>
                                    </>
                                )}
                            </motion.div>
                        ) : (
                            <motion.p
                                key="collapsed"
                                layout
                                initial={{
                                    opacity: 0,
                                    x: 8,
                                }}
                                animate={{
                                    opacity: 1,
                                    x: 0,
                                }}
                                exit={{
                                    opacity: 0,
                                    x: 8,
                                }}
                                transition={SPRING}
                                className="
                                    whitespace-nowrap
                                    text-sm
                                    font-medium
                                    text-gray-900
                                    dark:text-gray-100
                                "
                            >
                                {logoutLoading
                                    ? "Logging out..."
                                    : collapsedLabel}
                            </motion.p>
                        )}
                    </AnimatePresence>
                </motion.div>

                {!logoutLoading && (
                    <motion.div
                        layout
                        animate={{
                            rotate: open
                                ? 180
                                : 0,
                            opacity: expanded
                                ? 1
                                : 0,
                            width: expanded
                                ? "auto"
                                : 0,
                            marginLeft: expanded
                                ? 0
                                : -6,
                        }}
                        transition={SPRING}
                        className="
                            overflow-hidden
                            text-gray-600
                            dark:text-gray-300
                        "
                    >
                        <ChevronDown
                            size={18}
                        />
                    </motion.div>
                )}
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: -8,
                            scale: 0.96,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                        }}
                        exit={{
                            opacity: 0,
                            y: -6,
                            scale: 0.98,
                        }}
                        transition={SPRING}
                        className={`
                            absolute
                            right-0
                            z-50
                            mt-2
                            w-56
                            overflow-visible
                            rounded-2xl
                            border
                            border-gray-200
                            bg-white
                            p-1
                            shadow-xl
                            dark:border-gray-700
                            dark:bg-gray-900
                            ${overHero ? "menu-glass" : ""}
                        `}
                    >
                        {!isPublic &&
                            (user?.role === "customer" ||
                                user?.role === "operator") && (
                            <motion.button
                                whileHover={{
                                    x: 4,
                                }}
                                whileTap={{
                                    scale: 0.98,
                                }}
                                transition={SPRING}
                                type="button"
                                onClick={
                                    handleProfileNavigation
                                }
                                disabled={
                                    logoutLoading
                                }
                                className="
                                    flex
                                    w-full
                                    items-center
                                    gap-3
                                    rounded-xl
                                    px-3
                                    py-3
                                    text-left
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    transition-colors
                                    hover:bg-gray-100
                                    dark:text-gray-200
                                    dark:hover:bg-gray-800
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                            >
                                <User
                                    size={18}
                                    className="
                                        shrink-0
                                        text-gray-500
                                        dark:text-gray-400
                                    "
                                />

                                <span className="flex-1">
                                    My Profile
                                </span>
                            </motion.button>
                        )}

                        <motion.button
                            whileHover={
                                logoutLoading
                                    ? undefined
                                    : {
                                          x: 4,
                                      }
                            }
                            whileTap={
                                logoutLoading
                                    ? undefined
                                    : {
                                          scale: 0.98,
                                      }
                            }
                            transition={SPRING}
                            type="button"
                            onClick={
                                handleThemeToggle
                            }
                            disabled={
                                logoutLoading
                            }
                            className="
                                flex
                                w-full
                                items-center
                                gap-3
                                rounded-xl
                                px-3
                                py-3
                                text-left
                                text-sm
                                font-medium
                                text-gray-700
                                transition-colors
                                hover:bg-gray-100
                                dark:text-gray-200
                                dark:hover:bg-gray-800
                                disabled:cursor-not-allowed
                                disabled:opacity-60
                            "
                        >
                            <Palette
                                size={18}
                                className="
                                    shrink-0
                                    text-gray-500
                                    dark:text-gray-400
                                "
                            />

                            <span className="flex-1">
                                Theme
                            </span>

                            <motion.div
                                animate={{
                                    x: themeOpen
                                        ? -2
                                        : 0,
                                }}
                            >
                                <ChevronLeft
                                    size={17}
                                    className="
                                        text-gray-400
                                        dark:text-gray-500
                                    "
                                />
                            </motion.div>
                        </motion.button>

                        <AnimatePresence>
                            {themeOpen &&
                                !logoutLoading && (
                                    <motion.div
                                        initial={{
                                            opacity: 0,
                                            x: 8,
                                            scale: 0.96,
                                        }}
                                        animate={{
                                            opacity: 1,
                                            x: 0,
                                            scale: 1,
                                        }}
                                        exit={{
                                            opacity: 0,
                                            x: 8,
                                            scale: 0.96,
                                        }}
                                        transition={
                                            SPRING
                                        }
                                        className={`
                                            absolute
                                            right-full
                                            top-0
                                            mr-2
                                            w-48
                                            rounded-2xl
                                            border
                                            border-gray-200
                                            bg-white
                                            p-1
                                            shadow-xl
                                            dark:border-gray-700
                                            dark:bg-gray-900
                                            ${overHero ? "menu-glass" : ""}
                                        `}
                                    >
                                        <div
                                            className="
                                                px-3
                                                py-2
                                                text-xs
                                                font-semibold
                                                uppercase
                                                tracking-wider
                                                text-gray-400
                                                dark:text-gray-500
                                            "
                                        >
                                            Theme
                                        </div>

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
                                                    <motion.button
                                                        key={
                                                            value
                                                        }
                                                        type="button"
                                                        whileHover={{
                                                            x: 3,
                                                        }}
                                                        whileTap={{
                                                            scale: 0.98,
                                                        }}
                                                        transition={
                                                            SPRING
                                                        }
                                                        onClick={() =>
                                                            handleThemeChange(
                                                                value
                                                            )
                                                        }
                                                        disabled={
                                                            logoutLoading
                                                        }
                                                        className={[
                                                            "flex",
                                                            "w-full",
                                                            "items-center",
                                                            "gap-3",
                                                            "rounded-xl",
                                                            "px-3",
                                                            "py-2.5",
                                                            "text-left",
                                                            "text-sm",
                                                            "transition-colors",
                                                            "disabled:cursor-not-allowed",
                                                            "disabled:opacity-60",
                                                            isActive
                                                                ? "bg-yellow-50 text-gray-900 dark:bg-yellow-500/10 dark:text-gray-100"
                                                                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
                                                        ].join(
                                                            " "
                                                        )}
                                                    >
                                                        <Icon
                                                            size={
                                                                17
                                                            }
                                                            className={
                                                                isActive
                                                                    ? "text-yellow-600 dark:text-yellow-400"
                                                                    : "text-gray-500 dark:text-gray-400"
                                                            }
                                                        />

                                                        <span className="flex-1">
                                                            {
                                                                label
                                                            }
                                                        </span>

                                                        {isActive && (
                                                            <Check
                                                                size={
                                                                    17
                                                                }
                                                                className="
                                                                    text-yellow-600
                                                                    dark:text-yellow-400
                                                                "
                                                            />
                                                        )}
                                                    </motion.button>
                                                );
                                            }
                                        )}
                                    </motion.div>
                                )}
                        </AnimatePresence>

                        {!isPublic && (
                            <motion.button
                                whileHover={
                                    logoutLoading
                                        ? undefined
                                        : {
                                              x: 4,
                                          }
                                }
                                whileTap={
                                    logoutLoading
                                        ? undefined
                                        : {
                                              scale: 0.98,
                                          }
                                }
                                transition={SPRING}
                                type="button"
                                onClick={() =>
                                    handleMenuNavigation(
                                        notificationPath
                                    )
                                }
                                disabled={
                                    logoutLoading
                                }
                                className="
                                    flex
                                    w-full
                                    items-center
                                    gap-3
                                    rounded-xl
                                    px-3
                                    py-3
                                    text-left
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    transition-colors
                                    hover:bg-gray-100
                                    dark:text-gray-200
                                    dark:hover:bg-gray-800
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                            >
                                <Bell
                                    size={18}
                                    className="
                                        shrink-0
                                        text-gray-500
                                        dark:text-gray-400
                                    "
                                />

                                <span className="flex-1">
                                    Notifications
                                </span>
                            </motion.button>
                        )}

                        {/* Quick links only — each settings page is still guarded by its role route. */}
                        {!isPublic &&
                            SETTINGS_PATH_BY_ROLE[user?.role] && (
                            <motion.button
                                whileHover={
                                    logoutLoading
                                        ? undefined
                                        : {
                                              x: 4,
                                          }
                                }
                                whileTap={
                                    logoutLoading
                                        ? undefined
                                        : {
                                              scale: 0.98,
                                          }
                                }
                                transition={SPRING}
                                type="button"
                                onClick={() =>
                                    handleMenuNavigation(
                                        SETTINGS_PATH_BY_ROLE[user.role]
                                    )
                                }
                                disabled={
                                    logoutLoading
                                }
                                className="
                                    flex
                                    w-full
                                    items-center
                                    gap-3
                                    rounded-xl
                                    px-3
                                    py-3
                                    text-left
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    transition-colors
                                    hover:bg-gray-100
                                    dark:text-gray-200
                                    dark:hover:bg-gray-800
                                    disabled:cursor-not-allowed
                                    disabled:opacity-60
                                "
                            >
                                <Settings
                                    size={18}
                                    className="
                                        shrink-0
                                        text-gray-500
                                        dark:text-gray-400
                                    "
                                />

                                <span className="flex-1">
                                    Settings
                                </span>
                            </motion.button>
                        )}

                        <div
                            className="
                                my-1
                                h-px
                                bg-gray-100
                                dark:bg-gray-800
                            "
                        />

                        {isPublic ? (
                            <>
                                <motion.button
                                    whileHover={{
                                        x: 4,
                                    }}
                                    whileTap={{
                                        scale: 0.98,
                                    }}
                                    transition={
                                        SPRING
                                    }
                                    type="button"
                                    onClick={() =>
                                        handlePublicNavigation(
                                            "/login"
                                        )
                                    }
                                    className="
                                        flex
                                        w-full
                                        items-center
                                        gap-3
                                        rounded-xl
                                        px-3
                                        py-3
                                        text-left
                                        text-sm
                                        font-medium
                                        text-gray-700
                                        transition-colors
                                        hover:bg-gray-100
                                        dark:text-gray-200
                                        dark:hover:bg-gray-800
                                    "
                                >
                                    <LogIn
                                        size={18}
                                        className="
                                            text-gray-500
                                            dark:text-gray-400
                                        "
                                    />

                                    Login
                                </motion.button>

                                <motion.button
                                    whileHover={{
                                        x: 4,
                                    }}
                                    whileTap={{
                                        scale: 0.98,
                                    }}
                                    transition={
                                        SPRING
                                    }
                                    type="button"
                                    onClick={() =>
                                        handlePublicNavigation(
                                            "/register"
                                        )
                                    }
                                    className="
                                        flex
                                        w-full
                                        items-center
                                        gap-3
                                        rounded-xl
                                        px-3
                                        py-3
                                        text-left
                                        text-sm
                                        font-medium
                                        text-gray-700
                                        transition-colors
                                        hover:bg-gray-100
                                        dark:text-gray-200
                                        dark:hover:bg-gray-800
                                    "
                                >
                                    <UserPlus
                                        size={18}
                                        className="
                                            text-gray-500
                                            dark:text-gray-400
                                        "
                                    />

                                    Register
                                </motion.button>
                            </>
                        ) : (
                            <motion.button
                                whileHover={
                                    logoutLoading
                                        ? undefined
                                        : {
                                              x: 4,
                                          }
                                }
                                whileTap={
                                    logoutLoading
                                        ? undefined
                                        : {
                                              scale: 0.98,
                                          }
                                }
                                transition={SPRING}
                                type="button"
                                onClick={
                                    handleLogout
                                }
                                disabled={
                                    logoutLoading
                                }
                                className="
                                    flex
                                    w-full
                                    items-center
                                    gap-3
                                    rounded-xl
                                    px-3
                                    py-3
                                    text-left
                                    text-sm
                                    font-medium
                                    text-red-600
                                    transition-colors
                                    hover:bg-red-50
                                    dark:text-red-400
                                    dark:hover:bg-red-500/10
                                    disabled:cursor-wait
                                    disabled:opacity-70
                                "
                            >
                                {logoutLoading ? (
                                    <LoaderCircle
                                        size={18}
                                        className="
                                            animate-spin
                                        "
                                    />
                                ) : (
                                    <motion.div
                                        whileHover={{
                                            rotate: -12,
                                        }}
                                        transition={
                                            SPRING
                                        }
                                    >
                                        <LogOut
                                            size={18}
                                        />
                                    </motion.div>
                                )}

                                {logoutLoading
                                    ? "Logging out..."
                                    : "Logout"}
                            </motion.button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default UserMenu;