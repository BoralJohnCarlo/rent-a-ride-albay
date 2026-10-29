import {
    BadgeCheck,
    CalendarDays,
    ExternalLink,
    Mail,
    MessagesSquare,
    Phone,
    ShieldAlert,
    X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import Avatar from "../../common/Avatar";
import LoadingSpinner from "../../common/LoadingSpinner";
import StatusChip from "../../common/StatusChip";

import { fetchSupportTicketContext } from "../../../services/supportTicketService";

import { formatRelative, fullName } from "../chatUtils";
import { statusStyle } from "../supportCategoryMeta";

const formatDate = (value, withYear = false) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: withYear ? "numeric" : undefined,
          });
};

const formatPeso = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", {
        maximumFractionDigits: 2,
    })}`;

const SectionTitle = ({ children }) => (
    <h4 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {children}
    </h4>
);

/*
 * Right column of the admin support console: who the customer is and what
 * they've booked, so staff can answer without leaving the chat.
 */
const CustomerContextPanel = ({
    ticketId,
    refreshKey,
    onOpenConversation,
    onClose,
}) => {
    const [context, setContext] = useState(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!ticketId) {
            return undefined;
        }

        let cancelled = false;

        setLoading(true);
        setFailed(false);

        fetchSupportTicketContext(ticketId)
            .then((response) => {
                if (!cancelled) {
                    setContext(response?.data || null);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setFailed(true);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [ticketId, refreshKey]);

    const customer = context?.customer;
    const name = fullName(customer, "Customer");

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between border-b border-gray-200/80 px-4 py-3.5 dark:border-gray-800">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Customer
                </h3>
                {onClose && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Hide customer details"
                        className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                        <X size={15} />
                    </button>
                )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {loading && !context ? (
                    <LoadingSpinner fullScreen={false} />
                ) : failed || !customer ? (
                    <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
                        Customer details aren't available.
                    </p>
                ) : (
                    <div className="space-y-6 p-4">
                        <div className="flex flex-col items-center text-center">
                            <Avatar
                                src={customer.profileImage || undefined}
                                name={name}
                                size="lg"
                            />
                            <p className="mt-3 text-base font-semibold text-gray-900 dark:text-white">
                                {name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Customer since {formatDate(customer.createdAt, true)}
                            </p>

                            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                                {customer.isVerified ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                                        <BadgeCheck size={12} />
                                        Verified
                                    </span>
                                ) : (
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                        Not verified
                                    </span>
                                )}
                                {customer.isSuspended && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                                        <ShieldAlert size={12} />
                                        Suspended
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 text-sm">
                            <a
                                href={`mailto:${customer.email}`}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60"
                            >
                                <Mail size={14} className="shrink-0 text-gray-400" />
                                <span className="truncate">{customer.email}</span>
                            </a>
                            {customer.phoneNumber && (
                                <a
                                    href={`tel:${customer.phoneNumber}`}
                                    className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/60"
                                >
                                    <Phone size={14} className="shrink-0 text-gray-400" />
                                    <span className="truncate">{customer.phoneNumber}</span>
                                </a>
                            )}
                            <Link
                                to={`/admin/users?userId=${customer._id}`}
                                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
                            >
                                <ExternalLink size={14} className="shrink-0" />
                                Open in User Moderation
                            </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950/50">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {context.bookingCount}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Bookings
                                </p>
                            </div>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-950/50">
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {context.conversationCount ?? 0}
                                </p>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                    Conversations
                                </p>
                            </div>
                        </div>

                        <div>
                            <SectionTitle>Recent bookings</SectionTitle>

                            {context.recentBookings?.length ? (
                                <div className="space-y-2">
                                    {context.recentBookings.map((booking) => (
                                        <div
                                            key={booking._id}
                                            className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                                        {[booking.vehicle?.brand, booking.vehicle?.model]
                                                            .filter(Boolean)
                                                            .join(" ") || "Vehicle"}
                                                    </p>
                                                    <p className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                                                        {booking.bookingCode}
                                                    </p>
                                                </div>
                                                <StatusChip status={booking.status} size="sm" />
                                            </div>
                                            <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarDays size={12} />
                                                    {formatDate(booking.startDate)} – {formatDate(booking.endDate)}
                                                </span>
                                                <span className="font-semibold text-gray-700 dark:text-gray-200">
                                                    {formatPeso(booking.pricing?.totalAmount)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    No bookings yet.
                                </p>
                            )}
                        </div>

                        <div>
                            <SectionTitle>Conversations</SectionTitle>

                            <div className="space-y-1">
                                {context.conversations?.map((conversation) => {
                                    const current = conversation._id === ticketId;
                                    const style = statusStyle(conversation.status);

                                    return (
                                        <button
                                            key={conversation._id}
                                            type="button"
                                            disabled={current}
                                            onClick={() => onOpenConversation(conversation._id)}
                                            className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition ${
                                                current
                                                    ? "bg-blue-50 dark:bg-blue-500/10"
                                                    : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                            }`}
                                        >
                                            <MessagesSquare size={14} className="shrink-0 text-gray-400" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                                                    {conversation.subject}
                                                </span>
                                                <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                                                    <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                                                    {conversation.status}
                                                    {conversation.lastMessageAt &&
                                                        ` · ${formatRelative(conversation.lastMessageAt)}`}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerContextPanel;
