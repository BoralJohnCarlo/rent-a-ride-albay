import {
    BellRing,
    CheckCheck,
    Search,
    Trash2,
} from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";

import { useEffect, useState } from "react";

import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import PageHeader from "../../../components/common/PageHeader";

import NotificationItem from "../../../components/notification/NotificationItem";

import {
    fetchNotifications,
    markAllNotificationsAsRead,
    removeAllNotifications,
    removeNotification,
    markNotificationAsRead,
} from "../../../services/notificationService.js";

const FILTER_TABS = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "consignment", label: "Consignments" },
    { key: "vehicle", label: "Vehicles" },
    { key: "agreement", label: "Agreements" },
    { key: "document", label: "Documents" },
    { key: "payment", label: "Payments" },
    { key: "booking", label: "Bookings" },
];

const OperatorNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [activeFilter, setActiveFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    const unreadCount = notifications.filter((n) => !n.read).length;

    const loadNotifications = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetchNotifications({
                read: activeFilter === "unread" ? false : undefined,
                category: activeFilter !== "all" && activeFilter !== "unread" ? activeFilter : undefined,
                search: searchQuery || undefined,
            });

            setNotifications(response.data || []);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load notifications.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [activeFilter, searchQuery]);

    const handleMarkAsRead = async (id) => {
        setNotifications((prev) =>
            prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );

        try {
            await markNotificationAsRead(id);
        } catch {
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: false } : n))
            );
        }
    };

    const handleMarkAllAsRead = async () => {
        setActionLoading(true);

        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch {
            loadNotifications();
        } finally {
            setActionLoading(false);
        }
    };

    const handleDismiss = async (id) => {
        setNotifications((prev) => prev.filter((n) => n._id !== id));

        try {
            await removeNotification(id);
        } catch {
            loadNotifications();
        }
    };

    const handleDismissAll = async () => {
        setActionLoading(true);

        try {
            await removeAllNotifications();
            setNotifications([]);
        } catch {
            loadNotifications();
        } finally {
            setActionLoading(false);
        }
    };

    const handleNotificationClick = (notification) => {
        if (!notification.read) {
            handleMarkAsRead(notification._id);
        }
    };

    return (
        <main
            className="
                min-h-full
                bg-gray-50
                px-4
                py-6
                dark:bg-gray-950
                sm:px-6
                lg:px-8
            "
        >
            <div className="mx-auto w-full max-w-[1200px]">
                <PageHeader
                    title="Notifications"
                    subtitle={`You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}.`}
                    actions={
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllAsRead}
                                    disabled={actionLoading}
                                    className="
                                        inline-flex
                                        items-center
                                        gap-2
                                        rounded-full
                                        border
                                        border-gray-200
                                        bg-white
                                        px-4
                                        py-2
                                        text-sm
                                        font-medium
                                        text-gray-700
                                        transition-colors
                                        hover:border-blue-300
                                        hover:bg-blue-50
                                        hover:text-blue-700
                                        dark:border-gray-700
                                        dark:bg-gray-900
                                        dark:text-gray-300
                                        dark:hover:border-blue-700
                                        dark:hover:bg-blue-950
                                        dark:hover:text-blue-400
                                        disabled:cursor-not-allowed
                                        disabled:opacity-60
                                    "
                                >
                                    <CheckCheck size={16} />
                                    Mark all read
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleDismissAll}
                                disabled={actionLoading || notifications.length === 0}
                                className="
                                    inline-flex
                                    items-center
                                    gap-2
                                    rounded-full
                                    border
                                    border-gray-200
                                    bg-white
                                    px-4
                                    py-2
                                    text-sm
                                    font-medium
                                    text-gray-700
                                    transition-colors
                                    hover:border-red-300
                                    hover:bg-red-50
                                    hover:text-red-700
                                    disabled:cursor-not-allowed
                                    disabled:opacity-40
                                    dark:border-gray-700
                                    dark:bg-gray-900
                                    dark:text-gray-300
                                    dark:hover:border-red-700
                                    dark:hover:bg-red-950
                                    dark:hover:text-red-400
                                "
                            >
                                <Trash2 size={16} />
                                Clear all
                            </button>
                        </div>
                    }
                />

                <div
                    className="
                        mt-6
                        flex
                        flex-col
                        gap-4
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                    "
                >
                    <div className="flex flex-wrap gap-2">
                        {FILTER_TABS.map((tab) => {
                            const isActive = activeFilter === tab.key;

                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setActiveFilter(tab.key)}
                                    className={`
                                        rounded-full
                                        border
                                        px-4
                                        py-1.5
                                        text-sm
                                        font-medium
                                        transition-all
                                        duration-200
                                        ${
                                            isActive
                                                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                                                : "border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-blue-800 dark:hover:bg-gray-800 dark:hover:text-blue-400"
                                        }
                                    `}
                                >
                                    {tab.label}
                                    {tab.key === "unread" && unreadCount > 0 && (
                                        <span
                                            className={`
                                                ml-1.5
                                                rounded-full
                                                px-1.5
                                                py-0.5
                                                text-xs
                                                ${
                                                    isActive
                                                        ? "bg-blue-500 text-white"
                                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                                }
                                            `}
                                        >
                                            {unreadCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative sm:w-72">
                        <Search
                            size={18}
                            className="
                                absolute
                                left-3
                                top-1/2
                                -translate-y-1/2
                                text-gray-400
                                dark:text-gray-500
                            "
                        />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notifications..."
                            className="
                                w-full
                                rounded-xl
                                border
                                border-gray-200
                                bg-white
                                py-2
                                pl-10
                                pr-4
                                text-sm
                                text-gray-900
                                placeholder-gray-400
                                transition-colors
                                focus:border-blue-400
                                focus:outline-none
                                focus:ring-2
                                focus:ring-blue-400/20
                                dark:border-gray-700
                                dark:bg-gray-900
                                dark:text-gray-100
                                dark:placeholder-gray-500
                                dark:focus:border-blue-600
                                dark:focus:ring-blue-600/20
                            "
                        />
                    </div>
                </div>

                <div className="mt-6 space-y-3">
                    {loading ? (
                        <LoadingSpinner fullScreen={false} />
                    ) : error ? (
                        <div
                            className="
                                rounded-xl
                                border
                                border-red-200
                                bg-red-50
                                px-4
                                py-3
                                text-sm
                                font-medium
                                text-red-700
                                dark:border-red-900/50
                                dark:bg-red-950/30
                                dark:text-red-400
                            "
                        >
                            {error}
                        </div>
                    ) : notifications.length === 0 ? (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key="empty"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                            >
                                <EmptyState
                                    icon={
                                        <BellRing
                                            size={48}
                                            className="text-gray-300 dark:text-gray-600"
                                        />
                                    }
                                    title="No notifications found"
                                    description={
                                        searchQuery
                                            ? "Try adjusting your search or filters."
                                            : "You are all caught up. New notifications will appear here."
                                    }
                                />
                            </motion.div>
                        </AnimatePresence>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${activeFilter}-${searchQuery}`}
                                layout
                                className="space-y-3"
                            >
                                {notifications.map((notification, index) => (
                                    <NotificationItem
                                        key={notification._id}
                                        notification={notification}
                                        index={index}
                                        onClick={handleNotificationClick}
                                        onDismiss={handleDismiss}
                                    />
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </main>
    );
};

export default OperatorNotifications;
