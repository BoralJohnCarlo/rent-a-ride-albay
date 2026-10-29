import {
    AlertCircle,
    Bell,
    CheckCircle2,
    FileText,
    Info,
    Package,
    TriangleAlert,
    UserPlus,
    Wallet,
    XCircle,
} from "lucide-react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

const STATUS_VARIANTS = {
    info: {
        icon: Info,
        bg: "bg-blue-50 dark:bg-blue-950/40",
        border: "border-blue-200 dark:border-blue-800",
        iconColor: "text-blue-600 dark:text-blue-400",
        text: "text-blue-900 dark:text-blue-100",
        subtext: "text-blue-700 dark:text-blue-300",
    },
    success: {
        icon: CheckCircle2,
        bg: "bg-green-50 dark:bg-green-950/40",
        border: "border-green-200 dark:border-green-800",
        iconColor: "text-green-600 dark:text-green-400",
        text: "text-green-900 dark:text-green-100",
        subtext: "text-green-700 dark:text-green-300",
    },
    warning: {
        icon: TriangleAlert,
        bg: "bg-yellow-50 dark:bg-yellow-950/40",
        border: "border-yellow-200 dark:border-yellow-800",
        iconColor: "text-yellow-600 dark:text-yellow-400",
        text: "text-yellow-900 dark:text-yellow-100",
        subtext: "text-yellow-700 dark:text-yellow-300",
    },
    error: {
        icon: AlertCircle,
        bg: "bg-red-50 dark:bg-red-950/40",
        border: "border-red-200 dark:border-red-800",
        iconColor: "text-red-600 dark:text-red-400",
        text: "text-red-900 dark:text-red-100",
        subtext: "text-red-700 dark:text-red-300",
    },
    system: {
        icon: Bell,
        bg: "bg-purple-50 dark:bg-purple-950/40",
        border: "border-purple-200 dark:border-purple-800",
        iconColor: "text-purple-600 dark:text-purple-400",
        text: "text-purple-900 dark:text-purple-100",
        subtext: "text-purple-700 dark:text-purple-300",
    },
    payment: {
        icon: Wallet,
        bg: "bg-emerald-50 dark:bg-emerald-950/40",
        border: "border-emerald-200 dark:border-emerald-800",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        text: "text-emerald-900 dark:text-emerald-100",
        subtext: "text-emerald-700 dark:text-emerald-300",
    },
    document: {
        icon: FileText,
        bg: "bg-orange-50 dark:bg-orange-950/40",
        border: "border-orange-200 dark:border-orange-800",
        iconColor: "text-orange-600 dark:text-orange-400",
        text: "text-orange-900 dark:text-orange-100",
        subtext: "text-orange-700 dark:text-orange-300",
    },
    user: {
        icon: UserPlus,
        bg: "bg-indigo-50 dark:bg-indigo-950/40",
        border: "border-indigo-200 dark:border-indigo-800",
        iconColor: "text-indigo-600 dark:text-indigo-400",
        text: "text-indigo-900 dark:text-indigo-100",
        subtext: "text-indigo-700 dark:text-indigo-300",
    },
    consignment: {
        icon: Package,
        bg: "bg-teal-50 dark:bg-teal-950/40",
        border: "border-teal-200 dark:border-teal-800",
        iconColor: "text-teal-600 dark:text-teal-400",
        text: "text-teal-900 dark:text-teal-100",
        subtext: "text-teal-700 dark:text-teal-300",
    },
    rejected: {
        icon: XCircle,
        bg: "bg-rose-50 dark:bg-rose-950/40",
        border: "border-rose-200 dark:border-rose-800",
        iconColor: "text-rose-600 dark:text-rose-400",
        text: "text-rose-900 dark:text-rose-100",
        subtext: "text-rose-700 dark:text-rose-300",
    },
};

const SPRING = {
    type: "spring",
    stiffness: 300,
    damping: 24,
};

const NotificationItem = ({
    notification,
    onClick,
    onDismiss,
    index = 0,
}) => {
    const variant =
        STATUS_VARIANTS[
            notification?.variant || "info"
        ] || STATUS_VARIANTS.info;

    const Icon = variant.icon;

    const timeAgo = (timestamp) => {
        if (!timestamp) return "";

        const date = new Date(
            timestamp
        );
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(
            diffMs / 60000
        );
        const diffHours = Math.floor(
            diffMs / 3600000
        );
        const diffDays = Math.floor(
            diffMs / 86400000
        );

        if (diffMins < 1)
            return "Just now";
        if (diffMins < 60)
            return `${diffMins}m ago`;
        if (diffHours < 24)
            return `${diffHours}h ago`;
        if (diffDays < 7)
            return `${diffDays}d ago`;

        return date.toLocaleDateString(
            undefined,
            {
                month: "short",
                day: "numeric",
            }
        );
    };

    return (
        <motion.div
            layout
            initial={{
                opacity: 0,
                y: 12,
                scale: 0.97,
            }}
            animate={{
                opacity: 1,
                y: 0,
                scale: 1,
            }}
            exit={{
                opacity: 0,
                y: -8,
                scale: 0.97,
            }}
            transition={{
                ...SPRING,
                delay: index * 0.04,
            }}
            onClick={() =>
                onClick?.(
                    notification
                )
            }
            className={`
                group
                relative
                flex
                cursor-pointer
                gap-3.5
                rounded-xl
                border
                p-4
                transition-all
                duration-200
                hover:shadow-md
                ${
                    !notification?.read
                        ? variant.bg
                        : "bg-white dark:bg-gray-900"
                }
                ${
                    notification?.read
                        ? "border-gray-200 dark:border-gray-800"
                        : variant.border
                }
                ${
                    notification?.read
                        ? "opacity-75"
                        : "opacity-100"
                }
            `}
        >
            {!notification?.read && (
                <div
                    className="
                        absolute
                        left-2
                        top-1/2
                        h-2
                        w-2
                        -translate-y-1/2
                        rounded-full
                        bg-blue-500
                        dark:bg-blue-400
                    "
                />
            )}

            <div
                className={`
                    mt-0.5
                    shrink-0
                    rounded-lg
                    border
                    p-2
                    ${
                        notification?.read
                            ? "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                            : `${variant.border} ${variant.bg}`
                    }
                `}
            >
                <Icon
                    size={20}
                    className={
                        notification?.read
                            ? "text-gray-400 dark:text-gray-500"
                            : variant.iconColor
                    }
                />
            </div>

            <div className="flex-1 min-w-0">
                <div
                    className={`
                        flex
                        items-start
                        justify-between
                        gap-2
                    `}
                >
                    <h4
                        className={`
                            text-sm
                            font-semibold
                            leading-tight
                            ${
                                notification?.read
                                    ? "text-gray-700 dark:text-gray-300"
                                    : variant.text
                            }
                        `}
                    >
                        {notification?.title ||
                            "Notification"}
                    </h4>

                    {onDismiss && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismiss?.(
                                    notification?._id
                                );
                            }}
                            className="
                                shrink-0
                                rounded-md
                                p-1
                                opacity-0
                                transition-all
                                duration-200
                                hover:bg-gray-200
                                dark:hover:bg-gray-700
                                group-hover:opacity-100
                            "
                            aria-label="Dismiss notification"
                        >
                            <XCircle
                                size={14}
                                className="text-gray-400 dark:text-gray-500"
                            />
                        </button>
                    )}
                </div>

                {notification?.message && (
                    <p
                        className={`
                            mt-1
                            text-sm
                            leading-relaxed
                            ${
                                notification?.read
                                    ? "text-gray-500 dark:text-gray-400"
                                    : variant.subtext
                            }
                        `}
                    >
                        {notification.message}
                    </p>
                )}

                {notification?.metadata
                    ?.reference && (
                    <p
                        className="
                            mt-1.5
                            text-xs
                            font-medium
                            text-gray-400
                            dark:text-gray-500
                        "
                    >
                        {notification.metadata.reference}
                    </p>
                )}

                <div
                    className="
                        mt-2.5
                        flex
                        items-center
                        gap-2
                        text-xs
                        text-gray-400
                        dark:text-gray-500
                    "
                >
                    <span>
                        {timeAgo(
                            notification?.timestamp ||
                                notification?.createdAt
                        )}
                    </span>

                    {notification?.category && (
                        <>
                            <span>•</span>
                            <span
                                className="
                                    capitalize
                                "
                            >
                                {notification.category}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default NotificationItem;
