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

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = "md",
    closeOnOverlayClick = true,
    closeOnEscape = true,
}) => {
    const bodyRef = useRef(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    useEffect(() => {
        if (!closeOnEscape || !isOpen) {
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
        isOpen,
        onClose,
    ]);

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className={`
                            relative
                            z-10
                            w-full
                            rounded-xl
                            bg-white
                            text-gray-900
                            shadow-xl
                            dark:bg-gray-900
                            dark:text-gray-100
                            ${sizes[size]}
                        `}
                    >
                        <div
                            className="
                                flex
                                items-center
                                justify-between
                                border-b
                                border-gray-200
                                px-6
                                py-4
                                dark:border-gray-800
                            "
                        >
                            <h2 className="text-xl font-semibold">
                                {title}
                            </h2>

                            <button
                                type="button"
                                onClick={onClose}
                                className="
                                    rounded-md
                                    p-1
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
                            className="
                                max-h-[70vh]
                                overflow-y-auto
                                p-6
                            "
                        >
                            {children}
                        </div>

                        {footer && (
                            <div
                                className="
                                    flex
                                    justify-end
                                    gap-3
                                    border-t
                                    border-gray-200
                                    px-6
                                    py-4
                                    dark:border-gray-800
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