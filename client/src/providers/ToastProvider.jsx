import {
    useCallback,
    useMemo,
    useRef,
    useEffect,
    useState,
} from "react";

import toastSound from "../assets/sound/Toast.mp3";
import { playSound } from "../utils/notificationSound";

import Toast from "../components/common/Toast";
import ToastContext from "../context/ToastContext";

const DEFAULT_DURATION = 3000;
const EXIT_DURATION = 300;
const MAX_TOASTS = 5;

const generateId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timeoutsRef = useRef(new Set());

    useEffect(() => {
        return () => {
            timeoutsRef.current.forEach((id) => clearTimeout(id));
            timeoutsRef.current.clear();
        };
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) =>
            prev.map((toast) =>
                toast.id === id
                    ? {
                          ...toast,
                          exiting: true,
                      }
                    : toast
            )
        );

        const timeoutId = setTimeout(() => {
            setToasts((prev) =>
                prev.filter(
                    (toast) =>
                        toast.id !== id
                )
            );
            timeoutsRef.current.delete(timeoutId);
        }, EXIT_DURATION);

        timeoutsRef.current.add(timeoutId);
    }, []);

    const showToast = useCallback(
        ({
            variant = "info",
            title = "",
            message,
            duration = DEFAULT_DURATION,
            silent = false,
        }) => {
            if (!message) {
                return;
            }

            /*
             * A plain local object, not a ref — set inside the setToasts
             * updater and read right after the call returns, so the sound
             * only plays when a toast was actually added. Previously it
             * played unconditionally after setToasts, including on the
             * duplicate-suppression branch below (same message/title/
             * variant as the last toast), which drops the toast silently
             * but still made noise for it.
             */
            const outcome = { added: false };

            setToasts((prev) => {
                const last = prev[prev.length - 1];

                if (
                    last &&
                    last.message === message &&
                    last.title === title &&
                    last.variant === variant
                ) {
                    return prev;
                }

                outcome.added = true;

                const id = generateId();

                const next = [
                    ...prev,
                    {
                        id,
                        variant,
                        title,
                        message,
                        duration,
                        exiting: false,
                    },
                ];

                return next.slice(-MAX_TOASTS);
            });

            if (!outcome.added || silent) {
                return;
            }

            playSound(toastSound);
        },
        []
    );

    const value = useMemo(
        () => ({
            success: (
                message,
                title = "Success",
                duration
            ) =>
                showToast({
                    variant: "success",
                    title,
                    message,
                    duration,
                }),

            error: (
                message,
                title = "Error",
                duration
            ) =>
                showToast({
                    variant: "error",
                    title,
                    message,
                    duration,
                }),

            warning: (
                message,
                title = "Warning",
                duration
            ) =>
                showToast({
                    variant: "warning",
                    title,
                    message,
                    duration,
                }),

            info: (
                message,
                title = "Information",
                duration
            ) =>
                showToast({
                    variant: "info",
                    title,
                    message,
                    duration,
                }),

            showToast,
        }),
        [showToast]
    );

    const toastHandlers = useMemo(() => {
        const handlers = {};

        toasts.forEach((toast) => {
            handlers[toast.id] = () =>
                removeToast(toast.id);
        });

        return handlers;
    }, [toasts, removeToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}

            <div
                role="region"
                aria-live="polite"
                aria-atomic="false"
                className="
                    pointer-events-none
                    fixed
                    left-1/2
                    top-4
                    z-[9999]
                    flex
                    w-full
                    max-w-md
                    -translate-x-1/2
                    flex-col
                    gap-3
                    px-4
                "
            >
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto
                            w-full
                            transform
                            transition-all
                            duration-300
                            ease-out
                            ${
                                toast.exiting
                                    ? "translate-y-[-8px] scale-95 opacity-0"
                                    : "translate-y-0 scale-100 opacity-100"
                            }
                        `}
                    >
                        <Toast
                            variant={toast.variant}
                            title={toast.title}
                            message={toast.message}
                            duration={toast.duration}
                            onClose={
                                toastHandlers[toast.id]
                            }
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export default ToastProvider;