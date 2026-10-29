import {
    useEffect,
    useCallback,
    useRef,
    useState,
} from "react";

import {
    AlertCircle,
    CheckCircle2,
    Info,
    TriangleAlert,
    X,
} from "lucide-react";

const variants = {
    success: {
        icon: CheckCircle2,
        iconColor:
            "text-emerald-600 dark:text-emerald-400",
        iconBackground:
            "bg-emerald-50 dark:bg-emerald-950/40",
        progress: "bg-emerald-500",
    },

    error: {
        icon: AlertCircle,
        iconColor:
            "text-red-600 dark:text-red-400",
        iconBackground:
            "bg-red-50 dark:bg-red-950/40",
        progress: "bg-red-500",
    },

    warning: {
        icon: TriangleAlert,
        iconColor:
            "text-amber-600 dark:text-amber-400",
        iconBackground:
            "bg-amber-50 dark:bg-amber-950/40",
        progress: "bg-amber-500",
    },

    info: {
        icon: Info,
        iconColor:
            "text-blue-600 dark:text-blue-400",
        iconBackground:
            "bg-blue-50 dark:bg-blue-950/40",
        progress: "bg-blue-500",
    },

    welcome: {
        icon: CheckCircle2,
        iconColor:
            "text-emerald-600 dark:text-emerald-400",
        iconBackground:
            "bg-emerald-100 dark:bg-emerald-900/50",
        progress: "bg-emerald-600",
    },
};

const Toast = ({
    variant = "info",
    title,
    message,
    duration = 3000,
    onClose,
}) => {
    const [isPaused, setIsPaused] = useState(false);

    const startTimeRef = useRef(null);
    const remainingRef = useRef(duration);
    const timerRef = useRef(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        remainingRef.current = duration;
    }, [duration]);

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const startTimer = useCallback(() => {
        clearTimer();

        startTimeRef.current = Date.now();

        timerRef.current = setTimeout(() => {
            onCloseRef.current?.();
        }, remainingRef.current);
    }, [clearTimer]);

    useEffect(() => {
        startTimer();

        return clearTimer;
    }, [startTimer, clearTimer]);

    const handleMouseEnter = useCallback(() => {
        clearTimer();

        if (startTimeRef.current !== null) {
            const elapsed =
                Date.now() - startTimeRef.current;

            remainingRef.current = Math.max(
                0,
                remainingRef.current - elapsed
            );
        }

        setIsPaused(true);
    }, [clearTimer]);

    const handleMouseLeave = useCallback(() => {
        if (remainingRef.current <= 0) {
            onCloseRef.current?.();
            return;
        }

        startTimer();
        setIsPaused(false);
    }, [startTimer]);

    const selected =
        variants[variant] || variants.info;

    const Icon = selected.icon;

    const containerClassName = `
        relative
        w-full
        overflow-hidden
        rounded-xl
        border
        border-gray-200
        bg-white
        shadow-[0_8px_30px_rgba(0,0,0,0.08)]
        dark:border-gray-800
        dark:bg-gray-900
        dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)]
        ${
            variant === "welcome"
                ? "ring-2 ring-emerald-400/30 dark:ring-emerald-500/30"
                : ""
        }
    `;

    return (
        <div
            role="alert"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={containerClassName}
        >
            <div className="flex items-start gap-3 px-4 py-3.5">
                <div
                    className={`
                        flex
                        h-9
                        w-9
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        ${selected.iconBackground}
                        ${selected.iconColor}
                    `}
                >
                    <Icon
                        size={19}
                        strokeWidth={2.25}
                    />
                </div>

                <div className="min-w-0 flex-1 py-0.5">
                    {title && (
                        <h4
                            className="
                                text-sm
                                font-semibold
                                leading-5
                                text-gray-900
                                dark:text-gray-100
                            "
                        >
                            {title}
                        </h4>
                    )}

                    {message && (
                        <p
                            className={`
                                text-[13px]
                                leading-5
                                text-gray-500
                                dark:text-gray-400
                                ${title ? "mt-0.5" : ""}
                            `}
                        >
                            {message}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    className="
                        flex
                        h-7
                        w-7
                        shrink-0
                        items-center
                        justify-center
                        rounded-md
                        text-gray-400
                        transition-all
                        duration-150
                        hover:bg-gray-100
                        hover:text-gray-600
                        active:scale-95
                        focus:outline-none
                        focus:ring-2
                        focus:ring-gray-200
                        dark:text-gray-500
                        dark:hover:bg-gray-800
                        dark:hover:text-gray-300
                        dark:focus:ring-gray-700
                    "
                    aria-label="Close notification"
                >
                    <X size={16} />
                </button>
            </div>

            <div
                className="
                    h-px
                    w-full
                    bg-gray-100
                    dark:bg-gray-800
                "
            >
                <div
                    className={`
                        h-full
                        origin-left
                        ${selected.progress}
                    `}
                    style={{
                        animation: `toast-progress ${duration}ms linear forwards`,
                        animationPlayState: isPaused
                            ? "paused"
                            : "running",
                    }}
                />
            </div>
        </div>
    );
};

export default Toast;