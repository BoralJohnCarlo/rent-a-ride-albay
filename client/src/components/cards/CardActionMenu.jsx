import { AnimatePresence, motion } from "framer-motion";
import { MoreVertical } from "lucide-react";
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 176; // matches min-w-44
const VIEWPORT_MARGIN = 8;

/*
 * Renders its dropdown into a portal on document.body instead of as a
 * sibling of the trigger button. Any ancestor with `overflow-hidden` (a
 * table row, a rounded card) used to clip this menu the moment the trigger
 * sat near that ancestor's edge - a portal escapes that entirely, since
 * position is computed from the trigger's actual viewport coordinates
 * rather than inherited from the DOM flow.
 */
const CardActionMenu = ({
    actions = [],
}) => {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);

    const triggerRef = useRef(null);
    const menuRef = useRef(null);

    const updatePosition = () => {
        if (!triggerRef.current) {
            return;
        }

        const rect =
            triggerRef.current.getBoundingClientRect();

        const left = Math.max(
            VIEWPORT_MARGIN,
            Math.min(
                rect.right - MENU_WIDTH,
                window.innerWidth -
                    MENU_WIDTH -
                    VIEWPORT_MARGIN
            )
        );

        setPosition({
            top: rect.bottom + 6,
            left,
        });
    };

    useLayoutEffect(() => {
        if (open) {
            updatePosition();
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleReposition = () =>
            updatePosition();

        window.addEventListener(
            "scroll",
            handleReposition,
            true
        );
        window.addEventListener(
            "resize",
            handleReposition
        );

        return () => {
            window.removeEventListener(
                "scroll",
                handleReposition,
                true
            );
            window.removeEventListener(
                "resize",
                handleReposition
            );
        };
    }, [open]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                triggerRef.current?.contains(
                    event.target
                ) ||
                menuRef.current?.contains(
                    event.target
                )
            ) {
                return;
            }

            setOpen(false);
        };

        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        document.addEventListener(
            "keydown",
            handleEscape
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );

            document.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, []);

    return (
        <div
            ref={triggerRef}
            data-no-toggle
            className="relative flex-shrink-0"
            onClick={(event) =>
                event.stopPropagation()
            }
        >
            <button
                type="button"
                aria-label="Open actions"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen((previous) => !previous);
                }}
                className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-full
                    border
                    border-gray-200
                    bg-white
                    text-gray-500
                    shadow-sm
                    transition-all
                    duration-200
                    hover:bg-gray-100
                    hover:text-gray-900
                    focus:outline-none
                    focus:ring-2
                    focus:ring-blue-500
                    dark:border-gray-700
                    dark:bg-gray-800
                    dark:text-gray-400
                    dark:hover:bg-gray-700
                    dark:hover:text-white
                "
            >
                <MoreVertical size={16} />
            </button>

            {createPortal(
                <AnimatePresence>
                    {open && position && (
                        <motion.div
                            ref={menuRef}
                            initial={{
                                opacity: 0,
                                y: -6,
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
                                scale: 0.96,
                            }}
                            transition={{
                                duration: 0.16,
                                ease: "easeOut",
                            }}
                            role="menu"
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                            style={{
                                position: "fixed",
                                top: position.top,
                                left: position.left,
                                width: MENU_WIDTH,
                            }}
                            className="
                                z-[100]
                                overflow-hidden
                                rounded-xl
                                border
                                border-gray-200
                                bg-white
                                py-1.5
                                shadow-xl
                                dark:border-gray-700
                                dark:bg-gray-900
                            "
                        >
                            {actions.map(
                                (
                                    action,
                                    index
                                ) => {
                                    const Icon =
                                        action.icon;

                                    const variantClass =
                                        action.variant ===
                                        "danger"
                                            ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                                            : action.variant ===
                                                "success"
                                              ? "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40"
                                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800";

                                    const itemClass = [
                                        "flex",
                                        "w-full",
                                        "items-center",
                                        "gap-2.5",
                                        "px-3",
                                        "py-2",
                                        "text-left",
                                        "text-[13px]",
                                        "transition-colors",
                                        variantClass,
                                    ].join(" ");

                                    // A link action opens in a new tab.
                                    if (
                                        action.href &&
                                        !action.disabled
                                    ) {
                                        return (
                                            <a
                                                key={index}
                                                href={action.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                role="menuitem"
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setOpen(false);
                                                }}
                                                className={itemClass}
                                            >
                                                {Icon && (
                                                    <Icon size={15} />
                                                )}
                                                <span>
                                                    {action.label}
                                                </span>
                                            </a>
                                        );
                                    }

                                    return (
                                        <button
                                            key={index}
                                            type="button"
                                            role="menuitem"
                                            disabled={
                                                action.disabled
                                            }
                                            onClick={(
                                                event
                                            ) => {
                                                event.stopPropagation();

                                                if (
                                                    action.disabled
                                                ) {
                                                    return;
                                                }

                                                setOpen(
                                                    false
                                                );

                                                action.onClick?.();
                                            }}
                                            className={[
                                                "flex",
                                                "w-full",
                                                "items-center",
                                                "gap-2.5",
                                                "px-3",
                                                "py-2",
                                                "text-left",
                                                "text-[13px]",
                                                "transition-colors",
                                                variantClass,
                                                action.disabled
                                                    ? "cursor-not-allowed opacity-50"
                                                    : "",
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(" ")}
                                        >
                                            {Icon && (
                                                <Icon
                                                    size={
                                                        15
                                                    }
                                                />
                                            )}

                                            <span>
                                                {
                                                    action.label
                                                }
                                            </span>
                                        </button>
                                    );
                                }
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
};

export default CardActionMenu;
