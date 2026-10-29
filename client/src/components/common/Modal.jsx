import {
    useEffect,
    useRef,
} from "react";

import { createPortal } from "react-dom";
import {
    AnimatePresence,
    motion,
} from "framer-motion";
import { X } from "lucide-react";

import useMediaQuery from "../../hooks/ui/useMediaQuery";

const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-7xl",
};

const overlayVariants = {
    hidden: {
        opacity: 0,
    },
    visible: {
        opacity: 1,
    },
    exit: {
        opacity: 0,
    },
};

const modalVariants = {
    hidden: {
        opacity: 0,
        scale: 0.98,
        y: 12,
    },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            duration: 0.2,
            ease: "easeOut",
        },
    },
    exit: {
        opacity: 0,
        scale: 0.98,
        y: 12,
        transition: {
            duration: 0.15,
            ease: "easeIn",
        },
    },
};

// Phones: a bottom sheet that slides up instead of a centred card.
const sheetVariants = {
    hidden: {
        y: "100%",
    },
    visible: {
        y: 0,
        transition: {
            type: "spring",
            stiffness: 380,
            damping: 38,
        },
    },
    exit: {
        y: "100%",
        transition: {
            duration: 0.2,
            ease: "easeIn",
        },
    },
};

const Modal = ({
    isOpen,
    open,
    onClose,
    title,
    // Optional line under the title, in the header.
    description,
    children,
    footer,
    size = "md",
    closeOnOverlayClick = true,
    closeOnEscape = true,
}) => {
    // Accept `open` as an alias for `isOpen` — several dialogs pass `open`.
    const visible = isOpen ?? open ?? false;

    // A true edge-to-edge takeover — no backdrop margin, no rounded card,
    // fills the viewport — distinct from size="full" (max-w-7xl), which is
    // still a centered dialog just at the widest available width.
    const isFullscreen = size === "fullscreen";

    const isSheet =
        useMediaQuery("(width < 40rem)") && !isFullscreen;

    const bodyRef = useRef(null);

    useEffect(() => {
        if (!visible) {
            return;
        }

        // Restore whatever was there, not "" — a modal opened on top of
        // another locked dialog (e.g. the booking dialog) must keep it locked.
        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow =
                previousOverflow;
        };
    }, [visible]);

    useEffect(() => {
        if (!closeOnEscape || !visible) {
            return;
        }

        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                onClose?.();
            }
        };

        window.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {
            window.removeEventListener(
                "keydown",
                handleKeyDown
            );
        };
    }, [
        closeOnEscape,
        visible,
        onClose,
    ]);

    return createPortal(
        <AnimatePresence>
            {visible && (
                <div
                    className={`fixed inset-0 z-50 flex justify-center ${
                        isSheet
                            ? "items-end"
                            : isFullscreen
                              ? "items-center"
                              : "items-center p-4"
                    }`}
                >
                    <motion.div
                        className="absolute inset-0 bg-black/50"
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{
                            duration: 0.2,
                        }}
                        onClick={() => {
                            if (
                                closeOnOverlayClick
                            ) {
                                onClose?.();
                            }
                        }}
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={
                            typeof title === "string"
                                ? title
                                : undefined
                        }
                        variants={
                            isSheet ? sheetVariants : modalVariants
                        }
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={
                            isFullscreen
                                ? "relative z-10 flex h-full w-full flex-col bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100"
                                : isSheet
                                  ? "relative z-10 flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] text-gray-900 shadow-2xl dark:bg-gray-900 dark:text-gray-100"
                                  : `
                            relative
                            z-10
                            flex
                            max-h-[90dvh]
                            w-full
                            flex-col
                            rounded-xl
                            bg-white
                            text-gray-900
                            shadow-xl
                            dark:bg-gray-900
                            dark:text-gray-100
                            ${sizes[size]}
                        `
                        }
                    >
                        {isSheet && (
                            <span
                                aria-hidden="true"
                                className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300 dark:bg-gray-700"
                            />
                        )}

                        <div
                            className="
                                flex
                                shrink-0
                                items-center
                                justify-between
                                gap-3
                                border-b
                                border-gray-200
                                px-4
                                py-3
                                dark:border-gray-800
                                sm:px-6
                                sm:py-4
                            "
                        >
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold sm:text-xl">
                                    {title}
                                </h2>

                                {description && (
                                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                                        {description}
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={onClose}
                                className="
                                    flex
                                    h-10
                                    w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-md
                                    text-gray-500
                                    transition
                                    hover:bg-gray-100
                                    hover:text-gray-700
                                    dark:text-gray-400
                                    dark:hover:bg-gray-800
                                    dark:hover:text-gray-200
                                "
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div
                            id="modal-body"
                            ref={bodyRef}
                            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
                        >
                            {children}
                        </div>

                        {footer && (
                            <div
                                className="
                                    flex
                                    shrink-0
                                    flex-wrap
                                    justify-end
                                    gap-3
                                    border-t
                                    border-gray-200
                                    px-4
                                    py-3
                                    dark:border-gray-800
                                    sm:px-6
                                    sm:py-4
                                "
                            >
                                {footer}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default Modal;