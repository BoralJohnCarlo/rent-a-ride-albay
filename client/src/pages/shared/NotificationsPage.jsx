import {
    Bell,
    BellOff,
    CheckCheck,
    Inbox,
    Mail,
    RefreshCw,
    Search,
    SearchX,
    Trash2,
    X,
} from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import ConfirmDialog from "../../components/common/ConfirmDialog";
import Pagination from "../../components/common/Pagination";

import NotificationItem from "../../components/notification/NotificationItem";
import {
    CATEGORY_META,
    ROLE_CATEGORIES,
} from "../../components/notification/notificationMeta";

import {
    fetchUnreadCount,
    fetchNotifications,
    markAllNotificationsAsRead,
    removeAllNotifications,
    removeNotification,
    markNotificationAsRead,
} from "../../services/notificationService.js";

const PAGE_SIZE = 20;
const POLL_INTERVAL = 30_000;

const useNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const [activeFilter, setActiveFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery.trim());
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const refreshUnreadCount = useCallback(async () => {
        try {
            const res = await fetchUnreadCount();
            setUnreadCount(res.data?.count ?? 0);
        } catch {
            // silent — the badge just keeps its last value
        }
    }, []);

    useEffect(() => {
        refreshUnreadCount();
        const id = setInterval(refreshUnreadCount, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [refreshUnreadCount]);

    // `silent` refreshes in place (after a dismiss etc.) without the skeleton.
    const loadNotifications = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError(null);

        try {
            const response = await fetchNotifications({
                read: activeFilter === "unread" ? false : undefined,
                category:
                    activeFilter !== "all" && activeFilter !== "unread"
                        ? activeFilter
                        : undefined,
                search: debouncedSearchQuery || undefined,
                page: currentPage,
                limit: PAGE_SIZE,
            });

            setNotifications(response.data || []);
            setTotalPages(response.pagination?.pages || 1);
            setTotalCount(response.pagination?.total || 0);
        } catch (err) {
            setError(
                err.response?.data?.message ||
                    "Failed to load notifications."
            );
        } finally {
            setLoading(false);
        }
    }, [activeFilter, debouncedSearchQuery, currentPage]);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleFilterChange = (key) => {
        setActiveFilter(key);
        setCurrentPage(1);
    };

    const handleSearchChange = (value) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    const handleMarkAsRead = async (id) => {
        const target = notifications.find((n) => n._id === id);
        if (!target || target.read) return;

        setNotifications((prev) =>
            prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        try {
            await markNotificationAsRead(id);
        } catch {
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, read: false } : n))
            );
            setUnreadCount((prev) => prev + 1);
        }
    };

    const handleMarkAllAsRead = async () => {
        setActionLoading(true);

        try {
            await markAllNotificationsAsRead();
            setNotifications((prev) =>
                prev.map((n) => ({ ...n, read: true }))
            );
            setUnreadCount(0);

            // In the Unread view everything just left the filter.
            if (activeFilter === "unread") {
                loadNotifications({ silent: true });
            }
        } catch {
            loadNotifications();
        } finally {
            setActionLoading(false);
        }
    };

    const handleDismiss = async (id) => {
        const target = notifications.find((n) => n._id === id);
        if (!target) return;

        const remaining = notifications.filter((n) => n._id !== id);

        setNotifications(remaining);
        setTotalCount((prev) => Math.max(0, prev - 1));
        if (!target.read) {
            setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        try {
            await removeNotification(id);

            // Pull the next page's items up (or step back from an emptied last page).
            if (remaining.length === 0 && currentPage > 1) {
                setCurrentPage((page) => page - 1);
            } else if (currentPage < totalPages) {
                loadNotifications({ silent: true });
            }
        } catch {
            loadNotifications();
            refreshUnreadCount();
        }
    };

    const handleDismissAll = async () => {
        setActionLoading(true);

        try {
            await removeAllNotifications();
            setNotifications([]);
            setTotalCount(0);
            setTotalPages(1);
            setCurrentPage(1);
            setUnreadCount(0);
        } catch {
            loadNotifications();
            refreshUnreadCount();
        } finally {
            setActionLoading(false);
        }
    };

    return {
        notifications,
        activeFilter,
        searchQuery,
        loading,
        error,
        actionLoading,
        currentPage,
        totalPages,
        totalCount,
        unreadCount,
        loadNotifications,
        setCurrentPage,
        handleFilterChange,
        handleSearchChange,
        handleMarkAsRead,
        handleMarkAllAsRead,
        handleDismiss,
        handleDismissAll,
    };
};

const DAY_MS = 86_400_000;

const startOfDay = (value) => {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

const dayLabel = (value) => {
    const day = startOfDay(value);
    const today = startOfDay(Date.now());

    if (day === today) return "Today";
    if (day === today - DAY_MS) return "Yesterday";

    const date = new Date(value);

    return date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year:
            date.getFullYear() === new Date().getFullYear()
                ? undefined
                : "numeric",
    });
};

const groupByDay = (items) => {
    const groups = [];

    for (const item of items) {
        const label = dayLabel(
            item.timestamp || item.createdAt || Date.now()
        );
        let group = groups.find((g) => g.label === label);

        if (!group) {
            group = { label, items: [] };
            groups.push(group);
        }

        group.items.push(item);
    }

    return groups;
};

const ROLE_SUBTITLES = {
    admin: "Platform activity that needs your attention — bookings, payments, partners and support.",
    operator: "Updates on your vehicles, bookings, consignments and earnings.",
    customer: "Updates on your bookings, payments, refunds and account.",
};

const NotificationPage = ({ role }) => {
    const {
        notifications,
        activeFilter,
        searchQuery,
        loading,
        error,
        actionLoading,
        currentPage,
        totalPages,
        totalCount,
        unreadCount,
        loadNotifications,
        setCurrentPage,
        handleFilterChange,
        handleSearchChange,
        handleMarkAsRead,
        handleMarkAllAsRead,
        handleDismiss,
        handleDismissAll,
    } = useNotifications();

    const [confirmClearOpen, setConfirmClearOpen] = useState(false);

    const categories = useMemo(
        () =>
            (ROLE_CATEGORIES[role] || []).map((key) => ({
                key,
                ...CATEGORY_META[key],
            })),
        [role]
    );

    const activeCategory = categories.find(
        (c) => c.key === activeFilter
    );

    const groups = useMemo(
        () => groupByDay(notifications),
        [notifications]
    );

    const isFiltered =
        activeFilter !== "all" || Boolean(searchQuery.trim());

    const handleConfirmClear = async () => {
        await handleDismissAll();
        setConfirmClearOpen(false);
    };

    const primaryTabs = [
        { key: "all", label: "All", icon: Inbox },
        { key: "unread", label: "Unread", icon: Mail, count: unreadCount },
    ];

    return (
        <div className="mx-auto w-full max-w-4xl">
            {/* Header */}
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex items-start gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white shadow-lg shadow-gray-900/10 dark:bg-white dark:text-gray-900">
                        <Bell size={22} />
                        {unreadCount > 0 && (
                            <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-gray-50 dark:ring-gray-950">
                                {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                        )}
                    </div>

                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-[28px] dark:text-white">
                            Notifications
                        </h1>
                        <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-gray-400">
                            {ROLE_SUBTITLES[role]}
                        </p>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        disabled={actionLoading || unreadCount === 0}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-blue-700 dark:hover:bg-blue-950/60 dark:hover:text-blue-300 dark:disabled:hover:border-gray-700 dark:disabled:hover:bg-gray-900 dark:disabled:hover:text-gray-200"
                    >
                        <CheckCheck size={16} />
                        Mark all read
                    </button>

                    <button
                        type="button"
                        onClick={() => setConfirmClearOpen(true)}
                        disabled={actionLoading || totalCount === 0 || isFiltered}
                        title={
                            isFiltered
                                ? "Clear filters to remove all notifications"
                                : undefined
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-white disabled:hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-red-800 dark:hover:bg-red-950/40 dark:hover:text-red-300 dark:disabled:hover:border-gray-700 dark:disabled:hover:bg-gray-900 dark:disabled:hover:text-gray-200"
                    >
                        <Trash2 size={16} />
                        Clear all
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex shrink-0 self-start rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                        {primaryTabs.map((tab) => {
                            const active = activeFilter === tab.key;
                            const TabIcon = tab.icon;

                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => handleFilterChange(tab.key)}
                                    className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                                        active
                                            ? "text-gray-900 dark:text-white"
                                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                    }`}
                                >
                                    {active && (
                                        <motion.span
                                            layoutId="notif-segment"
                                            transition={{
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 32,
                                            }}
                                            className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-gray-950"
                                        />
                                    )}

                                    <TabIcon size={15} className="relative" />
                                    <span className="relative">{tab.label}</span>

                                    {tab.count > 0 && (
                                        <span className="relative rounded-full bg-blue-600 px-1.5 py-px text-[11px] font-bold text-white">
                                            {tab.count > 99 ? "99+" : tab.count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    <div className="relative sm:w-72">
                        <Search
                            size={16}
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                        />
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            placeholder="Search notifications..."
                            aria-label="Search notifications"
                            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 transition-colors [&::-webkit-search-cancel-button]:hidden focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500 dark:focus:border-blue-600 dark:focus:bg-gray-900 dark:focus:ring-blue-600/20"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => handleSearchChange("")}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                                aria-label="Clear search"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {categories.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                        {categories.map((cat) => {
                            const active = activeFilter === cat.key;
                            const ChipIcon = cat.icon;

                            return (
                                <motion.button
                                    key={cat.key}
                                    type="button"
                                    onClick={() =>
                                        handleFilterChange(active ? "all" : cat.key)
                                    }
                                    whileTap={{ scale: 0.95 }}
                                    aria-pressed={active}
                                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                        active
                                            ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-white"
                                    }`}
                                >
                                    <ChipIcon
                                        size={14}
                                        className={active ? "" : cat.text}
                                    />
                                    {cat.label}
                                    {active && <X size={12} className="-mr-0.5 opacity-70" />}
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* List */}
            <div className="mt-8">
                {loading ? (
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="flex gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
                            >
                                <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
                                <div className="flex-1 space-y-2.5 py-0.5">
                                    <div className="h-3.5 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                                    <div className="h-3 w-4/5 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
                                    <div className="h-2.5 w-28 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center dark:border-red-900/50 dark:bg-red-950/30">
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={() => loadNotifications()}
                            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm ring-1 ring-red-200 hover:bg-red-100 dark:bg-gray-900 dark:text-red-300 dark:ring-red-900 dark:hover:bg-red-950"
                        >
                            <RefreshCw size={15} />
                            Try again
                        </button>
                    </div>
                ) : notifications.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900/60"
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                            {searchQuery.trim() ? (
                                <SearchX size={26} />
                            ) : (
                                <BellOff size={26} />
                            )}
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                            {searchQuery.trim()
                                ? "No matching notifications"
                                : activeCategory
                                  ? `No ${activeCategory.label.toLowerCase()} notifications`
                                  : activeFilter === "unread"
                                    ? "No unread notifications"
                                    : "No notifications yet"}
                        </h3>
                        <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                            {searchQuery.trim()
                                ? "Try a different search term."
                                : "You're all caught up. New updates will show up here."}
                        </p>
                        {isFiltered && (
                            <button
                                type="button"
                                onClick={() => {
                                    handleSearchChange("");
                                    handleFilterChange("all");
                                }}
                                className="mt-5 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                            >
                                Show all notifications
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={`${activeFilter}-${currentPage}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-8"
                        >
                            {groups.map((group) => (
                                // A div, not <section>: the customer site texture paints the innermost
                                // main/section, which must stay the page surface.
                                <div key={group.label} role="group" aria-label={group.label}>
                                    <div className="mb-3 flex items-center gap-2 px-1">
                                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            {group.label}
                                        </h2>
                                        <span className="rounded-full bg-gray-200/70 px-2 py-0.5 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                            {group.items.length}
                                        </span>
                                    </div>

                                    <div className="space-y-3">
                                        <AnimatePresence initial={false} mode="popLayout">
                                            {group.items.map((notification, index) => (
                                                <NotificationItem
                                                    key={notification._id}
                                                    notification={notification}
                                                    index={index}
                                                    role={role}
                                                    onClick={(n) => handleMarkAsRead(n._id)}
                                                    onMarkAsRead={handleMarkAsRead}
                                                    onDismiss={handleDismiss}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                )}
            </div>

            {totalCount > 0 && !loading && !error && (
                <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {(currentPage - 1) * PAGE_SIZE + 1}–
                        {(currentPage - 1) * PAGE_SIZE + notifications.length} of{" "}
                        {totalCount} notification{totalCount !== 1 ? "s" : ""}
                    </p>
                    {totalPages > 1 && (
                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    )}
                </div>
            )}

            <ConfirmDialog
                isOpen={confirmClearOpen}
                onClose={() => setConfirmClearOpen(false)}
                onConfirm={handleConfirmClear}
                title="Clear all notifications?"
                message={`This permanently removes all ${totalCount} notification${
                    totalCount !== 1 ? "s" : ""
                }. This can't be undone.`}
                confirmText="Clear all"
                confirmVariant="danger"
                loading={actionLoading}
            />
        </div>
    );
};

export default NotificationPage;
