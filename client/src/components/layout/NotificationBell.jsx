import { Bell } from "lucide-react";

import { useEffect, useRef, useState } from "react";

import { useNavigate } from "react-router-dom";

import notificationsSound from "../../assets/sound/Notifications.mp3";
import { playSound } from "../../utils/notificationSound";

import useToast from "../../hooks/toast/useToast";

import {
    fetchNotifications,
    fetchUnreadCount,
} from "../../services/notificationService.js";

const POLL_INTERVAL = 30_000;
const MAX_PREVIEW_TOASTS = 3;

/* Toast only supports these; anything else (system, payment, document, ...) reads as neutral info. */
const TOAST_VARIANT_BY_NOTIFICATION_VARIANT = {
    success: "success",
    warning: "warning",
    error: "error",
};

const toToastVariant = (variant) =>
    TOAST_VARIANT_BY_NOTIFICATION_VARIANT[variant] || "info";

const NotificationBell = ({
    navigateTo = "/admin/notifications",
    className = "",
    // Glass look while floating over the home hero (see useNavbarOverHero).
    overHero = false,
    sizeClassName = "h-10 w-10",
}) => {
    const navigate = useNavigate();
    const toast = useToast();
    const [unreadCount, setUnreadCount] = useState(0);
    const prevCountRef = useRef(0);
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetchUnreadCount();
                const count = res.data?.count ?? 0;

                /*
                 * Skip the sound/preview on the very first fetch after mount
                 * — that count reflects notifications that already existed
                 * before this page/session even loaded, not a new one
                 * arriving. Without this, opening any page with existing
                 * unread notifications fired immediately for no new event
                 * at all.
                 */
                if (
                    !isFirstLoadRef.current &&
                    count > prevCountRef.current
                ) {
                    playSound(notificationsSound);

                    const delta = count - prevCountRef.current;

                    try {
                        const previewRes = await fetchNotifications({
                            read: false,
                            limit: Math.min(delta, MAX_PREVIEW_TOASTS),
                        });

                        const newest = previewRes.data || [];

                        // Oldest-first so the most recent notification lands last (bottom of the stack).
                        [...newest].reverse().forEach((notification) => {
                            toast.showToast({
                                variant: toToastVariant(notification.variant),
                                title: notification.title,
                                message: notification.message,
                                silent: true,
                            });
                        });
                    } catch {
                        // silent — the badge count still updates below
                    }
                }

                isFirstLoadRef.current = false;
                prevCountRef.current = count;
                setUnreadCount(count);
            } catch {
                // silent
            }
        };

        load();
        const id = setInterval(load, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [toast]);

    return (
        <button
            type="button"
            onClick={() => navigate(navigateTo)}
            className={`relative flex ${sizeClassName} shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-500 ${
                overHero
                    ? "border-white/15 bg-gray-950/25 text-white shadow-lg shadow-black/10 backdrop-blur-xl hover:bg-gray-950/40"
                    : "border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
            } ${className}`}
            aria-label="Notifications"
        >
            <Bell size={20} />
            {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                    {unreadCount > 99 ? "99+" : unreadCount}
                </span>
            )}
        </button>
    );
};

export default NotificationBell;