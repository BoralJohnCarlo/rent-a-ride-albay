import { motion } from "framer-motion";
import {
    ArrowLeft,
    Headset,
    Lock,
    PanelRightClose,
    PanelRightOpen,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import Avatar from "../../components/common/Avatar";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Pagination from "../../components/common/Pagination";

import ChatMessages from "../../components/support/ChatMessages";
import ChatComposer from "../../components/support/ChatComposer";
import InboxList from "../../components/support/admin/InboxList";
import CustomerContextPanel from "../../components/support/admin/CustomerContextPanel";
import {
    categoryMeta,
    statusStyle,
} from "../../components/support/supportCategoryMeta";
import {
    errorText,
    formatDuration,
    fullName,
    waitingMs,
} from "../../components/support/chatUtils";

import useAuth from "../../hooks/auth/useAuth";
import useSupportTicket from "../../hooks/supportTickets/useSupportTicket";
import useSupportRealtime from "../../hooks/supportTickets/useSupportRealtime";
import useAutoMarkRead from "../../hooks/supportTickets/useAutoMarkRead";
import useToast from "../../hooks/toast/useToast";

import { SUPPORT_TICKET_STATUS_VALUES } from "../../constants/supportTicketConstants";
import { ACTIVE_PILL_SPRING } from "../../constants/animations";

const PAGE_SIZE = 30;
const REFRESH_DEBOUNCE_MS = 700;
// Re-render "waiting 12m" style timers without any new data.
const CLOCK_TICK_MS = 30_000;

/*
 * Canned replies for the composer. {name} becomes the customer's first
 * name; staff can edit before sending.
 */
const QUICK_REPLIES = [
    {
        label: "Greeting",
        text: "Hi {name}! Thanks for reaching out to Rent-A-Ride Albay. ",
    },
    {
        label: "Looking into it",
        text: "Thanks for the details — I'm checking this now and will update you here shortly.",
    },
    {
        label: "Which booking?",
        text: "Could you tell me which vehicle and dates this is about so I can pull up your booking?",
    },
    {
        label: "Refund timing",
        text: "Refunds go back to your original payment method. You can follow the status under My Bookings.",
    },
    {
        label: "Anything else?",
        text: "Is there anything else I can help you with?",
    },
    {
        label: "Wrap up",
        text: "Glad we could help, {name}! I'll mark this as resolved — just reply here if anything else comes up.",
    },
];

const StatusSwitch = ({ value, onChange, disabled }) => (
    <div
        role="radiogroup"
        aria-label="Conversation status"
        className="flex items-center gap-0.5 rounded-full border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-950"
    >
        {SUPPORT_TICKET_STATUS_VALUES.map((status) => {
            const active = value === status;
            const style = statusStyle(status);

            return (
                <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => !active && onChange(status)}
                    className={`relative inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-semibold transition-colors disabled:cursor-wait sm:px-2.5 ${
                        active
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                    }`}
                >
                    {active && (
                        <motion.span
                            layoutId="support-status-switch"
                            transition={ACTIVE_PILL_SPRING}
                            className="absolute inset-0 rounded-full bg-white shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
                        />
                    )}
                    <span className={`relative h-1.5 w-1.5 rounded-full ${style.dot}`} />
                    <span className="relative">{status}</span>
                </button>
            );
        })}
    </div>
);

const CustomerServicePage = () => {
    const { user } = useAuth();
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const {
        tickets,
        pagination,
        counts,
        selectedTicket,
        loading,
        threadLoading,
        fetchAdminTickets,
        fetchTicketById,
        sendReply,
        markRead,
        changeStatus,
        clearSelected,
    } = useSupportTicket();

    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [statusUpdating, setStatusUpdating] = useState(false);
    // Open by default only where it fits beside the chat (2xl column).
    const [showContext, setShowContext] = useState(
        () => window.matchMedia("(min-width: 1536px)").matches
    );
    const [contextRefresh, setContextRefresh] = useState(0);
    const [, setClock] = useState(0);

    const refreshTimer = useRef(null);
    const selectedId = searchParams.get("ticket");
    const myId = user?._id;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        const id = setInterval(() => setClock((tick) => tick + 1), CLOCK_TICK_MS);
        return () => clearInterval(id);
    }, []);

    const loadTickets = useCallback(
        (silent = false) =>
            fetchAdminTickets({
                status:
                    filter !== "all" && filter !== "unread"
                        ? filter
                        : undefined,
                unread: filter === "unread" ? "true" : undefined,
                search: debouncedSearch || undefined,
                page,
                limit: PAGE_SIZE,
                silent,
            }).catch((error) => {
                if (!silent) {
                    toast.error(
                        errorText(error, "Failed to load conversations."),
                        "Error"
                    );
                }
            }),
        [fetchAdminTickets, filter, debouncedSearch, page, toast]
    );

    useEffect(() => {
        loadTickets();
    }, [loadTickets]);

    // Realtime events update rows in place at once; this follow-up refetch
    // brings in brand-new conversations, re-filters, and refreshes counts.
    const scheduleRefresh = useCallback(() => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(
            () => loadTickets(true),
            REFRESH_DEBOUNCE_MS
        );
    }, [loadTickets]);

    useEffect(() => () => clearTimeout(refreshTimer.current), []);

    const { connected, reconnecting, typing, emitTyping } =
        useSupportRealtime({ onEvent: scheduleRefresh });

    useAutoMarkRead(selectedTicket, "admin", markRead);

    // The open conversation follows ?ticket= (rows, notifications, and the
    // customer panel's other-conversations list all link through it).
    useEffect(() => {
        if (!selectedId) {
            clearSelected();
            return;
        }

        fetchTicketById(selectedId).catch((error) => {
            toast.error(
                errorText(error, "Unable to load this conversation."),
                "Error"
            );
            setSearchParams({}, { replace: true });
        });
    }, [selectedId, fetchTicketById, clearSelected, setSearchParams, toast]);

    useEffect(() => () => clearSelected(), [clearSelected]);

    const openConversation = useCallback(
        (ticketId) => setSearchParams({ ticket: ticketId }),
        [setSearchParams]
    );

    const handleFilterChange = (key) => {
        setFilter(key);
        setPage(1);
    };

    const handleSearchChange = (value) => {
        setSearch(value);
        setPage(1);
    };

    const handleSend = async (message) => {
        if (!selectedTicket?._id) {
            return;
        }

        await sendReply(selectedTicket._id, message);
    };

    const handleStatusChange = async (status) => {
        if (!selectedTicket?._id) {
            return;
        }

        setStatusUpdating(true);

        try {
            await changeStatus(selectedTicket._id, status);
            setContextRefresh((value) => value + 1);
        } catch (error) {
            toast.error(
                errorText(error, "Unable to update the conversation status."),
                "Error"
            );
        } finally {
            setStatusUpdating(false);
        }
    };

    const handleTyping = useCallback(
        (isTyping) => emitTyping(selectedTicket?._id, isTyping),
        [emitTyping, selectedTicket?._id]
    );

    const customerName = fullName(selectedTicket?.customer, "Customer");
    const customerFirst = selectedTicket?.customer?.firstName || "there";

    const quickReplies = useMemo(
        () =>
            QUICK_REPLIES.map((reply) => ({
                ...reply,
                text: reply.text.replaceAll("{name}", customerFirst),
            })),
        [customerFirst]
    );

    const isMine = useCallback(
        (entry) => entry.senderRole === "admin",
        []
    );

    const senderLabel = useCallback(
        (entry) => {
            if (entry.senderRole !== "admin") {
                return null;
            }

            const senderId = entry.sender?._id || entry.sender;

            return senderId === myId ? "You" : entry.agentName || "Support";
        },
        [myId]
    );

    const avatarFor = useCallback(
        () => (
            <Avatar
                src={selectedTicket?.customer?.profileImage || undefined}
                name={customerName}
                size="xs"
            />
        ),
        [selectedTicket?.customer?.profileImage, customerName]
    );

    const typingNow = selectedTicket ? typing[selectedTicket._id] : null;

    let typingLabel = null;

    if (typingNow?.role === "customer") {
        typingLabel = `${customerFirst} is typing…`;
    } else if (typingNow?.role === "admin" && typingNow.agentId !== myId) {
        typingLabel = `${typingNow.agentName || "Another admin"} is also replying…`;
    }

    const waiting = waitingMs(selectedTicket);
    const CategoryIcon = selectedTicket
        ? categoryMeta(selectedTicket.category).icon
        : null;
    const isClosed = selectedTicket?.status === "Closed";
    const threadOpen = Boolean(selectedId);

    return (
        <div
            className="
                relative
                grid
                h-[calc(100dvh-7rem)]
                min-h-140
                max-lg:h-[calc(100dvh-11.5rem-env(safe-area-inset-bottom))]
                max-lg:min-h-96
                max-sm:h-[calc(100dvh-10.5rem-env(safe-area-inset-bottom))]
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-sm
                dark:border-gray-800
                dark:bg-gray-900
                lg:grid-cols-[340px_minmax(0,1fr)]
                2xl:grid-cols-[340px_minmax(0,1fr)_auto]
            "
        >
            {/* Inbox */}
            <aside
                className={`min-h-0 border-gray-200/80 dark:border-gray-800 lg:block lg:border-r ${
                    threadOpen ? "hidden" : "block"
                }`}
            >
                <InboxList
                    tickets={tickets}
                    counts={counts}
                    loading={loading}
                    filter={filter}
                    onFilterChange={handleFilterChange}
                    search={search}
                    onSearchChange={handleSearchChange}
                    selectedId={selectedId}
                    onSelect={(ticket) => openConversation(ticket._id)}
                    typing={typing}
                    connected={connected}
                    reconnecting={reconnecting}
                    footer={
                        pagination.pages > 1 && (
                            <div className="flex justify-center border-t border-gray-200/80 px-2 py-2 dark:border-gray-800">
                                <Pagination
                                    currentPage={page}
                                    totalPages={pagination.pages}
                                    onPageChange={setPage}
                                />
                            </div>
                        )
                    }
                />
            </aside>

            {/* Conversation */}
            <section
                className={`min-h-0 min-w-0 flex-col bg-gray-50/60 dark:bg-gray-950/40 lg:flex ${
                    threadOpen ? "flex" : "hidden"
                }`}
            >
                {!threadOpen ? (
                    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/25">
                            <Headset size={28} />
                        </span>
                        <p className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">
                            Pick a conversation
                        </p>
                        <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                            {counts?.unread
                                ? `${counts.unread} customer${counts.unread === 1 ? " is" : "s are"} waiting on a reply.`
                                : "You're all caught up. New customer messages appear here instantly."}
                        </p>
                        {counts?.unread > 0 && filter !== "unread" && (
                            <button
                                type="button"
                                onClick={() => handleFilterChange("unread")}
                                className="dashboard-primary-button mt-4 inline-flex h-9 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
                            >
                                Show who needs a reply
                            </button>
                        )}
                    </div>
                ) : threadLoading && selectedTicket?._id !== selectedId ? (
                    <div className="flex flex-1 items-center justify-center">
                        <LoadingSpinner fullScreen={false} />
                    </div>
                ) : selectedTicket ? (
                    <>
                        <header className="flex flex-wrap items-center gap-3 border-b border-gray-200/80 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                            <button
                                type="button"
                                onClick={() => setSearchParams({})}
                                aria-label="Back to inbox"
                                className="-ml-1 rounded-full p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
                            >
                                <ArrowLeft size={18} />
                            </button>

                            <Avatar
                                src={selectedTicket.customer?.profileImage || undefined}
                                name={customerName}
                                size="sm"
                            />

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                        {customerName}
                                    </p>
                                    {waiting !== null && (
                                        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                                            Waiting {formatDuration(waiting)}
                                        </span>
                                    )}
                                </div>
                                <p className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                                    {CategoryIcon && <CategoryIcon size={12} className="shrink-0" />}
                                    <span className="truncate">
                                        {selectedTicket.subject}
                                    </span>
                                    <span className="shrink-0 font-mono text-[11px] text-gray-400">
                                        · {selectedTicket.ticketCode}
                                    </span>
                                </p>
                            </div>

                            <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
                                <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                    <StatusSwitch
                                        value={selectedTicket.status}
                                        onChange={handleStatusChange}
                                        disabled={statusUpdating}
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowContext((value) => !value)}
                                    aria-label={showContext ? "Hide customer details" : "Show customer details"}
                                    title={showContext ? "Hide customer details" : "Show customer details"}
                                    className={`inline-flex rounded-lg p-2 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white ${
                                        showContext
                                            ? "text-blue-600 dark:text-blue-400"
                                            : "text-gray-500 dark:text-gray-400"
                                    }`}
                                >
                                    {showContext ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
                                </button>
                            </div>
                        </header>

                        <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.035)_1px,transparent_0)] bg-size-[18px_18px] dark:bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.04)_1px,transparent_0)]">
                            <ChatMessages
                                messages={selectedTicket.messages || []}
                                isMine={isMine}
                                otherReadAt={selectedTicket.customerLastReadAt}
                                senderLabel={senderLabel}
                                avatarFor={avatarFor}
                                typingLabel={typingLabel}
                                tone="blue"
                            />
                        </div>

                        {isClosed ? (
                            <div className="flex flex-col items-center gap-3 border-t border-gray-200/80 bg-white px-4 py-4 text-center dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:justify-between sm:text-left">
                                <span className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                    <Lock size={15} className="shrink-0" />
                                    Closed — the customer can't reply here anymore.
                                </span>
                                <button
                                    type="button"
                                    disabled={statusUpdating}
                                    onClick={() => handleStatusChange("Open")}
                                    className="dashboard-primary-button inline-flex h-9 items-center rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                                >
                                    Reopen conversation
                                </button>
                            </div>
                        ) : (
                            <ChatComposer
                                key={selectedTicket._id}
                                draftKey={`admin:${selectedTicket._id}`}
                                onSend={handleSend}
                                onTypingChange={handleTyping}
                                placeholder={`Reply to ${customerFirst}…`}
                                quickReplies={quickReplies}
                                tone="blue"
                                autoFocus
                            />
                        )}
                    </>
                ) : null}
            </section>

            {/* Customer details: a third column on wide screens, a
                slide-over on narrower ones. */}
            {threadOpen && selectedTicket && showContext && (
                <motion.aside
                    initial={{ x: 24, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="absolute inset-y-0 right-0 z-20 min-h-0 w-80 max-w-[90%] border-l border-gray-200/80 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 2xl:static 2xl:max-w-none 2xl:shadow-none"
                >
                    <CustomerContextPanel
                        ticketId={selectedTicket._id}
                        refreshKey={contextRefresh}
                        onOpenConversation={openConversation}
                        onClose={() => setShowContext(false)}
                    />
                </motion.aside>
            )}
        </div>
    );
};

export default CustomerServicePage;
