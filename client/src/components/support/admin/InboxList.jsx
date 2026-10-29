import { motion } from "framer-motion";
import { Inbox, Search, X } from "lucide-react";

import Avatar from "../../common/Avatar";
import LoadingSpinner from "../../common/LoadingSpinner";

import { categoryMeta, statusStyle } from "../supportCategoryMeta";
import {
    formatDuration,
    formatRelative,
    fullName,
    lastMessageOf,
    waitingMs,
} from "../chatUtils";

import { ACTIVE_PILL_SPRING } from "../../../constants/animations";

const MINUTE = 60 * 1000;

// How long a customer has waited, coloured by urgency.
const waitTone = (ms) => {
    if (ms >= 60 * MINUTE) {
        return "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30";
    }

    if (ms >= 15 * MINUTE) {
        return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30";
    }

    return "bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700";
};

const INBOX_FILTERS = [
    { key: "unread", label: "Needs reply" },
    { key: "all", label: "All" },
    { key: "Open", label: "Open" },
    { key: "In Progress", label: "In progress" },
    { key: "Resolved", label: "Resolved" },
    { key: "Closed", label: "Closed" },
];

const countFor = (counts, key) =>
    key === "unread" ? counts?.unread : key === "all" ? counts?.all : counts?.[key];

const InboxRow = ({ ticket, active, typing, onSelect }) => {
    const name = fullName(ticket.customer, "Customer");
    const last = lastMessageOf(ticket);
    const unread = ticket.unreadForAdmin || 0;
    const waiting = waitingMs(ticket);
    const status = statusStyle(ticket.status);
    const CategoryIcon = categoryMeta(ticket.category).icon;

    let preview = "";

    if (typing?.role === "customer") {
        preview = (
            <span className="italic text-blue-600 dark:text-blue-400">
                typing…
            </span>
        );
    } else if (last) {
        preview = `${last.senderRole === "customer" ? "" : `${last.agentName?.split(" ")[0] || "Support"}: `}${last.message}`;
    }

    return (
        <button
            type="button"
            onClick={() => onSelect(ticket)}
            className={`group relative flex w-full gap-3 rounded-xl px-3 py-3 text-left transition ${
                active
                    ? "bg-blue-50 dark:bg-blue-500/10"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
            }`}
        >
            {active && (
                <motion.span
                    layoutId="support-inbox-active"
                    transition={ACTIVE_PILL_SPRING}
                    className="absolute inset-y-2 left-0 w-1 rounded-full bg-blue-600 dark:bg-blue-400"
                />
            )}

            <div className="relative shrink-0">
                <Avatar
                    src={ticket.customer?.profileImage || undefined}
                    name={name}
                    size="sm"
                />
                <span
                    className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${status.dot}`}
                    title={ticket.status}
                />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span
                        className={`truncate text-sm ${
                            unread
                                ? "font-bold text-gray-950 dark:text-white"
                                : "font-semibold text-gray-800 dark:text-gray-200"
                        }`}
                    >
                        {name}
                    </span>
                    <span
                        className={`shrink-0 text-[11px] ${
                            unread
                                ? "font-semibold text-blue-600 dark:text-blue-400"
                                : "text-gray-400 dark:text-gray-500"
                        }`}
                    >
                        {formatRelative(ticket.lastMessageAt || ticket.updatedAt)}
                    </span>
                </div>

                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                    <CategoryIcon size={12} className="shrink-0 text-gray-400" />
                    <span className="truncate font-medium">{ticket.subject}</span>
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                        className={`truncate text-xs ${
                            unread
                                ? "text-gray-800 dark:text-gray-200"
                                : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                        {preview}
                    </span>

                    <span className="flex shrink-0 items-center gap-1.5">
                        {waiting !== null && (
                            <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ${waitTone(waiting)}`}
                                title="Waiting for a reply"
                            >
                                {formatDuration(waiting)}
                            </span>
                        )}
                        {unread > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">
                                {unread > 9 ? "9+" : unread}
                            </span>
                        )}
                    </span>
                </div>
            </div>
        </button>
    );
};

/*
 * Left column of the admin support console: live status, filter chips with
 * counts, search, and conversation rows showing who's waiting and for how
 * long.
 */
const InboxList = ({
    tickets,
    counts,
    loading,
    filter,
    onFilterChange,
    search,
    onSearchChange,
    selectedId,
    onSelect,
    typing,
    connected,
    reconnecting,
    footer,
}) => (
    <div className="flex h-full min-h-0 flex-col">
        <div className="space-y-3 border-b border-gray-200/80 px-4 pb-3 pt-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
                        Inbox
                    </h2>
                    {counts?.unread > 0 && (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                            {counts.unread}
                        </span>
                    )}
                </div>

                <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        connected
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                >
                    <span className="relative flex h-2 w-2">
                        {connected && (
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span
                            className={`relative inline-flex h-2 w-2 rounded-full ${
                                connected ? "bg-emerald-500" : "bg-gray-400"
                            }`}
                        />
                    </span>
                    {connected ? "Live" : reconnecting ? "Reconnecting…" : "Offline"}
                </span>
            </div>

            <div className="relative">
                <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                    type="text"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search name, email, subject…"
                    aria-label="Search conversations"
                    className="h-9 w-full rounded-full border border-gray-200 bg-gray-50 pl-9 pr-8 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-500"
                />
                {search && (
                    <button
                        type="button"
                        onClick={() => onSearchChange("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {/*
                Six chips never fit a 340px column on one line, and a
                scrolling strip just clips whichever one lands on the edge
                with no hint more exist. Wrapping guarantees every chip is
                always fully visible instead.
            */}
            <div
                role="tablist"
                aria-label="Filter conversations"
                className="flex flex-wrap gap-1.5"
            >
                {INBOX_FILTERS.map((option) => {
                    const active = filter === option.key;
                    const count = countFor(counts, option.key);

                    return (
                        <button
                            key={option.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onFilterChange(option.key)}
                            className={`relative inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
                                active
                                    ? "text-white"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                            }`}
                        >
                            {active && (
                                <motion.span
                                    layoutId="support-inbox-filter"
                                    transition={ACTIVE_PILL_SPRING}
                                    className="absolute inset-0 rounded-full bg-blue-600 shadow-sm shadow-blue-600/25 dark:bg-blue-500"
                                />
                            )}
                            <span className="relative">{option.label}</span>
                            {typeof count === "number" && (count > 0 || active) && (
                                <span
                                    className={`relative rounded-full px-1.5 text-[10px] ${
                                        active
                                            ? "bg-white/25 text-white"
                                            : option.key === "unread"
                                              ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                    }`}
                                >
                                    {count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
            {loading && tickets.length === 0 ? (
                <LoadingSpinner fullScreen={false} />
            ) : tickets.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        <Inbox size={22} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {filter === "unread" ? "All caught up" : "No conversations"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {filter === "unread"
                            ? "Nobody is waiting on a reply right now."
                            : "Customer chats will show up here."}
                    </p>
                </div>
            ) : (
                tickets.map((ticket) => (
                    <InboxRow
                        key={ticket._id}
                        ticket={ticket}
                        active={ticket._id === selectedId}
                        typing={typing[ticket._id]}
                        onSelect={onSelect}
                    />
                ))
            )}
        </div>

        {footer}
    </div>
);

export default InboxList;
