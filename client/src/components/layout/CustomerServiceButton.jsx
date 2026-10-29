import { MessageCircle } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import useNavbarOverHero from "./useNavbarOverHero";

import useSupportTicket from "../../hooks/supportTickets/useSupportTicket";
import useSupportRealtime from "../../hooks/supportTickets/useSupportRealtime";

// Fallback refresh in case the live connection is down.
const POLL_INTERVAL = 60_000;
const REFRESH_DEBOUNCE_MS = 400;

const CustomerServiceButton = () => {
    // Glass over the home hero, solid yellow once scrolled — in step with
    // the pill navbar, bell and user menu.
    const { overHero } = useNavbarOverHero("/customer/home");

    const { unreadCount, fetchUnreadCount } = useSupportTicket();
    const refreshTimer = useRef(null);

    const refresh = useCallback(() => {
        fetchUnreadCount().catch(() => {
            // silent - the badge just keeps its last known count
        });
    }, [fetchUnreadCount]);

    const scheduleRefresh = useCallback(() => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(refresh, REFRESH_DEBOUNCE_MS);
    }, [refresh]);

    // A support reply bumps the badge the moment it arrives.
    useSupportRealtime({ onEvent: scheduleRefresh });

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, POLL_INTERVAL);

        return () => {
            clearInterval(id);
            clearTimeout(refreshTimer.current);
        };
    }, [refresh]);

    const label =
        unreadCount > 0
            ? `Customer Service — ${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`
            : "Customer Service";

    return (
        <Link
            to="/customer/customer-service"
            className={`
                group
                fixed
                bottom-[calc(1.5rem+var(--tab-bar-offset,0px))]
                right-6
                z-50
                flex
                h-14
                w-14
                items-center
                justify-center
                rounded-full
                border
                transition-all
                duration-500
                hover:scale-110
                focus:outline-none
                focus-visible:ring-2
                focus-visible:ring-yellow-400
                focus-visible:ring-offset-2
                focus-visible:ring-offset-gray-950
                ${
                    overHero
                        ? /* Warm yellow-tinted glass with a white icon so it
                             stays visible over the dark video. Hover fills
                             it solid, like its scrolled state. */
                          "border-white/15 bg-gradient-to-br from-yellow-300/25 via-gray-950/30 to-gray-950/40 text-white backdrop-blur-xl hover:border-yellow-400 hover:bg-yellow-500 hover:from-yellow-400 hover:to-yellow-500 hover:text-gray-950"
                        : "border-transparent bg-yellow-500 text-white shadow-lg hover:bg-yellow-600 hover:shadow-xl"
                }
            `}
            aria-label={label}
            title={label}
        >
            {/* Colour set on the icon itself: the unlayered `a { color:
                inherit }` in index.css beats Tailwind text-* utilities on
                the <Link>, which left the icon dark. */}
            <MessageCircle
                size={24}
                strokeWidth={2.2}
                className={`relative text-white transition-[transform,color] duration-300 group-hover:-rotate-6 ${
                    overHero ? "group-hover:text-gray-950" : ""
                }`}
            />

            {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[11px] font-bold text-white dark:border-gray-950">
                    <span className="absolute inset-0 animate-ping rounded-full bg-red-500/60" />
                    <span className="relative text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                </span>
            )}
        </Link>
    );
};

export default CustomerServiceButton;
