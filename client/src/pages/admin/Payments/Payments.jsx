import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import { useSearchParams } from "react-router-dom";

import { motion } from "framer-motion";

import {
    CheckCircle2,
    Clock3,
    Eye,
    ReceiptText,
    Plus,
    RefreshCw,
    Send,
    ShieldCheck,
    TrendingUp,
    Undo2,
    Wallet,
    XCircle,
} from "lucide-react";

import Button from "../../../components/common/Button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import ExportExcelPill from "../../../components/common/ExportExcelPill";
import Input from "../../../components/common/Input";
import Modal from "../../../components/common/Modal";
import PillSearch from "../../../components/common/PillSearch";
import PillTabs from "../../../components/common/PillTabs";
import Select from "../../../components/common/Select";
import StatusChip from "../../../components/common/StatusChip";
import Textarea from "../../../components/common/Textarea";

import usePayment from "../../../hooks/payments/usePayment";
import useRefund from "../../../hooks/refunds/useRefund";
import useRental from "../../../hooks/rentals/useRental";
import useToast from "../../../hooks/toast/useToast";

import OwedRefundsPanel from "../../../components/admin/OwedRefundsPanel";
import FinancialExportDialog from "../../../components/admin/FinancialExportDialog";

import { getRentals } from "../../../api/rentalApi";
import { getOwedRefunds } from "../../../api/refundApi";
import { recordBookingRefund } from "../../../services/refundService";
import { RENTAL_REFUND_REASON } from "../../../constants/rentalConstants";
import StackedTable from "../../../components/tables/StackedTable";

const FINANCIAL_TABS = [
    { key: "payments", label: "Payments" },
    { key: "refunds", label: "Refunds" },
    { key: "owed-refunds", label: "Owed Refunds" },
    { key: "early-returns", label: "Early Returns" },
];

const OWED_REFUND_STATUS_TABS = [
    { key: "Owed", label: "Owed" },
    { key: "Paid", label: "Paid" },
    { key: "Not Paid", label: "Not Paid" },
    { key: "All", label: "All" },
];

const PAYMENT_STATUS_TABS = [
    { key: "All", label: "All" },
    { key: "PENDING", label: "Pending" },
    { key: "VERIFIED", label: "Verified" },
    { key: "REFUNDED", label: "Refunded" },
    { key: "CANCELLED", label: "Cancelled" },
];

const REFUND_STATUS_TABS = [
    { key: "All", label: "All" },
    { key: "Pending", label: "Pending" },
    { key: "Approved", label: "Approved" },
    { key: "Rejected", label: "Rejected" },
];

const EARLY_RETURN_STATUS_TABS = [
    { key: "All", label: "All" },
    { key: "Pending", label: "Pending" },
    { key: "Approved", label: "Approved" },
    { key: "Rejected", label: "Rejected" },
];

const PAYMENT_METHOD_OPTIONS = [
    { value: "All", label: "All methods" },
    { value: "GCASH", label: "GCash" },
    { value: "CASH_ON_PICKUP", label: "Cash on Pickup" },
];

const PAYMENT_TYPE_OPTIONS = [
    { value: "All", label: "All types" },
    { value: "RESERVATION_FEE", label: "Reservation fee" },
    { value: "EXTENSION_FEE", label: "Extension fee" },
];

const REFUND_REASON_OPTIONS = Object.values(
    RENTAL_REFUND_REASON
).map((reason) => ({ value: reason, label: reason }));

const REFUND_PAGE_SIZE = 50;
const EARLY_RETURN_PAGE_SIZE = 50;

const peso = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

/*
 * A one-line refund cue for a payment's row. The payment's own status stays
 * VERIFIED for anything short of a full refund (a partial refund, or one that
 * is still held/in flight), so without this an admin scanning the list has no
 * way to spot a refund that is waiting on them. A fully refunded payment
 * already reads REFUNDED, so it needs no extra badge.
 */
const getPaymentRefundBadge = (payment) => {
    const refund = payment?.refund;

    if (!refund || payment.status === "REFUNDED") {
        return null;
    }

    switch (refund.status) {
        case "requires_manual_action":
            return {
                text: `${peso(refund.amount)} refund needs action`,
                className:
                    "text-amber-600 dark:text-amber-400",
            };

        case "pending":
        case "processing":
            return {
                text: `${peso(refund.amount)} refund in progress`,
                className:
                    "text-blue-600 dark:text-blue-400",
            };

        case "succeeded":
            return {
                text: `${peso(refund.amount)} refunded`,
                className:
                    "text-emerald-600 dark:text-emerald-400",
            };

        case "failed":
            return {
                text: "Refund failed",
                className:
                    "text-red-600 dark:text-red-400",
            };

        default:
            return null;
    }
};

const titleCase = (text) =>
    (text || "")
        .toLowerCase()
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());

const getCustomerName = (customer) => {
    if (!customer) {
        return "—";
    }

    const fullName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(" ");

    return (
        customer.fullName ||
        fullName ||
        customer.name ||
        customer.email ||
        "—"
    );
};

const getBookingCode = (booking) => {
    if (!booking) {
        return "—";
    }

    if (typeof booking === "string") {
        return booking;
    }

    return booking.bookingCode || booking._id || "—";
};

const formatDate = (value) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
};

const formatDateTime = (value) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
};

const TONE_CLASSES = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
    emerald:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const KpiCard = ({ label, value, hint, icon: Icon, tone }) => (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {label}
            </p>
            <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    TONE_CLASSES[tone] ?? TONE_CLASSES.blue
                }`}
            >
                <Icon size={17} />
            </span>
        </div>

        <p className="mt-3 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {value}
        </p>

        {hint && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {hint}
            </p>
        )}
    </div>
);

const DetailRow = ({ label, children }) => (
    <div className="flex flex-col gap-0.5 border-b border-gray-100 py-2.5 last:border-0 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {label}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white sm:text-right">
            {children ?? "—"}
        </span>
    </div>
);

const IconButton = ({ label, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        title={label}
        aria-label={label}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:border-blue-900 dark:hover:bg-gray-800 dark:hover:text-blue-400"
    >
        {children}
    </button>
);

const cardClass =
    "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900";
const thClass =
    "px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400";
const tdClass =
    "whitespace-nowrap px-5 py-4 text-sm text-gray-700 dark:text-gray-200";

const Financials = () => {
    const {
        payments = [],
        loading: paymentsLoading = false,
        error: paymentsError = null,
        fetchPayments,
        verifyExistingPayment,
        reconcilePayment,
        reconcileRefund,
        sendRefund,
        completeRefund,
    } = usePayment();

    const {
        refunds = [],
        pagination: refundPagination = null,
        summary: refundsSummary = null,
        loading: refundsLoading = false,
        error: refundsError = null,
        fetchRefunds,
        approveExistingRefund,
        rejectExistingRefund,
        settleExistingRefund,
    } = useRefund();

    const {
        earlyReturnCredits = [],
        earlyReturnSummary = null,
        earlyReturnPagination = null,
        loading: earlyReturnsLoading = false,
        error: earlyReturnsError = null,
        fetchEarlyReturnCredits,
        approveEarlyReturn,
        rejectEarlyReturn,
    } = useRental();

    const toast = useToast();

    const [searchParams] = useSearchParams();
    const requestedTab = searchParams.get("tab");

    const [activeFinancialTab, setActiveFinancialTab] =
        useState(
            FINANCIAL_TABS.some(
                (tab) => tab.key === requestedTab
            )
                ? requestedTab
                : "payments"
        );
    const [search, setSearch] = useState("");
    const [owedRefunds, setOwedRefunds] = useState({
        items: [],
        counts: {},
        loading: false,
        error: "",
    });
    const [activeOwedStatus, setActiveOwedStatus] =
        useState("Owed");
    const [activePaymentStatus, setActivePaymentStatus] =
        useState("All");
    const [paymentMethod, setPaymentMethod] = useState("All");
    const [paymentType, setPaymentType] = useState("All");
    const [activeRefundStatus, setActiveRefundStatus] =
        useState("All");
    const [refundLimit, setRefundLimit] =
        useState(REFUND_PAGE_SIZE);
    const [activeEarlyReturnStatus, setActiveEarlyReturnStatus] =
        useState("All");
    const [earlyReturnLimit, setEarlyReturnLimit] =
        useState(EARLY_RETURN_PAGE_SIZE);

    const [actionId, setActionId] = useState(null);
    const [detailPayment, setDetailPayment] = useState(null);
    const [detailRefund, setDetailRefund] = useState(null);
    const [reasonModal, setReasonModal] = useState(null);
    const [recordModal, setRecordModal] = useState(null);
    const [manualRefundModal, setManualRefundModal] = useState(null);
    const [settleModal, setSettleModal] = useState(null);
    const [approveModal, setApproveModal] = useState(null);
    const [earlyReturnApproveModal, setEarlyReturnApproveModal] =
        useState(null);
    const [earlyReturnReasonModal, setEarlyReturnReasonModal] =
        useState(null);
    const [confirmState, setConfirmState] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);

    const runConfirm = async () => {
        if (!confirmState?.onConfirm) {
            setConfirmState(null);
            return;
        }

        setConfirmBusy(true);

        try {
            await confirmState.onConfirm();
            setConfirmState(null);
        } finally {
            setConfirmBusy(false);
        }
    };

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    /*
     * Refunds and early returns are paginated, so their status tabs filter
     * on the server — filtering only the loaded page would show an empty
     * table for a status whose rows sit beyond it, while the tab badge
     * (a server-wide count) says they exist.
     */
    const refundQuery = useMemo(
        () => ({
            limit: refundLimit,
            ...(activeRefundStatus !== "All" && {
                status: activeRefundStatus,
            }),
        }),
        [refundLimit, activeRefundStatus]
    );

    const earlyReturnQuery = useMemo(
        () => ({
            limit: earlyReturnLimit,
            ...(activeEarlyReturnStatus !== "All" && {
                status: activeEarlyReturnStatus,
            }),
        }),
        [earlyReturnLimit, activeEarlyReturnStatus]
    );

    const changeRefundStatus = (status) => {
        setActiveRefundStatus(status);
        setRefundLimit(REFUND_PAGE_SIZE);
    };

    const changeEarlyReturnStatus = (status) => {
        setActiveEarlyReturnStatus(status);
        setEarlyReturnLimit(EARLY_RETURN_PAGE_SIZE);
    };

    useEffect(() => {
        fetchRefunds(refundQuery);
    }, [fetchRefunds, refundQuery]);

    // Loaded up front so the section tab can show how many are still owed.
    const loadOwedRefunds = useCallback(async () => {
        setOwedRefunds((current) => ({
            ...current,
            loading: true,
            error: "",
        }));

        try {
            const response = await getOwedRefunds();

            setOwedRefunds({
                items: response?.data ?? [],
                counts: response?.counts ?? {},
                loading: false,
                error: "",
            });
        } catch (owedError) {
            setOwedRefunds((current) => ({
                ...current,
                loading: false,
                error:
                    owedError?.response?.data?.message ||
                    "Unable to load owed refunds.",
            }));
        }
    }, []);

    useEffect(() => {
        loadOwedRefunds();
    }, [loadOwedRefunds]);

    useEffect(() => {
        fetchEarlyReturnCredits(earlyReturnQuery);
    }, [fetchEarlyReturnCredits, earlyReturnQuery]);

    useEffect(() => {
        setSearch("");
    }, [activeFinancialTab]);

    const summary = useMemo(() => {
        let collected = 0;
        let pending = 0;

        payments.forEach((payment) => {
            const amount = Number(payment?.amount) || 0;

            /* A fully refunded payment was still collected; the refund is
               subtracted below, so dropping it here too would count it twice. */
            if (
                payment?.status === "VERIFIED" ||
                payment?.status === "REFUNDED"
            ) {
                collected += amount;
            }

            if (payment?.status === "PENDING") {
                pending += amount;
            }
        });

        /*
         * Refund totals come from the server's own aggregate (refundsSummary),
         * not by reducing the `refunds` array — that array is capped by the
         * "Load more" pagination below, so summing it directly would silently
         * understate these once there are more refunds than one page holds.
         * Rental refunds plus refunds on bookings cancelled before pickup
         * (those live on the payment, not in the Refunds tab).
         */
        const refunded =
            Number(refundsSummary?.approvedTotal || 0) +
            Number(refundsSummary?.bookingRefundedTotal || 0);

        const pendingRefunds = Number(
            refundsSummary?.pendingCount || 0
        );

        return {
            collected,
            pending,
            refunded,
            pendingRefunds,
            net: collected - refunded,
        };
    }, [payments, refundsSummary]);

    const paymentStatusCounts = useMemo(() => {
        const counts = {
            All: payments.length,
            PENDING: 0,
            VERIFIED: 0,
            REFUNDED: 0,
            CANCELLED: 0,
        };

        payments.forEach((payment) => {
            if (
                Object.prototype.hasOwnProperty.call(
                    counts,
                    payment?.status
                )
            ) {
                counts[payment.status] += 1;
            }
        });

        return counts;
    }, [payments]);

    /* Same reasoning as `summary` above: these tab badges must reflect
       every matching refund, not just the currently-loaded page. */
    const refundStatusCounts = useMemo(() => {
        const pendingCount = Number(
            refundsSummary?.pendingCount || 0
        );
        const approvedCount = Number(
            refundsSummary?.approvedCount || 0
        );
        const rejectedCount = Number(
            refundsSummary?.rejectedCount || 0
        );

        // Not pagination.total: that one is narrowed by the status filter.
        return {
            All: pendingCount + approvedCount + rejectedCount,
            Pending: pendingCount,
            Approved: approvedCount,
            Rejected: rejectedCount,
        };
    }, [refundsSummary]);

    const earlyReturnStatusCounts = useMemo(() => {
        const pendingCount = Number(
            earlyReturnSummary?.pendingCount || 0
        );
        const approvedCount = Number(
            earlyReturnSummary?.approvedCount || 0
        );
        const rejectedCount = Number(
            earlyReturnSummary?.rejectedCount || 0
        );

        return {
            All: pendingCount + approvedCount + rejectedCount,
            Pending: pendingCount,
            Approved: approvedCount,
            Rejected: rejectedCount,
        };
    }, [earlyReturnSummary]);

    const filteredPayments = useMemo(() => {
        const query = search.trim().toLowerCase();

        return payments.filter((payment) => {
            if (
                activePaymentStatus !== "All" &&
                payment?.status !== activePaymentStatus
            ) {
                return false;
            }

            if (
                paymentMethod !== "All" &&
                payment?.paymentMethod !== paymentMethod
            ) {
                return false;
            }

            if (
                paymentType !== "All" &&
                payment?.paymentType !== paymentType
            ) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                payment?.referenceNumber,
                getBookingCode(payment?.booking),
                getCustomerName(payment?.customer),
                payment?.paymentMethod,
                payment?.paymentType,
                payment?.rental?.rentalCode,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [
        payments,
        activePaymentStatus,
        paymentMethod,
        paymentType,
        search,
    ]);

    const filteredRefunds = useMemo(() => {
        const query = search.trim().toLowerCase();

        return refunds.filter((refund) => {
            if (
                activeRefundStatus !== "All" &&
                titleCase(refund?.status) !== activeRefundStatus
            ) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                refund?.rentalCode,
                getCustomerName(refund?.customer),
                refund?.reason,
                refund?.description,
                String(refund?.amount ?? ""),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [refunds, activeRefundStatus, search]);

    const filteredOwedRefunds = useMemo(() => {
        const query = search.trim().toLowerCase();

        return owedRefunds.items.filter((refund) => {
            if (
                activeOwedStatus !== "All" &&
                refund?.status !== activeOwedStatus
            ) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                refund?.booking?.bookingCode,
                getCustomerName(refund?.customer),
                refund?.customer?.phoneNumber,
                refund?.reason,
                String(refund?.amount ?? ""),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [owedRefunds.items, activeOwedStatus, search]);

    const filteredEarlyReturns = useMemo(() => {
        const query = search.trim().toLowerCase();

        return earlyReturnCredits.filter((credit) => {
            if (
                activeEarlyReturnStatus !== "All" &&
                titleCase(credit?.earlyReturn?.status) !==
                    activeEarlyReturnStatus
            ) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                credit?.rentalCode,
                getCustomerName(credit?.customer),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(query);
        });
    }, [
        earlyReturnCredits,
        activeEarlyReturnStatus,
        search,
    ]);

    /* ---- action gates ---- */
    const canVerifyCash = (payment) =>
        payment?.status === "PENDING" &&
        payment?.paymentMethod === "CASH_ON_PICKUP";

    const canReconcile = (payment) =>
        payment?.status === "PENDING" &&
        payment?.paymentMethod === "GCASH" &&
        Boolean(payment?.paymongo?.checkoutSessionId);

    const canForceVerify = canReconcile;

    const isRefundActionable = (refund) =>
        (refund?.status || "").toLowerCase() === "pending";

    const isEarlyReturnActionable = (credit) =>
        (credit?.earlyReturn?.status || "").toLowerCase() ===
        "pending";

    /*
     * `Payment.refund` gateway-refund actions — separate from the Rental
     * refund-request workflow above. "pending"/"processing" refunds can be
     * re-checked against PayMongo; any non-final refund can also be closed
     * out manually once settled outside the app.
     */
    const canReconcilePaymentRefund = (payment) =>
        ["pending", "processing"].includes(
            payment?.refund?.status
        );

    /*
     * A refund waiting on an admin (held over the auto-approve threshold, or
     * an earlier automatic attempt failed) can be released through PayMongo
     * in one click — but only when the payment actually has a gateway charge.
     * Cash on Pickup has none and can only be settled outside the app.
     */
    const canSendPaymentRefund = (payment) =>
        payment?.refund?.status === "requires_manual_action" &&
        Boolean(payment?.paymongo?.chargeId);

    const canResolvePaymentRefundManually = (payment) =>
        [
            "requires_manual_action",
            "pending",
            "processing",
        ].includes(payment?.refund?.status);

    const settled = (result) =>
        result?.meta?.requestStatus === "fulfilled";

    const failMessage = (result, fallback) =>
        typeof result?.payload === "string"
            ? result.payload
            : fallback;

    /* ---- payment actions ---- */
    const runVerify = async (payment, force) => {
        setActionId(payment._id);

        try {
            const result = await verifyExistingPayment(
                payment._id,
                force
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to verify payment."
                    )
                );
            }

            toast.success(
                `Payment of ${peso(payment.amount)} verified.`,
                "Payment verified"
            );
        } catch (error) {
            toast.error(
                error.message || "Unable to verify payment.",
                "Verification failed"
            );
        } finally {
            setActionId(null);
        }
    };

    const handleVerifyCash = (payment) => {
        setConfirmState({
            title: "Verify Cash Payment",
            message: `Verify this Cash on Pickup payment of ${peso(
                payment.amount
            )}?`,
            confirmText: "Verify",
            confirmVariant: "success",
            onConfirm: () => runVerify(payment, false),
        });
    };

    const handleForceVerify = (payment) => {
        setConfirmState({
            title: "Force Verify Payment",
            message: `Force verify this PayMongo payment of ${peso(
                payment.amount
            )}? This marks the payment as paid WITHOUT checking PayMongo. Try "Confirm with PayMongo" first — only force verify if that fails and you have separately confirmed the payment succeeded.`,
            confirmText: "Force Verify",
            confirmVariant: "danger",
            onConfirm: () => runVerify(payment, true),
        });
    };

    const handleReconcile = async (payment) => {
        setActionId(payment._id);

        try {
            const result = await reconcilePayment(
                payment._id
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to reconcile payment."
                    )
                );
            }

            const data = result.payload?.data;

            if (
                data?.payment?.status === "VERIFIED"
            ) {
                toast.success(
                    `Payment of ${peso(
                        payment.amount
                    )} confirmed with PayMongo.`,
                    "Payment verified"
                );
            } else {
                toast.warning(
                    "PayMongo reports this payment is not completed yet.",
                    "Not paid"
                );
            }

            fetchPayments();
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to reconcile payment.",
                "Reconcile failed"
            );
        } finally {
            setActionId(null);
        }
    };

    /* ---- Payment.refund (gateway refund) actions ---- */
    const handleReconcilePaymentRefund = async (payment) => {
        setActionId(payment._id);

        try {
            const result = await reconcileRefund(
                payment._id
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to reconcile refund."
                    )
                );
            }

            const updatedPayment = result.payload?.data;

            toast.success(
                "Refund status reconciled with PayMongo.",
                "Refund reconciled"
            );

            if (updatedPayment) {
                setDetailPayment((current) =>
                    current?._id === updatedPayment._id
                        ? updatedPayment
                        : current
                );
            }

            fetchPayments();
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to reconcile refund.",
                "Reconcile failed"
            );
        } finally {
            setActionId(null);
        }
    };

    const runSendPaymentRefund = async (payment) => {
        setActionId(payment._id);

        try {
            const result = await sendRefund(payment._id);

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to send the refund."
                    )
                );
            }

            const updatedPayment = result.payload?.data;

            toast.success(
                updatedPayment?.refund?.status === "succeeded"
                    ? "Refund sent and confirmed by PayMongo."
                    : "Refund submitted to PayMongo. It will show as completed once PayMongo confirms it.",
                "Refund sent"
            );

            if (updatedPayment) {
                setDetailPayment((current) =>
                    current?._id === updatedPayment._id
                        ? updatedPayment
                        : current
                );
            }
        } catch (error) {
            toast.error(
                error.message || "Unable to send the refund.",
                "Refund not sent"
            );
        } finally {
            // Refresh either way: a rejected attempt is recorded on the
            // payment (with PayMongo's reason), so the list should show it.
            fetchPayments();
            setActionId(null);
        }
    };

    const handleSendPaymentRefund = (payment) => {
        setConfirmState({
            title: "Send Refund via PayMongo",
            message: `Send this refund of ${peso(
                payment?.refund?.amount
            )} to the customer through PayMongo now? PayMongo will return it to the payment method they used. This can't be undone.`,
            confirmText: "Send Refund",
            confirmVariant: "success",
            onConfirm: () => runSendPaymentRefund(payment),
        });
    };

    const openManualRefundModal = (payment) =>
        setManualRefundModal({
            payment,
            notes: "",
            submitting: false,
        });

    const closeManualRefundModal = () =>
        setManualRefundModal(null);

    const submitManualRefund = async (succeeded) => {
        if (!manualRefundModal?.payment?._id) {
            return;
        }

        setManualRefundModal((current) =>
            current
                ? { ...current, submitting: true }
                : current
        );

        try {
            const result = await completeRefund(
                manualRefundModal.payment._id,
                {
                    succeeded,
                    notes: manualRefundModal.notes.trim(),
                }
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to update the refund."
                    )
                );
            }

            const updatedPayment = result.payload?.data;

            toast.success(
                succeeded
                    ? "Refund marked as completed."
                    : "Refund marked as failed.",
                "Refund updated"
            );

            if (updatedPayment) {
                setDetailPayment((current) =>
                    current?._id === updatedPayment._id
                        ? updatedPayment
                        : current
                );
            }

            fetchPayments();
            closeManualRefundModal();
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to update the refund.",
                "Failed"
            );

            setManualRefundModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    /* ---- confirm a rental refund that was paid outside the app ---- */
    const openSettleModal = (refund) =>
        setSettleModal({
            refund,
            notes: "",
            submitting: false,
        });

    const closeSettleModal = () => setSettleModal(null);

    const submitSettle = async (succeeded) => {
        const refund = settleModal?.refund;

        if (!refund?.rentalId || !refund?._id) {
            return;
        }

        const notes = settleModal.notes.trim();

        setSettleModal((current) =>
            current
                ? { ...current, submitting: true }
                : current
        );

        try {
            const result = await settleExistingRefund(
                refund.rentalId,
                refund._id,
                { succeeded, notes }
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to update the refund."
                    )
                );
            }

            toast.success(
                succeeded
                    ? "Refund marked as settled."
                    : "Refund marked as not completed.",
                "Refund updated"
            );

            setDetailRefund((current) =>
                current?._id === refund._id
                    ? {
                          ...current,
                          gatewayStatus: succeeded
                              ? "succeeded"
                              : "failed",
                          settlementNote: notes,
                          settledAt: new Date().toISOString(),
                      }
                    : current
            );

            closeSettleModal();
            fetchRefunds(refundQuery);
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to update the refund.",
                "Failed"
            );

            setSettleModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    /* ---- refund actions ---- */
    const handleApproveRefund = (refund) => {
        if (!refund?.rentalId || !refund?._id) {
            return;
        }

        setApproveModal({
            refund,
            mode: "full",
            percentage: "100",
            amount: String(refund.amount),
            submitting: false,
        });
    };

    const closeApproveModal = () => {
        if (approveModal?.submitting) {
            return;
        }

        setApproveModal(null);
    };

    /*
     * What would actually be sent if the admin confirms right now — kept as
     * a plain function (not derived state) so both the live preview in the
     * modal and the submit handler always agree on the same number.
     */
    const getApproveComputedAmount = () => {
        if (!approveModal) {
            return 0;
        }

        const requested = Number(approveModal.refund.amount);

        if (approveModal.mode === "full") {
            return requested;
        }

        if (approveModal.mode === "partial") {
            const percentage = Number(approveModal.percentage);

            if (!Number.isFinite(percentage) || percentage <= 0) {
                return 0;
            }

            return Math.round(requested * percentage) / 100;
        }

        const custom = Number(approveModal.amount);

        return Number.isFinite(custom) ? custom : 0;
    };

    const confirmApproveRefund = async () => {
        if (!approveModal?.refund) {
            return;
        }

        const requested = Number(approveModal.refund.amount);

        if (approveModal.mode === "partial") {
            const percentage = Number(approveModal.percentage);

            if (
                !Number.isFinite(percentage) ||
                percentage <= 0 ||
                percentage > 100
            ) {
                toast.error(
                    "Enter a percentage between 1 and 100.",
                    "Invalid percentage"
                );

                return;
            }
        }

        const computedAmount = getApproveComputedAmount();

        if (approveModal.mode === "custom") {
            if (
                !Number.isFinite(computedAmount) ||
                computedAmount <= 0
            ) {
                toast.error(
                    "Enter a valid refund amount.",
                    "Invalid amount"
                );

                return;
            }

            if (computedAmount > requested) {
                toast.error(
                    `Amount cannot exceed the requested amount of ${peso(
                        requested
                    )}.`,
                    "Invalid amount"
                );

                return;
            }
        }

        setApproveModal((current) =>
            current
                ? { ...current, submitting: true }
                : current
        );

        try {
            const result = await approveExistingRefund(
                approveModal.refund.rentalId,
                approveModal.refund._id,
                approveModal.mode === "full"
                    ? undefined
                    : computedAmount
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to approve refund."
                    )
                );
            }

            toast.success(
                `Refund of ${peso(computedAmount)} approved.`,
                "Refund approved"
            );

            setApproveModal(null);
            fetchRefunds(refundQuery);
        } catch (error) {
            toast.error(
                error.message || "Unable to approve refund.",
                "Approval failed"
            );

            setApproveModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    /* ---- reject refund request (with reason) ---- */
    const openRejectRefund = (refund) =>
        setReasonModal({
            target: refund,
            reason: "",
            submitting: false,
        });

    const closeReason = () => setReasonModal(null);

    const submitReason = async () => {
        if (!reasonModal) {
            return;
        }

        const reason = reasonModal.reason.trim();

        if (!reason) {
            toast.error(
                "Please provide a reason.",
                "Reason required"
            );

            return;
        }

        setReasonModal((current) =>
            current ? { ...current, submitting: true } : current
        );

        try {
            const refund = reasonModal.target;

            const result = await rejectExistingRefund(
                refund.rentalId,
                refund._id,
                reason
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to reject refund."
                    )
                );
            }

            toast.success(
                "Refund request rejected.",
                "Refund rejected"
            );

            fetchRefunds(refundQuery);

            closeReason();
        } catch (error) {
            toast.error(
                error.message || "Action failed.",
                "Failed"
            );

            setReasonModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    /* ---- early-return credit actions ---- */
    const handleApproveEarlyReturn = (credit) => {
        if (!credit?.rentalId) {
            return;
        }

        setEarlyReturnApproveModal({
            credit,
            unusedDays: String(
                credit.earlyReturn?.unusedFullDays ?? 0
            ),
            submitting: false,
        });
    };

    const closeEarlyReturnApproveModal = () => {
        if (earlyReturnApproveModal?.submitting) {
            return;
        }

        setEarlyReturnApproveModal(null);
    };

    const getEarlyReturnComputedAmount = () => {
        if (!earlyReturnApproveModal) {
            return 0;
        }

        const days = Number(
            earlyReturnApproveModal.unusedDays
        );
        const dailyRate = Number(
            earlyReturnApproveModal.credit.earlyReturn
                ?.dailyRate ?? 0
        );

        if (!Number.isFinite(days) || days <= 0) {
            return 0;
        }

        return Math.round(days * dailyRate * 100) / 100;
    };

    const confirmApproveEarlyReturn = async () => {
        if (!earlyReturnApproveModal?.credit) {
            return;
        }

        const maxDays = Number(
            earlyReturnApproveModal.credit.earlyReturn
                ?.unusedFullDays ?? 0
        );
        const days = Number(
            earlyReturnApproveModal.unusedDays
        );

        if (!Number.isFinite(days) || days <= 0) {
            toast.error(
                "Enter a valid number of days.",
                "Invalid days"
            );

            return;
        }

        if (days > maxDays) {
            toast.error(
                `Days cannot exceed the computed ${maxDays} unused day(s).`,
                "Invalid days"
            );

            return;
        }

        setEarlyReturnApproveModal((current) =>
            current
                ? { ...current, submitting: true }
                : current
        );

        try {
            const result = await approveEarlyReturn(
                earlyReturnApproveModal.credit.rentalId,
                days
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to approve early-return credit."
                    )
                );
            }

            toast.success(
                `Early-return credit of ${peso(
                    getEarlyReturnComputedAmount()
                )} approved. A voucher was issued to the customer.`,
                "Credit approved"
            );

            setEarlyReturnApproveModal(null);
            fetchEarlyReturnCredits(earlyReturnQuery);
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to approve early-return credit.",
                "Approval failed"
            );

            setEarlyReturnApproveModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    const openRejectEarlyReturn = (credit) =>
        setEarlyReturnReasonModal({
            target: credit,
            reason: "",
            submitting: false,
        });

    const closeEarlyReturnReason = () =>
        setEarlyReturnReasonModal(null);

    const submitEarlyReturnReason = async () => {
        if (!earlyReturnReasonModal) {
            return;
        }

        const reason = earlyReturnReasonModal.reason.trim();

        if (!reason) {
            toast.error(
                "Please provide a reason.",
                "Reason required"
            );

            return;
        }

        setEarlyReturnReasonModal((current) =>
            current ? { ...current, submitting: true } : current
        );

        try {
            const credit = earlyReturnReasonModal.target;

            const result = await rejectEarlyReturn(
                credit.rentalId,
                reason
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to reject early-return credit."
                    )
                );
            }

            toast.success(
                "Early-return credit rejected.",
                "Credit rejected"
            );

            fetchEarlyReturnCredits(earlyReturnQuery);

            closeEarlyReturnReason();
        } catch (error) {
            toast.error(
                error.message || "Action failed.",
                "Failed"
            );

            setEarlyReturnReasonModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    /* ---- record a manual refund ---- */
    const openRecordModal = async () => {
        setRecordModal({
            rentalId: "",
            amount: "",
            reason: "",
            description: "",
            submitting: false,
            rentals: [],
            rentalsLoading: true,
        });

        try {
            const response = await getRentals(true);
            const rows = response?.data ?? response ?? [];

            setRecordModal((current) =>
                current
                    ? {
                          ...current,
                          rentalsLoading: false,
                          rentals: rows.map((rental) => ({
                              value: rental._id,
                              label: `${
                                  rental.rentalCode || "Rental"
                              } · ${getCustomerName(
                                  rental.customer
                              )}`,
                          })),
                      }
                    : current
            );
        } catch {
            setRecordModal((current) =>
                current
                    ? { ...current, rentalsLoading: false }
                    : current
            );
            toast.error(
                "Unable to load rentals.",
                "Load failed"
            );
        }
    };

    const closeRecordModal = () => setRecordModal(null);

    const submitRecordRefund = async () => {
        if (!recordModal) {
            return;
        }

        const amount = Number(recordModal.amount);

        if (!recordModal.rentalId) {
            toast.error("Select a rental.", "Rental required");
            return;
        }

        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error(
                "Enter a valid refund amount.",
                "Invalid amount"
            );
            return;
        }

        if (!recordModal.reason) {
            toast.error("Select a reason.", "Reason required");
            return;
        }

        setRecordModal((current) =>
            current ? { ...current, submitting: true } : current
        );

        try {
            await recordBookingRefund(recordModal.rentalId, {
                amount,
                reason: recordModal.reason,
                description: recordModal.description.trim(),
            });

            toast.success(
                `Refund of ${peso(amount)} recorded.`,
                "Refund recorded"
            );

            closeRecordModal();
            fetchRefunds(refundQuery);
        } catch (error) {
            toast.error(
                error.response?.data?.message ||
                    "Unable to record refund.",
                "Failed"
            );

            setRecordModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    /* From a refund's details, open the online payment it's tracked on (the
       place its manual settlement happens). Falls back to searching the
       Payments tab by booking code if that payment isn't loaded. */
    const openRefundPayment = (refund) => {
        const paymentId = String(refund?.gatewayPayment ?? "");
        const payment = payments.find(
            (item) => String(item._id) === paymentId
        );

        setDetailRefund(null);
        setActiveFinancialTab("payments");

        if (payment) {
            setDetailPayment(payment);
        } else {
            const code = getBookingCode(refund?.booking);
            setSearch(code && code !== "—" ? code : "");
        }
    };

    const kpis = [
        {
            label: "Collected",
            value: peso(summary.collected),
            hint: "Payments received, before refunds",
            icon: Wallet,
            tone: "emerald",
        },
        {
            label: "Awaiting verification",
            value: peso(summary.pending),
            hint: "Pending payments",
            icon: Clock3,
            tone: "amber",
        },
        {
            label: "Refunded",
            value: peso(summary.refunded),
            hint: `${summary.pendingRefunds} awaiting review`,
            icon: Undo2,
            tone: "rose",
        },
        {
            label: "Net revenue",
            value: peso(summary.net),
            hint: "Collected − refunded",
            icon: TrendingUp,
            tone: "blue",
        },
    ];

    const isPayments = activeFinancialTab === "payments";

    const sectionOptions = FINANCIAL_TABS.map((tab) => ({
        value: tab.key,
        label: tab.label,
        count:
            tab.key === "payments"
                ? payments.length
                : tab.key === "refunds"
                  ? refundStatusCounts.All
                  : tab.key === "owed-refunds"
                    ? // Only the ones still waiting on an admin.
                      owedRefunds.counts.Owed ?? 0
                    : earlyReturnStatusCounts.All,
    }));

    /* The centred controls (search → section → status) swap their search
       copy, filters and status chips to match the active section. */
    const sectionControls = isPayments
        ? {
              placeholder: "Search payments by reference, booking, customer...",
              filters: [
                  {
                      value: paymentMethod,
                      onChange: setPaymentMethod,
                      options: PAYMENT_METHOD_OPTIONS,
                      label: "Filter by payment method",
                  },
                  {
                      value: paymentType,
                      onChange: setPaymentType,
                      options: PAYMENT_TYPE_OPTIONS,
                      label: "Filter by payment type",
                  },
              ],
              statusTabs: PAYMENT_STATUS_TABS,
              statusCounts: paymentStatusCounts,
              status: activePaymentStatus,
              onStatusChange: setActivePaymentStatus,
          }
        : activeFinancialTab === "refunds"
          ? {
                placeholder: "Search refunds by rental, customer, reason...",
                filters: [],
                statusTabs: REFUND_STATUS_TABS,
                statusCounts: refundStatusCounts,
                status: activeRefundStatus,
                onStatusChange: changeRefundStatus,
            }
          : activeFinancialTab === "owed-refunds"
            ? {
                  placeholder: "Search owed refunds by booking, customer...",
                  filters: [],
                  statusTabs: OWED_REFUND_STATUS_TABS,
                  statusCounts: {
                      ...owedRefunds.counts,
                      All: owedRefunds.items.length,
                  },
                  status: activeOwedStatus,
                  onStatusChange: setActiveOwedStatus,
              }
          : {
                placeholder: "Search early returns by rental, customer...",
                filters: [],
                statusTabs: EARLY_RETURN_STATUS_TABS,
                statusCounts: earlyReturnStatusCounts,
                status: activeEarlyReturnStatus,
                onStatusChange: changeEarlyReturnStatus,
            };

    return (
        <div className="mx-auto w-full max-w-[1600px]">
            {/* Controls, centred and stepping down in size: search (+
                filters) → Payments/Refunds/Early Returns → status. */}
            <div className="mb-7 flex flex-col items-center gap-3">
                <div className="flex w-full max-w-3xl items-center gap-2">
                    <PillSearch
                        value={search}
                        onChange={setSearch}
                        placeholder={sectionControls.placeholder}
                        label="Search"
                        filters={sectionControls.filters}
                        className="min-w-0 flex-1"
                    />

                    {/* Payments, refunds and partner payouts in one workbook. */}
                    <ExportExcelPill onClick={() => setExportOpen(true)} />
                </div>

                <PillTabs
                    label="Financial sections"
                    size="lg"
                    layoutId="financial-tab-pill"
                    value={activeFinancialTab}
                    onChange={setActiveFinancialTab}
                    options={sectionOptions}
                    countTone="muted"
                />

                <PillTabs
                    label="Status"
                    size="xs"
                    layoutId={`financial-status-pill-${activeFinancialTab}`}
                    value={sectionControls.status}
                    onChange={sectionControls.onStatusChange}
                    options={sectionControls.statusTabs.map((tab) => ({
                        value: tab.key,
                        label: tab.label,
                        count: sectionControls.statusCounts[tab.key] ?? 0,
                    }))}
                    countTone="muted"
                />
            </div>

            {/* KPIs */}
            <motion.div
                initial="hidden"
                animate="show"
                variants={{
                    hidden: {},
                    show: {
                        transition: { staggerChildren: 0.05 },
                    },
                }}
                className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
                {kpis.map((kpi) => (
                    <motion.div
                        key={kpi.label}
                        variants={{
                            hidden: { opacity: 0, y: 12 },
                            show: { opacity: 1, y: 0 },
                        }}
                    >
                        <KpiCard {...kpi} />
                    </motion.div>
                ))}
            </motion.div>

            {isPayments ? (
                <motion.div
                    key="payments"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    {paymentsError && (
                        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                            {typeof paymentsError === "string"
                                ? paymentsError
                                : "Unable to load payments."}
                        </div>
                    )}

                    <div className={cardClass}>
                        <div className="overflow-x-auto">
                            <StackedTable className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                <thead className="bg-gray-50 dark:bg-gray-800/60">
                                    <tr>
                                        <th className={thClass}>
                                            Payment
                                        </th>
                                        <th className={thClass}>
                                            Booking
                                        </th>
                                        <th className={thClass}>
                                            Customer
                                        </th>
                                        <th className={thClass}>
                                            Method
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Amount
                                        </th>
                                        <th
                                            className={`${thClass} text-center`}
                                        >
                                            Status
                                        </th>
                                        <th className={thClass}>
                                            Date
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                    {paymentsLoading &&
                                        filteredPayments.length ===
                                            0 &&
                                        Array.from({
                                            length: 5,
                                        }).map((_, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {Array.from({
                                                    length: 8,
                                                }).map(
                                                    (
                                                        __,
                                                        cellIndex
                                                    ) => (
                                                        <td
                                                            key={
                                                                cellIndex
                                                            }
                                                            className="px-5 py-4"
                                                        >
                                                            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                                                        </td>
                                                    )
                                                )}
                                            </tr>
                                        ))}

                                    {!paymentsLoading &&
                                        filteredPayments.length ===
                                            0 && (
                                            <tr>
                                                <td
                                                    colSpan={8}
                                                    className="px-5 py-14 text-center text-sm text-gray-500 dark:text-gray-400"
                                                >
                                                    No payments match
                                                    the current
                                                    filters.
                                                </td>
                                            </tr>
                                        )}

                                    {filteredPayments.map(
                                        (payment) => {
                                            const busy =
                                                actionId ===
                                                payment._id;

                                            return (
                                                <tr
                                                    key={payment._id}
                                                    className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                >
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            {payment.referenceNumber ||
                                                                titleCase(
                                                                    payment.paymentMethod
                                                                ) ||
                                                                "—"}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                            {titleCase(
                                                                payment.paymentType
                                                            ) ||
                                                                "Payment"}
                                                        </p>
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        {getBookingCode(
                                                            payment.booking
                                                        )}
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        {getCustomerName(
                                                            payment.customer
                                                        )}
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {titleCase(
                                                                payment.paymentMethod
                                                            ) ||
                                                                "—"}
                                                            {Boolean(
                                                                payment
                                                                    ?.paymongo
                                                                    ?.checkoutSessionId
                                                            ) && (
                                                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                                                    PayMongo
                                                                </span>
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right font-bold text-gray-900 dark:text-white`}
                                                    >
                                                        {peso(
                                                            payment.amount
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-center`}
                                                    >
                                                        <StatusChip
                                                            status={
                                                                payment.status
                                                            }
                                                            size="sm"
                                                        />

                                                        {(() => {
                                                            const refundBadge =
                                                                getPaymentRefundBadge(
                                                                    payment
                                                                );

                                                            return refundBadge ? (
                                                                <span
                                                                    className={`mt-1 block text-[10px] font-semibold ${refundBadge.className}`}
                                                                >
                                                                    {
                                                                        refundBadge.text
                                                                    }
                                                                </span>
                                                            ) : null;
                                                        })()}
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        {formatDate(
                                                            payment.createdAt
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right`}
                                                    >
                                                        <div className="flex items-center justify-end gap-2">
                                                            <IconButton
                                                                label="View details"
                                                                onClick={() =>
                                                                    setDetailPayment(
                                                                        payment
                                                                    )
                                                                }
                                                            >
                                                                <Eye
                                                                    size={
                                                                        15
                                                                    }
                                                                />
                                                            </IconButton>

                                                            {(payment.booking?._id ||
                                                                payment.booking) && (
                                                                <IconButton
                                                                    label="Booking statement & receipts (new tab)"
                                                                    onClick={() =>
                                                                        window.open(
                                                                            `/documents/statements/${
                                                                                payment.booking?._id ||
                                                                                payment.booking
                                                                            }`,
                                                                            "_blank",
                                                                            "noopener"
                                                                        )
                                                                    }
                                                                >
                                                                    <ReceiptText
                                                                        size={
                                                                            15
                                                                        }
                                                                    />
                                                                </IconButton>
                                                            )}

                                                            {canVerifyCash(
                                                                payment
                                                            ) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="success"
                                                                    loading={
                                                                        busy
                                                                    }
                                                                    leftIcon={
                                                                        <CheckCircle2
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                    onClick={() =>
                                                                        handleVerifyCash(
                                                                            payment
                                                                        )
                                                                    }
                                                                >
                                                                    Verify
                                                                </Button>
                                                            )}

                                                            {canReconcile(
                                                                payment
                                                            ) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="success"
                                                                    loading={
                                                                        busy
                                                                    }
                                                                    leftIcon={
                                                                        <RefreshCw
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                    onClick={() =>
                                                                        handleReconcile(
                                                                            payment
                                                                        )
                                                                    }
                                                                >
                                                                    Confirm with PayMongo
                                                                </Button>
                                                            )}

                                                            {canForceVerify(
                                                                payment
                                                            ) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="brand"
                                                                    loading={
                                                                        busy
                                                                    }
                                                                    leftIcon={
                                                                        <ShieldCheck
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                    onClick={() =>
                                                                        handleForceVerify(
                                                                            payment
                                                                        )
                                                                    }
                                                                >
                                                                    Force verify
                                                                </Button>
                                                            )}

                                                            {/* The refund actions live in the details modal. */}
                                                            {canResolvePaymentRefundManually(
                                                                payment
                                                            ) && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    leftIcon={
                                                                        <Undo2
                                                                            size={
                                                                                14
                                                                            }
                                                                        />
                                                                    }
                                                                    onClick={() =>
                                                                        setDetailPayment(
                                                                            payment
                                                                        )
                                                                    }
                                                                >
                                                                    Review refund
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </StackedTable>
                        </div>
                    </div>
                </motion.div>
            ) : activeFinancialTab === "refunds" ? (
                <motion.div
                    key="refunds"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <div className="mb-4 flex justify-end">
                        <Button
                            size="sm"
                            leftIcon={<Plus size={15} />}
                            onClick={openRecordModal}
                            className="rounded-full!"
                        >
                            Record refund
                        </Button>
                    </div>

                    {refundsError && (
                        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                            {typeof refundsError === "string"
                                ? refundsError
                                : "Unable to load refunds."}
                        </div>
                    )}

                    <div className={cardClass}>
                        <div className="overflow-x-auto">
                            <StackedTable className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                <thead className="bg-gray-50 dark:bg-gray-800/60">
                                    <tr>
                                        <th className={thClass}>
                                            Rental
                                        </th>
                                        <th className={thClass}>
                                            Customer
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Amount
                                        </th>
                                        <th className={thClass}>
                                            Reason
                                        </th>
                                        <th
                                            className={`${thClass} text-center`}
                                        >
                                            Status
                                        </th>
                                        <th className={thClass}>
                                            Date
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                    {refundsLoading &&
                                        filteredRefunds.length ===
                                            0 &&
                                        Array.from({
                                            length: 5,
                                        }).map((_, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {Array.from({
                                                    length: 7,
                                                }).map(
                                                    (
                                                        __,
                                                        cellIndex
                                                    ) => (
                                                        <td
                                                            key={
                                                                cellIndex
                                                            }
                                                            className="px-5 py-4"
                                                        >
                                                            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                                                        </td>
                                                    )
                                                )}
                                            </tr>
                                        ))}

                                    {!refundsLoading &&
                                        filteredRefunds.length ===
                                            0 && (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="px-5 py-14 text-center text-sm text-gray-500 dark:text-gray-400"
                                                >
                                                    No refund records
                                                    found.
                                                </td>
                                            </tr>
                                        )}

                                    {filteredRefunds.map(
                                        (refund) => {
                                            return (
                                                <tr
                                                    key={refund._id}
                                                    className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                >
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            {refund.rentalCode ||
                                                                "—"}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                            {getBookingCode(
                                                                refund.booking
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {getCustomerName(
                                                                refund.customer
                                                            )}
                                                        </p>
                                                        {refund
                                                            .customer
                                                            ?.email && (
                                                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                                {
                                                                    refund
                                                                        .customer
                                                                        .email
                                                                }
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right font-bold text-gray-900 dark:text-white`}
                                                    >
                                                        {peso(
                                                            refund.amount
                                                        )}
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <span
                                                            title={
                                                                refund.reason ||
                                                                undefined
                                                            }
                                                            className="inline-block max-w-55 truncate rounded-full align-middle bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                            {refund.reason ||
                                                                "—"}
                                                        </span>
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-center`}
                                                    >
                                                        <StatusChip
                                                            status={
                                                                titleCase(
                                                                    refund.status
                                                                ) ||
                                                                "Pending"
                                                            }
                                                            size="sm"
                                                        />

                                                        {/* Approved, but the money still has to be paid out by hand. */}
                                                        {refund.gatewayStatus ===
                                                            "requires_manual_action" && (
                                                            <span className="mt-1 block text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                                                Needs manual
                                                                payout
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        {formatDate(
                                                            refund.createdAt
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right`}
                                                    >
                                                        <div className="flex items-center justify-end gap-2">
                                                            <IconButton
                                                                label="View details"
                                                                onClick={() =>
                                                                    setDetailRefund(
                                                                        refund
                                                                    )
                                                                }
                                                            >
                                                                <Eye
                                                                    size={
                                                                        15
                                                                    }
                                                                />
                                                            </IconButton>

                                                            {isRefundActionable(
                                                                refund
                                                            ) && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="success"
                                                                        leftIcon={
                                                                            <CheckCircle2
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        }
                                                                        onClick={() =>
                                                                            handleApproveRefund(
                                                                                refund
                                                                            )
                                                                        }
                                                                    >
                                                                        Approve
                                                                    </Button>

                                                                    <Button
                                                                        size="sm"
                                                                        variant="danger"
                                                                        leftIcon={
                                                                            <XCircle
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        }
                                                                        onClick={() =>
                                                                            openRejectRefund(
                                                                                refund
                                                                            )
                                                                        }
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </StackedTable>
                        </div>
                    </div>

                    {refundPagination?.total > refunds.length && (
                        <div className="mt-4 flex flex-col items-center gap-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Showing {refunds.length} of{" "}
                                {refundPagination.total}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                loading={refundsLoading}
                                onClick={() =>
                                    setRefundLimit(
                                        (current) =>
                                            current +
                                            REFUND_PAGE_SIZE
                                    )
                                }
                            >
                                Load more
                            </Button>
                        </div>
                    )}
                </motion.div>
            ) : activeFinancialTab === "owed-refunds" ? (
                <motion.div
                    key="owed-refunds"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <OwedRefundsPanel
                        refunds={filteredOwedRefunds}
                        loading={owedRefunds.loading}
                        error={owedRefunds.error}
                        onSettled={loadOwedRefunds}
                    />
                </motion.div>
            ) : (
                <motion.div
                    key="early-returns"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">
                        A rental lands here when it's returned before its
                        scheduled end date. Inspect the vehicle before
                        approving — approving issues the customer a
                        single-use voucher for the credited days.
                    </p>

                    {earlyReturnsError && (
                        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                            {typeof earlyReturnsError === "string"
                                ? earlyReturnsError
                                : "Unable to load early-return credits."}
                        </div>
                    )}

                    <div className={cardClass}>
                        <div className="overflow-x-auto">
                            <StackedTable className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                <thead className="bg-gray-50 dark:bg-gray-800/60">
                                    <tr>
                                        <th className={thClass}>
                                            Rental
                                        </th>
                                        <th className={thClass}>
                                            Customer
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Unused Days
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Credit
                                        </th>
                                        <th
                                            className={`${thClass} text-center`}
                                        >
                                            Status
                                        </th>
                                        <th className={thClass}>
                                            Returned
                                        </th>
                                        <th
                                            className={`${thClass} text-right`}
                                        >
                                            Actions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                    {earlyReturnsLoading &&
                                        filteredEarlyReturns.length ===
                                            0 &&
                                        Array.from({
                                            length: 5,
                                        }).map((_, rowIndex) => (
                                            <tr key={rowIndex}>
                                                {Array.from({
                                                    length: 7,
                                                }).map(
                                                    (
                                                        __,
                                                        cellIndex
                                                    ) => (
                                                        <td
                                                            key={
                                                                cellIndex
                                                            }
                                                            className="px-5 py-4"
                                                        >
                                                            <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                                                        </td>
                                                    )
                                                )}
                                            </tr>
                                        ))}

                                    {!earlyReturnsLoading &&
                                        filteredEarlyReturns.length ===
                                            0 && (
                                            <tr>
                                                <td
                                                    colSpan={7}
                                                    className="px-5 py-14 text-center text-sm text-gray-500 dark:text-gray-400"
                                                >
                                                    No early returns
                                                    found.
                                                </td>
                                            </tr>
                                        )}

                                    {filteredEarlyReturns.map(
                                        (credit) => {
                                            const earlyReturn =
                                                credit.earlyReturn ||
                                                {};
                                            const displayDays =
                                                earlyReturn.status ===
                                                "Approved"
                                                    ? earlyReturn.approvedUnusedDays
                                                    : earlyReturn.unusedFullDays;
                                            const displayAmount =
                                                earlyReturn.status ===
                                                "Approved"
                                                    ? earlyReturn.approvedCreditAmount
                                                    : earlyReturn.creditAmount;

                                            return (
                                                <tr
                                                    key={
                                                        credit.rentalId
                                                    }
                                                    className="transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                                >
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <p className="font-semibold text-gray-900 dark:text-white">
                                                            {credit.rentalCode ||
                                                                "—"}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                            {getBookingCode(
                                                                credit.booking
                                                            )}
                                                        </p>
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        <p className="font-medium text-gray-900 dark:text-white">
                                                            {getCustomerName(
                                                                credit.customer
                                                            )}
                                                        </p>
                                                        {credit
                                                            .customer
                                                            ?.email && (
                                                            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                                {
                                                                    credit
                                                                        .customer
                                                                        .email
                                                                }
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right`}
                                                    >
                                                        {displayDays ??
                                                            0}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right font-bold text-gray-900 dark:text-white`}
                                                    >
                                                        {peso(
                                                            displayAmount
                                                        )}
                                                        {/* Whose credit rules applied (locked terms). */}
                                                        {earlyReturn.policySource && (
                                                            <p className="mt-0.5 text-[11px] font-normal text-gray-500 dark:text-gray-400">
                                                                {earlyReturn.policySource ===
                                                                "booking"
                                                                    ? `Booking terms v${earlyReturn.termsVersion ?? "?"}`
                                                                    : "Today's policy (kinder)"}
                                                            </p>
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-center`}
                                                    >
                                                        <StatusChip
                                                            status={
                                                                titleCase(
                                                                    earlyReturn.status
                                                                ) ||
                                                                "Pending"
                                                            }
                                                            size="sm"
                                                        />
                                                    </td>
                                                    <td
                                                        className={
                                                            tdClass
                                                        }
                                                    >
                                                        {formatDate(
                                                            earlyReturn.actualReturnAt
                                                        )}
                                                    </td>
                                                    <td
                                                        className={`${tdClass} text-right`}
                                                    >
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isEarlyReturnActionable(
                                                                credit
                                                            ) ? (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="success"
                                                                        leftIcon={
                                                                            <CheckCircle2
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        }
                                                                        onClick={() =>
                                                                            handleApproveEarlyReturn(
                                                                                credit
                                                                            )
                                                                        }
                                                                    >
                                                                        Approve
                                                                    </Button>

                                                                    <Button
                                                                        size="sm"
                                                                        variant="danger"
                                                                        leftIcon={
                                                                            <XCircle
                                                                                size={
                                                                                    14
                                                                                }
                                                                            />
                                                                        }
                                                                        onClick={() =>
                                                                            openRejectEarlyReturn(
                                                                                credit
                                                                            )
                                                                        }
                                                                    >
                                                                        Reject
                                                                    </Button>
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">
                                                                    No
                                                                    actions
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </StackedTable>
                        </div>
                    </div>

                    {earlyReturnPagination?.total >
                        earlyReturnCredits.length && (
                        <div className="mt-4 flex flex-col items-center gap-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                Showing {earlyReturnCredits.length}{" "}
                                of {earlyReturnPagination.total}
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                loading={earlyReturnsLoading}
                                onClick={() =>
                                    setEarlyReturnLimit(
                                        (current) =>
                                            current +
                                            EARLY_RETURN_PAGE_SIZE
                                    )
                                }
                            >
                                Load more
                            </Button>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Payment detail modal */}
            <Modal
                isOpen={Boolean(detailPayment)}
                onClose={() => setDetailPayment(null)}
                title="Payment details"
                size="lg"
            >
                {detailPayment && (
                    <div className="space-y-1">
                        <DetailRow label="Reference">
                            {detailPayment.referenceNumber ||
                                "—"}
                        </DetailRow>
                        <DetailRow label="Type">
                            {titleCase(
                                detailPayment.paymentType
                            ) || "—"}
                        </DetailRow>
                        <DetailRow label="Method">
                            {titleCase(
                                detailPayment.paymentMethod
                            ) || "—"}
                        </DetailRow>
                        <DetailRow label="Amount">
                            {peso(detailPayment.amount)}
                        </DetailRow>
                        <DetailRow label="Status">
                            <StatusChip
                                status={detailPayment.status}
                                size="sm"
                            />
                        </DetailRow>
                        <DetailRow label="Booking">
                            {getBookingCode(
                                detailPayment.booking
                            )}
                        </DetailRow>
                        <DetailRow label="Rental">
                            {detailPayment.rental?.rentalCode ||
                                "—"}
                        </DetailRow>
                        <DetailRow label="Customer">
                            {getCustomerName(
                                detailPayment.customer
                            )}
                        </DetailRow>
                        {detailPayment.customer?.email && (
                            <DetailRow label="Email">
                                {detailPayment.customer.email}
                            </DetailRow>
                        )}
                        {detailPayment.customer?.phoneNumber && (
                            <DetailRow label="Phone">
                                {
                                    detailPayment.customer
                                        .phoneNumber
                                }
                            </DetailRow>
                        )}
                        {detailPayment.paymongo
                            ?.checkoutSessionId && (
                            <DetailRow label="PayMongo session">
                                <span className="break-all font-mono text-xs">
                                    {
                                        detailPayment.paymongo
                                            .checkoutSessionId
                                    }
                                </span>
                            </DetailRow>
                        )}
                        {detailPayment.verification
                            ?.verifiedAt && (
                            <DetailRow label="Verified">
                                {formatDateTime(
                                    detailPayment.verification
                                        .verifiedAt
                                )}
                                {detailPayment.verification
                                    .verifiedBy &&
                                    ` · ${getCustomerName(
                                        detailPayment.verification
                                            .verifiedBy
                                    )}`}
                            </DetailRow>
                        )}
                        <DetailRow label="Created">
                            {formatDateTime(
                                detailPayment.createdAt
                            )}
                        </DetailRow>

                        {detailPayment.refund && (
                            <div className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    Refund
                                </h4>

                                <DetailRow label="Amount">
                                    {peso(
                                        detailPayment.refund
                                            .amount
                                    )}
                                </DetailRow>
                                <DetailRow label="Status">
                                    <StatusChip
                                        status={
                                            detailPayment.refund
                                                .status
                                        }
                                        size="sm"
                                    />
                                </DetailRow>
                                <DetailRow label="Method">
                                    {detailPayment.refund
                                        .method === "automatic"
                                        ? "Automatic (PayMongo)"
                                        : "Manual"}
                                </DetailRow>
                                <DetailRow label="Reason">
                                    {titleCase(
                                        detailPayment.refund
                                            .reason
                                    ) || "—"}
                                </DetailRow>
                                {detailPayment.refund
                                    .initiatedAt && (
                                    <DetailRow label="Initiated">
                                        {formatDateTime(
                                            detailPayment.refund
                                                .initiatedAt
                                        )}
                                    </DetailRow>
                                )}
                                {detailPayment.refund
                                    .completedAt && (
                                    <DetailRow label="Completed">
                                        {formatDateTime(
                                            detailPayment.refund
                                                .completedAt
                                        )}
                                    </DetailRow>
                                )}
                                {detailPayment.refund
                                    .failureReason && (
                                    <DetailRow label="Failure reason">
                                        {
                                            detailPayment.refund
                                                .failureReason
                                        }
                                    </DetailRow>
                                )}

                                {(canReconcilePaymentRefund(
                                    detailPayment
                                ) ||
                                    canSendPaymentRefund(
                                        detailPayment
                                    ) ||
                                    canResolvePaymentRefundManually(
                                        detailPayment
                                    )) && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {canSendPaymentRefund(
                                            detailPayment
                                        ) && (
                                            <Button
                                                size="sm"
                                                variant="success"
                                                loading={
                                                    actionId ===
                                                    detailPayment._id
                                                }
                                                leftIcon={
                                                    <Send
                                                        size={14}
                                                    />
                                                }
                                                onClick={() =>
                                                    handleSendPaymentRefund(
                                                        detailPayment
                                                    )
                                                }
                                            >
                                                Send via PayMongo
                                            </Button>
                                        )}

                                        {canReconcilePaymentRefund(
                                            detailPayment
                                        ) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                loading={
                                                    actionId ===
                                                    detailPayment._id
                                                }
                                                leftIcon={
                                                    <RefreshCw
                                                        size={14}
                                                    />
                                                }
                                                onClick={() =>
                                                    handleReconcilePaymentRefund(
                                                        detailPayment
                                                    )
                                                }
                                            >
                                                Check with PayMongo
                                            </Button>
                                        )}

                                        {canResolvePaymentRefundManually(
                                            detailPayment
                                        ) && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                leftIcon={
                                                    <Undo2
                                                        size={14}
                                                    />
                                                }
                                                onClick={() =>
                                                    openManualRefundModal(
                                                        detailPayment
                                                    )
                                                }
                                            >
                                                Resolve Manually
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* Refund detail modal */}
            <Modal
                isOpen={Boolean(detailRefund)}
                onClose={() => setDetailRefund(null)}
                title="Refund details"
                size="md"
            >
                {detailRefund && (
                    <div className="space-y-1">
                        <DetailRow label="Rental">
                            {detailRefund.rentalCode || "—"}
                        </DetailRow>
                        <DetailRow label="Booking">
                            {getBookingCode(detailRefund.booking)}
                        </DetailRow>
                        <DetailRow label="Customer">
                            {getCustomerName(
                                detailRefund.customer
                            )}
                        </DetailRow>
                        {detailRefund.customer?.email && (
                            <DetailRow label="Email">
                                {detailRefund.customer.email}
                            </DetailRow>
                        )}
                        <DetailRow label="Amount">
                            {peso(detailRefund.amount)}
                        </DetailRow>
                        <DetailRow label="Reason">
                            {detailRefund.reason || "—"}
                        </DetailRow>
                        {detailRefund.description && (
                            <DetailRow label="Notes">
                                {detailRefund.description}
                            </DetailRow>
                        )}
                        <DetailRow label="Status">
                            <StatusChip
                                status={
                                    titleCase(
                                        detailRefund.status
                                    ) || "Pending"
                                }
                                size="sm"
                            />
                        </DetailRow>
                        <DetailRow label="Requested">
                            {formatDateTime(
                                detailRefund.createdAt
                            )}
                        </DetailRow>
                        {detailRefund.processedAt && (
                            <DetailRow label="Processed">
                                {formatDateTime(
                                    detailRefund.processedAt
                                )}
                            </DetailRow>
                        )}
                        {detailRefund.gatewayStatus &&
                            detailRefund.gatewayStatus !==
                                "not_applicable" && (
                                <DetailRow label="Payout">
                                    {detailRefund.gatewayStatus ===
                                    "requires_manual_action" ? (
                                        <div className="space-y-2">
                                            {/* One place to settle: a refund tracked on the
                                                booking's online payment is settled from that
                                                payment ("Resolve Manually"), so it isn't also
                                                offered here — the two paths settled the same money. */}
                                            <span className="block text-amber-600 dark:text-amber-400">
                                                {detailRefund.gatewayPayment
                                                    ? "Requires manual settlement — this refund is tracked on the booking's online payment, so it's settled from that payment."
                                                    : "Requires manual settlement — pay the customer outside the app, then mark it settled here."}
                                            </span>

                                            {detailRefund.gatewayPayment ? (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    leftIcon={
                                                        <Eye size={14} />
                                                    }
                                                    onClick={() =>
                                                        openRefundPayment(
                                                            detailRefund
                                                        )
                                                    }
                                                >
                                                    Open payment
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="success"
                                                    leftIcon={
                                                        <CheckCircle2
                                                            size={14}
                                                        />
                                                    }
                                                    onClick={() =>
                                                        openSettleModal(
                                                            detailRefund
                                                        )
                                                    }
                                                >
                                                    Mark as settled
                                                </Button>
                                            )}
                                        </div>
                                    ) : detailRefund.gatewayStatus ===
                                      "succeeded" ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                            Refund sent to the
                                            customer
                                            {detailRefund.settlementNote
                                                ? ` — ${detailRefund.settlementNote}`
                                                : ""}
                                        </span>
                                    ) : detailRefund.gatewayStatus ===
                                      "failed" ? (
                                        <span className="text-red-600 dark:text-red-400">
                                            The refund could not be
                                            completed
                                            {detailRefund.settlementNote
                                                ? ` — ${detailRefund.settlementNote}`
                                                : " — see the Payments tab."}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 dark:text-gray-400">
                                            Pending with PayMongo
                                        </span>
                                    )}
                                </DetailRow>
                            )}
                    </div>
                )}
            </Modal>

            {/* Reject reason modal */}
            <Modal
                isOpen={Boolean(reasonModal)}
                onClose={() => {
                    if (!reasonModal?.submitting) {
                        closeReason();
                    }
                }}
                title="Reject refund request"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeReason}
                            disabled={reasonModal?.submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={reasonModal?.submitting}
                            onClick={submitReason}
                        >
                            Confirm rejection
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                    This will decline the refund request. Provide a
                    clear reason for the customer.
                </p>
                <Textarea
                    label="Reason"
                    required
                    rows={4}
                    value={reasonModal?.reason ?? ""}
                    onChange={(event) =>
                        setReasonModal((current) =>
                            current
                                ? {
                                      ...current,
                                      reason: event.target.value,
                                  }
                                : current
                        )
                    }
                    placeholder="Explain why this is being rejected..."
                />
            </Modal>

            {/* Reject early-return credit modal */}
            <Modal
                isOpen={Boolean(earlyReturnReasonModal)}
                onClose={() => {
                    if (!earlyReturnReasonModal?.submitting) {
                        closeEarlyReturnReason();
                    }
                }}
                title="Reject early-return credit"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeEarlyReturnReason}
                            disabled={
                                earlyReturnReasonModal?.submitting
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={
                                earlyReturnReasonModal?.submitting
                            }
                            onClick={submitEarlyReturnReason}
                        >
                            Confirm rejection
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                    No voucher will be issued. Provide a clear reason
                    for the customer.
                </p>
                <Textarea
                    label="Reason"
                    required
                    rows={4}
                    value={earlyReturnReasonModal?.reason ?? ""}
                    onChange={(event) =>
                        setEarlyReturnReasonModal((current) =>
                            current
                                ? {
                                      ...current,
                                      reason: event.target.value,
                                  }
                                : current
                        )
                    }
                    placeholder="Explain why this credit isn't being approved..."
                />
            </Modal>

            {/* Confirm a rental refund that was paid outside the app */}
            <Modal
                isOpen={Boolean(settleModal)}
                onClose={() => {
                    if (!settleModal?.submitting) {
                        closeSettleModal();
                    }
                }}
                title="Mark refund as settled"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeSettleModal}
                            disabled={settleModal?.submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={settleModal?.submitting}
                            onClick={() => submitSettle(false)}
                        >
                            Not completed
                        </Button>
                        <Button
                            variant="success"
                            loading={settleModal?.submitting}
                            onClick={() => submitSettle(true)}
                        >
                            Mark as settled
                        </Button>
                    </>
                }
            >
                {settleModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            This refund of{" "}
                            {peso(settleModal.refund?.amount)} could
                            not be sent through PayMongo. Pay the
                            customer outside the app first, then
                            record the outcome here — the customer is
                            notified either way.
                        </p>
                        <Textarea
                            label="Notes"
                            rows={3}
                            value={settleModal.notes ?? ""}
                            onChange={(event) =>
                                setSettleModal((current) =>
                                    current
                                        ? {
                                              ...current,
                                              notes: event.target
                                                  .value,
                                          }
                                        : current
                                )
                            }
                            placeholder="Optional — e.g. GCash reference number..."
                        />
                    </div>
                )}
            </Modal>

            {/* Resolve a payment's gateway refund manually */}
            <Modal
                isOpen={Boolean(manualRefundModal)}
                onClose={() => {
                    if (!manualRefundModal?.submitting) {
                        closeManualRefundModal();
                    }
                }}
                title="Resolve refund manually"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeManualRefundModal}
                            disabled={
                                manualRefundModal?.submitting
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={
                                manualRefundModal?.submitting
                            }
                            onClick={() =>
                                submitManualRefund(false)
                            }
                        >
                            Mark as failed
                        </Button>
                        <Button
                            variant="success"
                            loading={
                                manualRefundModal?.submitting
                            }
                            onClick={() =>
                                submitManualRefund(true)
                            }
                        >
                            Mark as completed
                        </Button>
                    </>
                }
            >
                {manualRefundModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            This refund of{" "}
                            {peso(
                                manualRefundModal.payment
                                    ?.refund?.amount
                            )}{" "}
                            is waiting on you — it has no PayMongo
                            charge to refund automatically, was
                            held for review, or an automatic
                            attempt failed or is stuck. Settle it
                            outside the app first, then record
                            the outcome here. (If the payment has
                            a PayMongo charge, &ldquo;Send via
                            PayMongo&rdquo; releases it without
                            leaving the app.)
                        </p>
                        <Textarea
                            label="Notes"
                            rows={3}
                            value={
                                manualRefundModal.notes ?? ""
                            }
                            onChange={(event) =>
                                setManualRefundModal(
                                    (current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  notes: event
                                                      .target
                                                      .value,
                                              }
                                            : current
                                )
                            }
                            placeholder="Optional — e.g. reference number for the manual refund..."
                        />
                    </div>
                )}
            </Modal>

            {/* Record manual refund modal */}
            <Modal
                isOpen={Boolean(recordModal)}
                onClose={() => {
                    if (!recordModal?.submitting) {
                        closeRecordModal();
                    }
                }}
                title="Record a refund"
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeRecordModal}
                            disabled={recordModal?.submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            loading={recordModal?.submitting}
                            onClick={submitRecordRefund}
                        >
                            Record refund
                        </Button>
                    </>
                }
            >
                {recordModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Log a refund against a rental. The
                            amount is validated against the
                            remaining refundable balance.
                        </p>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Rental
                                <span className="ml-1 text-red-500">
                                    *
                                </span>
                            </label>
                            <Select
                                options={recordModal.rentals}
                                value={recordModal.rentalId}
                                placeholder={
                                    recordModal.rentalsLoading
                                        ? "Loading rentals..."
                                        : "Select a rental"
                                }
                                onChange={(event) =>
                                    setRecordModal((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  rentalId:
                                                      event.target
                                                          .value,
                                              }
                                            : current
                                    )
                                }
                            />
                        </div>

                        <Input
                            type="number"
                            label="Amount"
                            required
                            min="0"
                            step="0.01"
                            value={recordModal.amount}
                            onChange={(event) =>
                                setRecordModal((current) =>
                                    current
                                        ? {
                                              ...current,
                                              amount: event.target
                                                  .value,
                                          }
                                        : current
                                )
                            }
                            placeholder="0.00"
                        />

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Reason
                                <span className="ml-1 text-red-500">
                                    *
                                </span>
                            </label>
                            <Select
                                options={REFUND_REASON_OPTIONS}
                                value={recordModal.reason}
                                placeholder="Select a reason"
                                onChange={(event) =>
                                    setRecordModal((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  reason: event
                                                      .target
                                                      .value,
                                              }
                                            : current
                                    )
                                }
                            />
                        </div>

                        <Textarea
                            label="Description"
                            rows={3}
                            value={recordModal.description}
                            onChange={(event) =>
                                setRecordModal((current) =>
                                    current
                                        ? {
                                              ...current,
                                              description:
                                                  event.target
                                                      .value,
                                          }
                                        : current
                                )
                            }
                            placeholder="Optional notes for this refund..."
                        />
                    </div>
                )}
            </Modal>

            {/* Approve refund modal — full, partial (%), or a custom amount */}
            <Modal
                isOpen={Boolean(approveModal)}
                onClose={closeApproveModal}
                title="Approve Refund"
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeApproveModal}
                            disabled={approveModal?.submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="success"
                            loading={approveModal?.submitting}
                            onClick={confirmApproveRefund}
                        >
                            Approve Refund
                        </Button>
                    </>
                }
            >
                {approveModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {getCustomerName(
                                approveModal.refund.customer
                            )}{" "}
                            requested a refund of{" "}
                            <strong>
                                {peso(
                                    approveModal.refund.amount
                                )}
                            </strong>{" "}
                            for rental{" "}
                            {approveModal.refund.rentalCode ||
                                "—"}
                            .
                        </p>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                Approval type
                            </label>

                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    {
                                        value: "full",
                                        label: "Full",
                                    },
                                    {
                                        value: "partial",
                                        label: "Partial %",
                                    },
                                    {
                                        value: "custom",
                                        label: "Custom",
                                    },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        disabled={
                                            approveModal.submitting
                                        }
                                        onClick={() =>
                                            setApproveModal(
                                                (current) =>
                                                    current
                                                        ? {
                                                              ...current,
                                                              mode: option.value,
                                                          }
                                                        : current
                                            )
                                        }
                                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                            approveModal.mode ===
                                            option.value
                                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-300"
                                                : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {approveModal.mode === "partial" && (
                            <Input
                                type="number"
                                label="Percentage of requested amount (%)"
                                min="1"
                                max="100"
                                step="1"
                                value={approveModal.percentage}
                                onChange={(event) =>
                                    setApproveModal((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  percentage:
                                                      event.target
                                                          .value,
                                              }
                                            : current
                                    )
                                }
                                placeholder="e.g. 50"
                            />
                        )}

                        {approveModal.mode === "custom" && (
                            <Input
                                type="number"
                                label="Refund amount (₱)"
                                min="0.01"
                                max={
                                    approveModal.refund.amount
                                }
                                step="0.01"
                                value={approveModal.amount}
                                onChange={(event) =>
                                    setApproveModal((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  amount:
                                                      event.target
                                                          .value,
                                              }
                                            : current
                                    )
                                }
                                placeholder="0.00"
                                helperText={`Up to ${peso(
                                    approveModal.refund.amount
                                )}`}
                            />
                        )}

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
                            <span className="text-gray-500 dark:text-gray-400">
                                Amount to approve:{" "}
                            </span>
                            <strong className="text-gray-900 dark:text-white">
                                {peso(
                                    getApproveComputedAmount()
                                )}
                            </strong>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Approve early-return credit modal */}
            <Modal
                isOpen={Boolean(earlyReturnApproveModal)}
                onClose={closeEarlyReturnApproveModal}
                title="Approve early-return credit"
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeEarlyReturnApproveModal}
                            disabled={
                                earlyReturnApproveModal?.submitting
                            }
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="success"
                            loading={
                                earlyReturnApproveModal?.submitting
                            }
                            onClick={confirmApproveEarlyReturn}
                        >
                            Approve &amp; Issue Voucher
                        </Button>
                    </>
                }
            >
                {earlyReturnApproveModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            {getCustomerName(
                                earlyReturnApproveModal.credit
                                    .customer
                            )}{" "}
                            returned rental{" "}
                            {earlyReturnApproveModal.credit
                                .rentalCode || "—"}{" "}
                            with{" "}
                            <strong>
                                {
                                    earlyReturnApproveModal.credit
                                        .earlyReturn
                                        ?.unusedFullDays
                                }
                            </strong>{" "}
                            unused day(s) at{" "}
                            {peso(
                                earlyReturnApproveModal.credit
                                    .earlyReturn?.dailyRate
                            )}
                            /day. Confirm you've inspected the
                            vehicle before approving.
                        </p>

                        <Input
                            type="number"
                            label="Days to credit"
                            min="1"
                            max={
                                earlyReturnApproveModal.credit
                                    .earlyReturn?.unusedFullDays
                            }
                            step="1"
                            value={
                                earlyReturnApproveModal.unusedDays
                            }
                            onChange={(event) =>
                                setEarlyReturnApproveModal(
                                    (current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  unusedDays:
                                                      event.target
                                                          .value,
                                              }
                                            : current
                                )
                            }
                            helperText={`Computed maximum: ${
                                earlyReturnApproveModal.credit
                                    .earlyReturn
                                    ?.unusedFullDays
                            } day(s). Reduce this if the inspection warrants it — it can't be increased.`}
                        />

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
                            <span className="text-gray-500 dark:text-gray-400">
                                Voucher amount:{" "}
                            </span>
                            <strong className="text-gray-900 dark:text-white">
                                {peso(
                                    getEarlyReturnComputedAmount()
                                )}
                            </strong>
                        </div>
                    </div>
                )}
            </Modal>

            <FinancialExportDialog
                open={exportOpen}
                onClose={() => setExportOpen(false)}
            />

            <ConfirmDialog
                isOpen={Boolean(confirmState)}
                onClose={() => {
                    if (!confirmBusy) {
                        setConfirmState(null);
                    }
                }}
                onConfirm={runConfirm}
                title={confirmState?.title}
                message={confirmState?.message}
                confirmText={
                    confirmState?.confirmText ?? "Confirm"
                }
                confirmVariant={
                    confirmState?.confirmVariant ?? "danger"
                }
                loading={confirmBusy}
            />
        </div>
    );
};

export default Financials;
