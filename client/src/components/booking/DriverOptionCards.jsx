import { AnimatePresence, motion } from "framer-motion";
import { Check, KeyRound, Lock, UserCheck } from "lucide-react";

/*
 * Two side-by-side choice cards for the booking's driver option, each with
 * its own accent (sky for Self Drive, amber for With Driver). Values match
 * the server's driverOption enum: "Without Driver" | "With Driver".
 */
const OPTIONS = [
    {
        value: "Without Driver",
        title: "Self Drive",
        tagline: "You take the wheel.",
        icon: KeyRound,
        accent: {
            tile: "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30",
            selected:
                "border-sky-500 bg-gradient-to-br from-sky-50 via-white to-white ring-4 ring-sky-500/15 dark:border-sky-400 dark:from-sky-500/15 dark:via-gray-900 dark:to-gray-900",
            hover: "hover:border-sky-300 dark:hover:border-sky-600",
            badge: "bg-sky-500",
            pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
            bullet: "text-sky-500 dark:text-sky-400",
            watermark: "text-sky-500/10 dark:text-sky-400/10",
        },
    },
    {
        value: "With Driver",
        title: "With Driver",
        tagline: "Sit back and enjoy the ride.",
        icon: UserCheck,
        accent: {
            tile: "bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg shadow-amber-500/30",
            selected:
                "border-amber-500 bg-gradient-to-br from-amber-50 via-white to-white ring-4 ring-amber-500/15 dark:border-amber-400 dark:from-amber-500/15 dark:via-gray-900 dark:to-gray-900",
            hover: "hover:border-amber-300 dark:hover:border-amber-600",
            badge: "bg-amber-500",
            pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
            bullet: "text-amber-500 dark:text-amber-400",
            watermark: "text-amber-500/10 dark:text-amber-400/10",
        },
    },
];

const DriverOptionCards = ({
    value,
    onChange,
    disabled = false,
    error,
    // "₱1,500/day", "From ₱1,200/day", ...
    withDriverRateText = "",
    // The admin picks the driver, so the customer doesn't.
    adminAssignsDriver = false,
    // Reason text when an option can't be chosen; null when it can.
    selfDriveLockedReason = null,
    withDriverLockedReason = null,
}) => {
    const details = {
        "Without Driver": {
            price: "No driver fee",
            features: [
                "Drive on your own schedule",
                "Valid driver's license required",
                "Pickup and return location fees may apply",
            ],
            lockedReason: selfDriveLockedReason,
        },
        "With Driver": {
            price: withDriverRateText,
            features: [
                adminAssignsDriver
                    ? "A driver is assigned by our team"
                    : "Choose your own driver",
                "No license needed",
                "Pickup and return fees waived",
            ],
            lockedReason: withDriverLockedReason,
        },
    };

    return (
        <div>
            <div
                role="radiogroup"
                aria-label="Driver option"
                className="grid gap-4 sm:grid-cols-2"
            >
                {OPTIONS.map((option) => {
                    const { price, features, lockedReason } =
                        details[option.value];
                    const isSelected = value === option.value;
                    const isLocked = Boolean(lockedReason);
                    const isDisabled = disabled || isLocked;
                    const Icon = option.icon;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={isDisabled}
                            onClick={() =>
                                !isSelected && onChange?.(option.value)
                            }
                            className={`
                                group relative flex flex-col overflow-hidden rounded-2xl border-2 p-5 text-left
                                transition-all duration-200
                                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-400/30
                                ${
                                    isSelected
                                        ? `${option.accent.selected} shadow-md`
                                        : `border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 ${
                                              isDisabled
                                                  ? ""
                                                  : `${option.accent.hover} hover:-translate-y-0.5 hover:shadow-md`
                                          }`
                                }
                                ${isLocked ? "cursor-not-allowed opacity-60" : ""}
                                ${disabled && !isLocked ? "cursor-not-allowed" : ""}
                            `}
                        >
                            {/* Oversized faded icon as a corner watermark. */}
                            <Icon
                                aria-hidden="true"
                                size={120}
                                strokeWidth={1.25}
                                className={`pointer-events-none absolute -bottom-6 -right-6 transition-transform duration-300 ${
                                    option.accent.watermark
                                } ${isSelected ? "scale-110 -rotate-6" : ""}`}
                            />

                            <AnimatePresence>
                                {isSelected && (
                                    <motion.span
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 20,
                                        }}
                                        className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full text-white shadow ${option.accent.badge}`}
                                    >
                                        <Check size={14} strokeWidth={3} />
                                    </motion.span>
                                )}
                            </AnimatePresence>

                            {isLocked && (
                                <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                                    <Lock size={12} />
                                </span>
                            )}

                            <div className="relative flex items-center gap-3">
                                <span
                                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 ${
                                        option.accent.tile
                                    } ${isSelected ? "scale-105" : "group-hover:scale-105"}`}
                                >
                                    <Icon size={22} />
                                </span>

                                <div className="min-w-0 pr-7">
                                    <p className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
                                        {option.title}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {option.tagline}
                                    </p>
                                </div>
                            </div>

                            {price && (
                                <span
                                    className={`relative mt-4 inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${option.accent.pill}`}
                                >
                                    {price}
                                </span>
                            )}

                            <ul className="relative mt-4 space-y-1.5">
                                {features.map((feature) => (
                                    <li
                                        key={feature}
                                        className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300"
                                    >
                                        <Check
                                            size={13}
                                            strokeWidth={3}
                                            className={`mt-0.5 shrink-0 ${option.accent.bullet}`}
                                        />
                                        {feature}
                                    </li>
                                ))}
                            </ul>

                            {lockedReason && (
                                <p className="relative mt-4 border-t border-gray-200 pt-3 text-xs font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                    {lockedReason}
                                </p>
                            )}
                        </button>
                    );
                })}
            </div>

            {error && (
                <p
                    role="alert"
                    className="mt-2 text-sm font-medium text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            )}
        </div>
    );
};

export default DriverOptionCards;
