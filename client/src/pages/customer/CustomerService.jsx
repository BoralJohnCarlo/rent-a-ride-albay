import {
    ArrowLeft,
    Headset,
    Lock,
    MessagesSquare,
    Plus,
    RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import PageHeader from "../../components/common/PageHeader";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import ChatMessages from "../../components/support/ChatMessages";
import ChatComposer from "../../components/support/ChatComposer";
import NewConversationPanel from "../../components/support/NewConversationPanel";
import {
    categoryMeta,
    statusStyle,
} from "../../components/support/supportCategoryMeta";
import {
    errorText,
    formatRelative,
    lastMessageOf,
} from "../../components/support/chatUtils";

import useAuth from "../../hooks/auth/useAuth";
import useSupportTicket from "../../hooks/supportTickets/useSupportTicket";
import useSupportRealtime from "../../hooks/supportTickets/useSupportRealtime";
import useAutoMarkRead from "../../hooks/supportTickets/useAutoMarkRead";
import useToast from "../../hooks/toast/useToast";

const REFRESH_DEBOUNCE_MS = 600;

const SupportAvatar = ({ size = "h-8 w-8", icon = 15 }) => (
    <span
        className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-gray-950 text-yellow-400 ring-2 ring-white dark:bg-yellow-400 dark:text-gray-950 dark:ring-gray-900`}
    >
        <Headset size={icon} />
    </span>
);

const ConversationRow = ({ ticket, active, typing, onSelect }) => {
    const meta = categoryMeta(ticket.category);
    const Icon = meta.icon;
    const status = statusStyle(ticket.status);
    const last = lastMessageOf(ticket);
    const unread = ticket.unreadForCustomer || 0;
    const muted = ticket.status === "Closed";

    return (
        <button
            type="button"
            onClick={() => onSelect(ticket)}
            className={`group relative flex w-full items-start gap-3 rounded-2xl p-4 text-left transition ${
                active
                    ? "bg-yellow-50 ring-1 ring-yellow-300 dark:bg-yellow-500/10 dark:ring-yellow-500/40"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
            }`}
        >
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.tint} ${muted ? "opacity-60" : ""}`}>
                <Icon size={18} />
            </span>

            <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                    <span
                        className={`truncate text-sm ${
                            unread
                                ? "font-bold text-gray-950 dark:text-white"
                                : "font-semibold text-gray-800 dark:text-gray-200"
                        }`}
                    >
                        {ticket.subject}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">
                        {formatRelative(ticket.lastMessageAt || ticket.updatedAt)}
                    </span>
                </span>

                <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span
                        className={`truncate text-xs ${
                            unread
                                ? "font-medium text-gray-800 dark:text-gray-200"
                                : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                        {typing ? (
                            <span className="italic text-yellow-600 dark:text-yellow-400">
                                Support is typing…
                            </span>
                        ) : last ? (
                            `${last.senderRole === "customer" ? "You: " : "Support: "}${last.message}`
                        ) : (
                            ""
                        )}
                    </span>

                    {unread > 0 ? (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-yellow-400 px-1.5 text-[11px] font-bold text-gray-950">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    ) : (
                        <span className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${status.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {ticket.status}
                        </span>
                    )}
                </span>
            </span>
        </button>
    );
};

const ThreadBanner = ({ ticket, onNew }) => {
    if (ticket.status === "Resolved") {
        return (
            <div className="flex items-center gap-2 border-t border-emerald-200/70 bg-emerald-50 px-4 py-2 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 sm:px-6">
                <RotateCcw size={13} className="shrink-0" />
                Support marked this as resolved. Send a message to reopen it.
            </div>
        );
    }

    if (ticket.status === "Closed") {
        return (
            <div className="flex flex-col items-center gap-3 border-t border-gray-200/80 bg-gray-50 px-4 py-5 text-center dark:border-gray-800 dark:bg-gray-900/60 sm:flex-row sm:justify-between sm:text-left">
                <span className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Lock size={15} className="shrink-0" />
                    This conversation is closed.
                </span>
                <button
                    type="button"
                    onClick={onNew}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-yellow-400 px-4 text-sm font-semibold text-gray-950 transition hover:bg-yellow-300"
                >
                    <Plus size={15} />
                    Start a new conversation
                </button>
            </div>
        );
    }

    return null;
};

const CustomerService = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const {
        tickets,
        selectedTicket,
        loading,
        threadLoading,
        submitTicket,
        fetchMyTickets,
        fetchTicketById,
        sendReply,
        markRead,
        clearSelected,
    } = useSupportTicket();

    // "list" (mobile only) | "thread" | "new"
    const [pane, setPane] = useState("list");
    const [newCategory, setNewCategory] = useState("");
    const [loaded, setLoaded] = useState(false);

    const refreshTimer = useRef(null);

    const refreshList = useCallback(
        (silent = false) =>
            fetchMyTickets({ limit: 50, silent }).catch(() => {}),
        [fetchMyTickets]
    );

    const scheduleRefresh = useCallback(() => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(
            () => refreshList(true),
            REFRESH_DEBOUNCE_MS
        );
    }, [refreshList]);

    const { connected, typing, emitTyping } = useSupportRealtime({
        onEvent: scheduleRefresh,
    });

    useAutoMarkRead(
        pane === "thread" ? selectedTicket : null,
        "customer",
        markRead
    );

    useEffect(() => {
        refreshList().finally(() => setLoaded(true));

        return () => {
            clearTimeout(refreshTimer.current);
            clearSelected();
        };
    }, [refreshList, clearSelected]);

    const openTicket = useCallback(
        async (ticketId) => {
            setPane("thread");

            try {
                await fetchTicketById(ticketId);
            } catch (error) {
                toast.error(
                    errorText(error, "Unable to load this conversation."),
                    "Error"
                );
                setPane("list");
            }
        },
        [fetchTicketById, toast]
    );

    // Deep link from a notification: /customer/customer-service?ticket=<id>
    const linkedTicketId = searchParams.get("ticket");

    useEffect(() => {
        if (linkedTicketId) {
            openTicket(linkedTicketId);
        }
    }, [linkedTicketId, openTicket]);

    // With nothing chosen yet, desktop shows the newest chat (or the
    // start-a-chat panel when there are none).
    useEffect(() => {
        if (!loaded || linkedTicketId || selectedTicket || pane !== "list") {
            return;
        }

        if (window.matchMedia("(min-width: 1024px)").matches) {
            if (tickets[0]) {
                openTicket(tickets[0]._id);
            } else {
                setPane("new");
            }
        }
    }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

    const selectTicket = (ticket) => {
        if (linkedTicketId) {
            setSearchParams({}, { replace: true });
        }

        openTicket(ticket._id);
    };

    const startNew = (category = "") => {
        if (linkedTicketId) {
            setSearchParams({}, { replace: true });
        }

        clearSelected();
        setNewCategory(category);
        setPane("new");
    };

    const backToList = () => {
        if (linkedTicketId) {
            setSearchParams({}, { replace: true });
        }

        clearSelected();
        setPane("list");
    };

    const handleCreate = async (values) => {
        const response = await submitTicket(values);
        const ticket = response?.data;

        toast.success(
            "We've got your message — the team will reply right here.",
            "Chat started"
        );

        if (ticket?._id) {
            await openTicket(ticket._id);
        }

        refreshList(true);
    };

    const handleSend = async (message) => {
        if (!selectedTicket?._id) {
            return;
        }

        await sendReply(selectedTicket._id, message);
    };

    const handleTyping = useCallback(
        (isTyping) => emitTyping(selectedTicket?._id, isTyping),
        [emitTyping, selectedTicket?._id]
    );

    const isMine = useCallback(
        (entry) => entry.senderRole === "customer",
        []
    );

    const senderLabel = useCallback(
        (entry) => (entry.senderRole === "admin" ? "Rent-A-Ride Support" : null),
        []
    );

    const avatarFor = useCallback(() => <SupportAvatar />, []);

    const typingNow =
        selectedTicket && typing[selectedTicket._id]?.role === "admin";

    const totalUnread = useMemo(
        () =>
            tickets.reduce(
                (sum, ticket) => sum + (ticket.unreadForCustomer || 0),
                0
            ),
        [tickets]
    );

    const showThread = pane === "thread";
    const showNew = pane === "new";
    const status = selectedTicket ? statusStyle(selectedTicket.status) : null;

    return (
        <main
            className="
                min-h-screen
                bg-gray-50
                px-4
                pt-20
                pb-12
                dark:bg-gray-950
                sm:px-6
                lg:px-8
            "
        >
            <div className="mx-auto w-full max-w-[1200px]">
                <PageHeader
                    title="Customer Service"
                    subtitle="Chat with the Rent-A-Ride Albay team"
                />

                {/* Chat */}
                <section
                    className="
                        mt-8
                        grid
                        h-[min(760px,calc(100dvh-9rem))]
                        min-h-135
                        overflow-hidden
                        rounded-3xl
                        border
                        border-gray-200
                        bg-white
                        shadow-xl
                        shadow-gray-900/5
                        dark:border-gray-800
                        dark:bg-gray-900
                        dark:shadow-black/30
                        lg:grid-cols-[340px_1fr]
                    "
                >
                    {/* Conversations */}
                    <aside
                        className={`min-h-0 flex-col border-gray-200/80 bg-gray-50/60 dark:border-gray-800 dark:bg-gray-950/40 lg:flex lg:border-r ${
                            showThread || showNew ? "hidden" : "flex"
                        }`}
                    >
                        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                                    Messages
                                </h2>
                                {totalUnread > 0 && (
                                    <span className="rounded-full bg-yellow-400 px-2 py-0.5 text-[11px] font-bold text-gray-950">
                                        {totalUnread} new
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => startNew()}
                                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-950 px-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-yellow-400 dark:text-gray-950 dark:hover:bg-yellow-300"
                            >
                                <Plus size={15} />
                                New
                            </button>
                        </div>

                        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
                            {loading && tickets.length === 0 ? (
                                <LoadingSpinner fullScreen={false} />
                            ) : tickets.length === 0 ? (
                                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300">
                                        <MessagesSquare size={26} />
                                    </span>
                                    <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        No conversations yet
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        Questions about a booking, payment or vehicle? Start a chat and our team will reply here.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => startNew()}
                                        className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-yellow-400 px-4 text-sm font-semibold text-gray-950 transition hover:bg-yellow-300"
                                    >
                                        <Plus size={15} />
                                        Start a conversation
                                    </button>
                                </div>
                            ) : (
                                tickets.map((ticket) => (
                                    <ConversationRow
                                        key={ticket._id}
                                        ticket={ticket}
                                        active={showThread && selectedTicket?._id === ticket._id}
                                        typing={typing[ticket._id]?.role === "admin"}
                                        onSelect={selectTicket}
                                    />
                                ))
                            )}
                        </div>
                    </aside>

                    {/* Thread / new conversation */}
                    <div
                        className={`min-h-0 flex-col ${
                            showThread || showNew ? "flex" : "hidden lg:flex"
                        }`}
                    >
                        {showNew ? (
                            <NewConversationPanel
                                key={newCategory || "new"}
                                firstName={user?.firstName}
                                initialCategory={newCategory}
                                onSubmit={handleCreate}
                                onBack={backToList}
                                showBack
                            />
                        ) : showThread && (threadLoading || !selectedTicket) ? (
                            <div className="flex flex-1 items-center justify-center">
                                <LoadingSpinner fullScreen={false} />
                            </div>
                        ) : showThread && selectedTicket ? (
                            <>
                                <header className="flex items-center gap-3 border-b border-gray-200/80 px-4 py-3 dark:border-gray-800 sm:px-6">
                                    <button
                                        type="button"
                                        onClick={backToList}
                                        aria-label="Back to conversations"
                                        className="-ml-1 rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
                                    >
                                        <ArrowLeft size={18} />
                                    </button>

                                    <div className="relative">
                                        <SupportAvatar size="h-10 w-10" icon={18} />
                                        <span
                                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${
                                                connected ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
                                            }`}
                                            title={connected ? "Live" : "Reconnecting…"}
                                        />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {selectedTicket.subject}
                                        </p>
                                        <p className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                            {typingNow ? (
                                                <span className="text-yellow-600 dark:text-yellow-400">
                                                    Support is typing…
                                                </span>
                                            ) : (
                                                <>
                                                    Rent-A-Ride Support · {selectedTicket.category}
                                                </>
                                            )}
                                        </p>
                                    </div>

                                    <span className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 sm:inline-flex ${status.chip}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                                        {selectedTicket.status}
                                    </span>
                                </header>

                                <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.035)_1px,transparent_0)] bg-size-[18px_18px] dark:bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.04)_1px,transparent_0)]">
                                    <ChatMessages
                                        messages={selectedTicket.messages || []}
                                        isMine={isMine}
                                        otherReadAt={selectedTicket.adminLastReadAt}
                                        senderLabel={senderLabel}
                                        avatarFor={avatarFor}
                                        typingLabel={typingNow ? "Support is typing…" : null}
                                        tone="brand"
                                    />
                                </div>

                                <ThreadBanner
                                    ticket={selectedTicket}
                                    onNew={() => startNew()}
                                />

                                {selectedTicket.status !== "Closed" && (
                                    <ChatComposer
                                        key={selectedTicket._id}
                                        draftKey={`customer:${selectedTicket._id}`}
                                        onSend={handleSend}
                                        onTypingChange={handleTyping}
                                        placeholder="Write a message…"
                                        tone="brand"
                                        autoFocus
                                    />
                                )}
                            </>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                                <SupportAvatar size="h-14 w-14" icon={24} />
                                <p className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
                                    Pick a conversation
                                </p>
                                <p className="mt-1 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                                    Or start a new one — our team replies right here.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
};

export default CustomerService;
