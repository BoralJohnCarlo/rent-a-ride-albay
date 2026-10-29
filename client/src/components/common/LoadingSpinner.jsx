import {
    motion,
    useReducedMotion,
} from "framer-motion";

const SIZE_MAP = {
    sm: 24,
    md: 40,
    lg: 56,
    xl: 72,
};

const LoadingSpinner = ({
    message = "Loading...",
    fullScreen = true,
    size = "md",
}) => {
    const reduceMotion = useReducedMotion();

    const px =
        typeof size === "number"
            ? size
            : SIZE_MAP[size] ?? SIZE_MAP.md;

    const ring = Math.max(2, Math.round(px * 0.1));

    const containerClass = fullScreen
        ? "flex min-h-screen items-center justify-center bg-white/70 backdrop-blur-sm dark:bg-gray-950/70"
        : "flex items-center justify-center py-8";

    return (
        <div
            className={containerClass}
            role="status"
            aria-live="polite"
            aria-label={message || "Loading"}
        >
            <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                    duration: 0.25,
                    ease: "easeOut",
                }}
            >
                <span
                    className="relative inline-flex"
                    style={{ width: px, height: px }}
                >
                    {/* Static track */}
                    <span
                        className="absolute inset-0 rounded-full border-solid border-gray-200 dark:border-gray-800"
                        style={{ borderWidth: ring }}
                    />

                    {/* Spinning arc */}
                    <motion.span
                        className="absolute inset-0 rounded-full border-solid border-transparent border-t-blue-600 drop-shadow-[0_0_6px_rgba(37,99,235,0.35)] dark:border-t-blue-400"
                        style={{ borderWidth: ring }}
                        animate={
                            reduceMotion
                                ? {}
                                : { rotate: 360 }
                        }
                        transition={{
                            duration: 0.8,
                            ease: "linear",
                            repeat: Infinity,
                        }}
                    />

                    {/* Breathing core */}
                    <motion.span
                        className="absolute rounded-full bg-blue-600/15 dark:bg-blue-400/20"
                        style={{ inset: Math.round(px * 0.3) }}
                        animate={
                            reduceMotion
                                ? {}
                                : {
                                      scale: [1, 0.65, 1],
                                      opacity: [0.7, 0.2, 0.7],
                                  }
                        }
                        transition={{
                            duration: 1.4,
                            ease: "easeInOut",
                            repeat: Infinity,
                        }}
                    />
                </span>

                {message && (
                    <motion.p
                        className="text-sm font-medium text-gray-600 dark:text-gray-300"
                        animate={
                            reduceMotion
                                ? {}
                                : {
                                      opacity: [0.55, 1, 0.55],
                                  }
                        }
                        transition={{
                            duration: 1.6,
                            ease: "easeInOut",
                            repeat: Infinity,
                        }}
                    >
                        {message}
                    </motion.p>
                )}
            </motion.div>
        </div>
    );
};

export default LoadingSpinner;
