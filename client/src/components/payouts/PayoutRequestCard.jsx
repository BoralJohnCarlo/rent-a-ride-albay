import { motion } from "framer-motion";
import {
    ChevronDown,
    ChevronUp,
    Eye,
    Check,
    X,
    Banknote,
} from "lucide-react";
import { useState } from "react";
import formatDate from "../../utils/formatDate";

const PayoutRequestCard = ({
    payout,
    onView,
    onApprove,
    onReject,
    onMarkPaid,
    isAdmin = false,
    onCancel,
    className = ""
}) => {
    const [expanded, setExpanded] = useState(false);

    const statusColors = {
        PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
        APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
        SCHEDULED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
        PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
        REJECTED: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400",
        CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    };

    const statusLabels = {
        PENDING: "Pending",
        APPROVED: "Approved",
        SCHEDULED: "Scheduled",
        PAID: "Paid",
        REJECTED: "Rejected",
        CANCELLED: "Cancelled",
    };

    const operator = payout.operator || {};

    const displayName =
        [operator.firstName, operator.lastName].filter(Boolean).join(" ") ||
        "Unknown";

    const payoutMethodIcon = payout.payoutMethod === "BANK" ? (
        <Banknote size={16} />
    ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
    );

    return (
        <motion.div
            className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900 ${className}`}
            layout
        >
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    {payoutMethodIcon}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {payout.payoutCode}
                        </h3>
                        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[payout.status]}`}>
                            {statusLabels[payout.status]}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {displayName} • {payout.items?.length || 0} booking(s)
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(payout.requestedAt || payout.createdAt)} • {payout.currency} {payout.payoutAmount?.toFixed(2)}
                    </p>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => onView?.(payout)}
                        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="View details"
                    >
                        <Eye size={16} />
                    </button>

                    {isAdmin && payout.status === "PENDING" && (
                        <>
                            <button
                                type="button"
                                onClick={() => onApprove?.(payout)}
                                className="p-2 rounded hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/30 transition-colors"
                                title="Approve"
                            >
                                <Check size={16} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onReject?.(payout)}
                                className="p-2 rounded hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                                title="Reject"
                            >
                                <X size={16} />
                            </button>
                        </>
                    )}

                    {isAdmin && payout.status === "APPROVED" && (
                        <button
                            type="button"
                            onClick={() => onMarkPaid?.(payout)}
                            className="p-2 rounded hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/30 transition-colors"
                            title="Mark as Paid"
                        >
                            <Banknote size={16} />
                        </button>
                    )}

                    {!isAdmin && (payout.status === "PENDING" || payout.status === "REJECTED") && (
                        <button
                            type="button"
                            onClick={() => onCancel?.(payout)}
                            className="p-2 rounded hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                            title="Cancel"
                        >
                            <X size={16} />
                        </button>
                    )}

                    {isAdmin && payout.status === "SCHEDULED" && (
                        <button
                            type="button"
                            onClick={() => onCancel?.(payout)}
                            className="p-2 rounded hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/30 transition-colors"
                            title="Cancel scheduled payout"
                        >
                            <X size={16} />
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => setExpanded(!expanded)}
                        className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${expanded ? "bg-blue-50" : ""}`}
                        title={expanded ? "Collapse" : "Expand"}
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700 space-y-4">
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Payout Summary</h4>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                <p className="text-xs text-gray-500">Subtotal</p>
                                <p className="text-sm font-medium">{payout.currency} {payout.subtotalAmount?.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                <p className="text-xs text-gray-500">Commission</p>
                                <p className="text-sm font-medium text-rose-600">-{payout.currency} {payout.totalCommission?.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
                                <p className="text-xs text-gray-500">Payout Amount</p>
                                <p className="text-sm font-bold text-emerald-600">{payout.currency} {payout.payoutAmount?.toFixed(2)}</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                <p className="text-xs text-gray-500">Bookings</p>
                                <p className="text-sm font-medium">{payout.items?.length || 0}</p>
                            </div>
                        </div>
                    </div>

                    {payout.payoutMethod === "BANK" && payout.bankAccount && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Bank Account</h4>
                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                <p className="text-sm">{payout.bankAccount.bankName}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{payout.bankAccount.accountNumber}</p>
                                <p className="text-xs text-gray-500">{payout.bankAccount.accountName}</p>
                            </div>
                        </div>
                    )}

                    {payout.payoutMethod === "GCASH" && payout.gcashAccount && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">GCash Account</h4>
                            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                <p className="text-sm">{payout.gcashAccount.gcashNumber}</p>
                                <p className="text-xs text-gray-500">{payout.gcashAccount.accountName}</p>
                            </div>
                        </div>
                    )}

                    {payout.rejectionReason && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Rejection Reason</h4>
                            <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-950/30">
                                <p className="text-sm text-rose-700 dark:text-rose-400">{payout.rejectionReason}</p>
                            </div>
                        </div>
                    )}

                    {payout.items && payout.items.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Included Bookings</h4>
                            <div className="space-y-2">
                                {payout.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                                        <div>
                                            <p className="text-sm font-medium">
                                                {item.booking?.bookingCode || `Booking ${idx + 1}`}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.vehicle?.brand} {item.vehicle?.model} ({item.vehicle?.plateNumber})
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-medium">{payout.currency} {item.bookingAmount?.toFixed(2)}</p>
                                            <p className="text-xs text-emerald-600">+{payout.currency} {item.operatorEarnings?.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {payout.paidAt && (
                        <div className="text-xs text-gray-500">
                            Paid on {formatDate(payout.paidAt)} via {payout.paidVia || "Manual"}
                        </div>
                    )}

                    {payout.status === "SCHEDULED" && payout.scheduledReleaseAt && (
                        <div className="text-xs text-gray-500">
                            Releases to wallet on {formatDate(payout.scheduledReleaseAt)}
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default PayoutRequestCard;