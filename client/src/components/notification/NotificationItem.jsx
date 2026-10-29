import {
    AlertCircle,
    Check,
    CheckCircle2,
    ChevronRight,
    TriangleAlert,
    X,
    XCircle,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { motion } from "framer-motion";

import {
    getCategoryMeta,
    resolveNotificationPath,
} from "./notificationMeta";

/*
 * The card's icon comes from its category; the server's `variant` only adds
 * a severity cue — the unread accent bar/dot colour, plus a small status
 * badge on the icon for outcomes worth noticing at a glance.
 */
const SEVERITY = {
    success: {
        accent: "bg-emerald-500",
        badge: CheckCircle2,
        badgeColor: "text-emerald-500",
    },
    warning: {
        accent: "bg-amber-500",
        badge: TriangleAlert,
        badgeColor: "text-amber-500",
    },
    error: {
        accent: "bg-red-500",
        badge: AlertCircle,
        badgeColor: "text-red-500",
    },
    rejected: {
        accent: "bg-rose-500",
        badge: XCircle,
        badgeColor: "text-rose-500",
    },
};

const DEFAULT_SEVERITY = { accent: "bg-blue-500" };

const SPRING = {
    type: "spring",
    stiffness: 320,
    damping: 28,
};

const timeAgo = (timestamp) => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
};

const fullTimestamp = (timestamp) =>
    timestamp
        ? new Date(timestamp).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
          })
        : "";

const NotificationItem = ({
    notification,
    onClick,
    onMarkAsRead,
    onDismiss,
    index = 0,
    role,
}) => {
    const navigate = useNavigate();

    const category = getCategoryMeta(notification?.category);
    const CategoryIcon = category.icon;

    const severity =
        SEVERITY[notification?.variant] || DEFAULT_SEVERITY;
    const SeverityBadge = severity.badge;

    const isRead = Boolean(notification?.read);
    const target = resolveNotificationPath(notification, role);
    const timestamp =
        notification?.timestamp || notification?.createdAt;

    const handleClick = () => {
        onClick?.(notification);

        if (target) {
            navigate(target);
        }
    };

    const handleKeyDown = (event) => {
        if (event.target !== event.currentTarget) return;

        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleClick();
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
                opacity: 0,
                x: 24,
                transition: { duration: 0.18 },
            }}
            transition={{
                ...SPRING,
                delay: Math.min(index * 0.03, 0.2),
            }}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={`group relative flex cursor-pointer gap-3.5 overflow-hidden rounded-2xl border p-4 transition-[border-color,box-shadow,background-color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-4 sm:p-5 ${
                isRead
                    ? "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700"
                    : "border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md dark:border-gray-700/80 dark:bg-gray-900 dark:hover:border-gray-600"
            }`}
        >
            {!isRead && (
                <span
                    aria-hidden
                    className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${severity.accent}`}
                />
            )}

            {/* Category icon */}
            <div className="relative shrink-0">
                <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${
                        category.tile
                    } ${isRead ? "opacity-60" : ""}`}
                >
                    <CategoryIcon
                        size={20}
                        className={category.text}
                    />
                </div>

                {SeverityBadge && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-gray-900">
                        <SeverityBadge
                            size={16}
                            className={severity.badgeColor}
                        />
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2 pr-20">
                    <h4
                        className={`text-[15px] leading-snug ${
                            isRead
                                ? "font-medium text-gray-600 dark:text-gray-400"
                                : "font-semibold text-gray-900 dark:text-white"
                        }`}
                    >
                        {notification?.title || "Notification"}
                    </h4>

                    {!isRead && (
                        <span
                            aria-label="Unread"
                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severity.accent}`}
                        />
                    )}
                </div>

                {notification?.message && (
                    <p
                        className={`mt-1 text-sm leading-relaxed ${
                            isRead
                                ? "text-gray-500 dark:text-gray-500"
                                : "text-gray-600 dark:text-gray-300"
                        }`}
                    >
                        {notification.message}
                    </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span
                        title={fullTimestamp(timestamp)}
                        className="font-medium text-gray-400 dark:text-gray-500"
                    >
                        {timeAgo(timestamp)}
                    </span>

                    <span
                        aria-hidden
                        className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700"
                    />

                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        <CategoryIcon
                            size={12}
                            className={category.text}
                        />
                        {notification?.category || "General"}
                    </span>

                    {notification?.metadata?.reference && (
                        <span className="rounded-md border border-gray-200 px-1.5 py-0.5 font-mono text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            {notification.metadata.reference}
                        </span>
                    )}

                    {target && (
                        <span className="ml-auto inline-flex items-center gap-0.5 font-semibold text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 dark:text-blue-400">
                            View
                            <ChevronRight size={14} />
                        </span>
                    )}
                </div>
            </div>

            {/* Actions — always shown on touch, on hover/focus elsewhere */}
            <div className="absolute right-3 top-3 flex items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {!isRead && onMarkAsRead && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onMarkAsRead(notification._id);
                        }}
                        title="Mark as read"
                        aria-label="Mark as read"
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-500/10 dark:hover:text-blue-400"
                    >
                        <Check size={16} />
                    </button>
                )}

                {onDismiss && (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDismiss(notification._id);
                        }}
                        title="Dismiss"
                        aria-label="Dismiss notification"
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>
        </motion.div>
    );
};

export default NotificationItem;
