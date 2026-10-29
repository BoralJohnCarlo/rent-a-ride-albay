import { useState, useEffect } from "react";
import { usePayouts } from "../../../hooks/payouts/usePayouts.js";
import useWallet from "../../../hooks/wallets/useWallet";
import useWithdrawal from "../../../hooks/withdrawals/useWithdrawal";
import useToast from "../../../hooks/toast/useToast";
import PayoutRequestCard from "../../../components/payouts/PayoutRequestCard";
import Modal from "../../../components/common/Modal";
import Input from "../../../components/common/Input";
import Button from "../../../components/common/Button";
import StatusChip from "../../../components/common/StatusChip";
import {
    Wallet,
    TrendingUp,
    CheckCircle,
    Banknote,
    Loader2,
    AlertCircle,
    ArrowDownCircle,
    ArrowUpCircle,
    Send,
    Smartphone,
    User,
} from "lucide-react";

const formatPeso = (value) =>
    `₱${(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const formatWalletDate = (value) => {
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

const Earnings = () => {
    const {
        payoutRequests,
        loading,
        error,
        summary,
        settings,
        loadPayoutRequestsByOperator,
        loadOperatorPayoutSummary,
        loadPayoutSettings,
    } = usePayouts();

    const {
        wallet,
        transactions: walletTransactions,
        loading: walletLoading,
        fetchMyWallet,
    } = useWallet();

    const {
        withdrawals,
        submitWithdrawal,
        fetchMyWithdrawals,
    } = useWithdrawal();

    const toast = useToast();

    const [statusFilter, setStatusFilter] = useState("");

    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [withdrawSubmitting, setWithdrawSubmitting] =
        useState(false);
    const [withdrawError, setWithdrawError] = useState("");
    const [withdrawForm, setWithdrawForm] = useState({
        amount: "",
        gcashNumber: "",
        accountName: "",
    });

    useEffect(() => {
        loadPayoutRequestsByOperator({ status: statusFilter });
        loadOperatorPayoutSummary();
        loadPayoutSettings();
    }, [
        loadPayoutRequestsByOperator,
        loadOperatorPayoutSummary,
        loadPayoutSettings,
        statusFilter,
    ]);

    useEffect(() => {
        fetchMyWallet({}).catch(() => {});
        fetchMyWithdrawals({}).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshWallet = () => {
        fetchMyWallet({}).catch(() => {});
        fetchMyWithdrawals({}).catch(() => {});
    };

    const openWithdraw = () => {
        setWithdrawForm({
            amount: "",
            gcashNumber: "",
            accountName: "",
        });
        setWithdrawError("");
        setWithdrawOpen(true);
    };

    const handleSubmitWithdraw = async () => {
        const amount = Number(withdrawForm.amount);

        if (!Number.isFinite(amount) || amount <= 0) {
            setWithdrawError(
                "Enter a valid withdrawal amount."
            );
            return;
        }

        if (
            !withdrawForm.gcashNumber.trim() ||
            !withdrawForm.accountName.trim()
        ) {
            setWithdrawError(
                "GCash number and account name are required."
            );
            return;
        }

        if (amount > (wallet?.balance ?? 0)) {
            setWithdrawError(
                "Amount exceeds your wallet balance."
            );
            return;
        }

        setWithdrawSubmitting(true);

        try {
            const result = await submitWithdrawal({
                amount,
                gcashNumber: withdrawForm.gcashNumber.trim(),
                accountName: withdrawForm.accountName.trim(),
            });

            setWithdrawOpen(false);
            refreshWallet();

            if (result?.data?.status === "FAILED") {
                toast.error(
                    result.data.failureReason ||
                        "The withdrawal failed and was refunded to your wallet.",
                    "Withdrawal Failed"
                );
            } else {
                toast.success(
                    "Your withdrawal is being processed.",
                    "Withdrawal Submitted"
                );
            }
        } catch (error) {
            setWithdrawError(
                error?.message ||
                    "Unable to submit withdrawal request."
            );
        } finally {
            setWithdrawSubmitting(false);
        }
    };

    /*
     * Only Scheduled, Paid, and Cancelled ever actually occur here — a
     * payout is auto-created straight into Scheduled by
     * scheduleOperatorPayout() and either releases to Paid via the cron job
     * or gets Cancelled by admin. Pending/Approved/Rejected belong to the
     * manual request-and-approve flow, which has no entry point in the
     * operator UI (createPayoutRequest is never called from the client), so
     * those filters would always come back empty.
     */
    const statusFilters = [
        { value: "", label: "All" },
        { value: "SCHEDULED", label: "Scheduled" },
        { value: "PAID", label: "Paid" },
        { value: "CANCELLED", label: "Cancelled" },
    ];

    const walletBalance = Number(wallet?.balance ?? 0);

    const quickAmounts = [
        { label: "25%", value: Math.floor(walletBalance * 0.25) },
        { label: "50%", value: Math.floor(walletBalance * 0.5) },
        { label: "Max", value: walletBalance },
    ];

    const withdrawAmountNumber = Number(withdrawForm.amount) || 0;

    if (loading && payoutRequests.length === 0) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    My Earnings
                </h2>
            </div>

            {/* Wallet */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Wallet Balance
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {walletLoading && !wallet
                                    ? "—"
                                    : `${(wallet?.balance ?? 0).toFixed(2)} ${wallet?.currency || "PHP"}`}
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={openWithdraw}
                        disabled={!wallet?.balance}
                        leftIcon={<Send className="h-4 w-4" />}
                    >
                        Withdraw to GCash
                    </Button>
                </div>

                {walletTransactions.length > 0 && (
                    <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Recent Activity
                        </p>

                        {walletTransactions.slice(0, 5).map((entry) => (
                            <div
                                key={entry._id}
                                className="flex items-center justify-between gap-3 text-sm"
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    {entry.type === "CREDIT" ? (
                                        <ArrowDownCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                                    ) : (
                                        <ArrowUpCircle className="h-4 w-4 shrink-0 text-rose-500" />
                                    )}
                                    <span className="truncate text-gray-600 dark:text-gray-300">
                                        {entry.description ||
                                            (entry.type === "CREDIT"
                                                ? "Wallet credit"
                                                : "Wallet debit")}
                                    </span>
                                </div>

                                <div className="shrink-0 text-right">
                                    <p
                                        className={
                                            entry.type === "CREDIT"
                                                ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                                : "font-semibold text-rose-600 dark:text-rose-400"
                                        }
                                    >
                                        {entry.type === "CREDIT" ? "+" : "-"}
                                        {Number(entry.amount).toFixed(2)}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {formatWalletDate(entry.createdAt)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Withdrawal History */}
            {withdrawals.length > 0 && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Withdrawal History
                    </h3>

                    <div className="mt-4 space-y-3">
                        {withdrawals.map((item) => (
                            <div
                                key={item._id}
                                className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {item.withdrawalCode} · GCash{" "}
                                        {item.gcashNumber}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        {formatWalletDate(item.createdAt)}
                                        {item.status === "FAILED" &&
                                            item.failureReason &&
                                            ` · ${item.failureReason}`}
                                    </p>
                                </div>

                                <div className="flex shrink-0 items-center gap-3">
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                        {Number(item.amount).toFixed(2)}{" "}
                                        {item.currency || "PHP"}
                                    </span>
                                    <StatusChip
                                        status={item.status}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Earnings Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Wallet className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Earned</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {summary?.totalEarned?.toFixed(2) || "0.00"} {settings?.payoutCurrency || "PHP"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            <CheckCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Total Paid</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {summary?.totalPaid?.toFixed(2) || "0.00"} {settings?.payoutCurrency || "PHP"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                            <TrendingUp className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Scheduled</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {summary?.totalScheduled?.toFixed(2) || "0.00"} {settings?.payoutCurrency || "PHP"}
                            </p>
                            <p className="text-xs text-gray-400">
                                Held before release to wallet
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Commission Info */}
            <div className="rounded-xl border border-gray-200 bg-blue-50 p-4 dark:border-gray-700 dark:bg-blue-900/20">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                        <p className="font-medium text-blue-900 dark:text-blue-200">
                            Commission Structure
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            {`Platform Commission: ${settings?.platformCommissionRate ?? 10}% — you receive the remaining ${100 - (settings?.platformCommissionRate ?? 10)}% of each booking, unless one of your vehicles was given its own individually-negotiated rate when it was approved.`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Payout History */}
            <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Payout History
                    </h3>
                    {/* Phones: the filters get their own row and scroll sideways. */}
                    <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 sm:mx-0 sm:px-0">
                        {statusFilters.map((filter) => (
                            <button
                                key={filter.value}
                                onClick={() => setStatusFilter(filter.value)}
                                className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                                    statusFilter === filter.value
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400"
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg bg-rose-50 p-4 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400">
                        {error}
                    </div>
                )}

                {payoutRequests?.length === 0 ? (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900">
                        <Banknote className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-4 text-gray-500 dark:text-gray-400">
                            No payout requests yet
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            Complete rentals to start earning
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {payoutRequests.map((payout) => (
                            <PayoutRequestCard
                                key={payout._id}
                                payout={payout}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Modal
                isOpen={withdrawOpen}
                onClose={
                    withdrawSubmitting
                        ? undefined
                        : () => setWithdrawOpen(false)
                }
                title="Withdraw to GCash"
                size="md"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setWithdrawOpen(false)}
                            disabled={withdrawSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            loading={withdrawSubmitting}
                            onClick={handleSubmitWithdraw}
                            leftIcon={
                                <Send className="h-4 w-4" />
                            }
                        >
                            {withdrawAmountNumber > 0
                                ? `Withdraw ${formatPeso(
                                      withdrawAmountNumber
                                  )}`
                                : "Withdraw"}
                        </Button>
                    </>
                }
            >
                <div className="space-y-5">
                    {/* Balance */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-5 text-white shadow-lg shadow-indigo-900/30">
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl"
                        />
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-white/10 blur-2xl"
                        />

                        <div className="relative flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-100/80">
                                    Available balance
                                </p>
                                <p className="mt-1 truncate text-3xl font-black tracking-tight">
                                    {formatPeso(walletBalance)}
                                </p>
                            </div>
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                                <Wallet className="h-5 w-5" />
                            </span>
                        </div>
                    </div>

                    {/* Amount */}
                    <div>
                        <label
                            htmlFor="withdraw-amount"
                            className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                        >
                            Amount to withdraw
                        </label>

                        <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400 dark:text-gray-500">
                                ₱
                            </span>
                            <input
                                id="withdraw-amount"
                                type="number"
                                required
                                min="100"
                                step="0.01"
                                value={withdrawForm.amount}
                                onChange={(event) =>
                                    setWithdrawForm(
                                        (current) => ({
                                            ...current,
                                            amount: event
                                                .target
                                                .value,
                                        })
                                    )
                                }
                                placeholder="0.00"
                                className="w-full rounded-2xl border-2 border-gray-200 bg-gray-50 py-4 pl-10 pr-4 text-2xl font-bold text-gray-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:border-indigo-400"
                            />
                        </div>

                        <div className="mt-2.5 flex gap-2">
                            {quickAmounts.map((option) => (
                                <button
                                    key={option.label}
                                    type="button"
                                    disabled={
                                        option.value < 100
                                    }
                                    onClick={() =>
                                        setWithdrawForm(
                                            (current) => ({
                                                ...current,
                                                amount: String(
                                                    option.label ===
                                                        "Max"
                                                        ? option.value.toFixed(
                                                              2
                                                          )
                                                        : option.value
                                                ),
                                            })
                                        )
                                    }
                                    className="flex-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            Minimum withdrawal is ₱100.00.
                        </p>
                    </div>

                    {/* Destination */}
                    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4 dark:border-gray-800 dark:bg-gray-800/30">
                        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            <Smartphone size={13} />
                            Send to GCash
                        </p>

                        <div className="space-y-3">
                            <Input
                                label="GCash Number"
                                required
                                leftIcon={
                                    <Smartphone size={16} />
                                }
                                value={
                                    withdrawForm.gcashNumber
                                }
                                onChange={(event) =>
                                    setWithdrawForm(
                                        (current) => ({
                                            ...current,
                                            gcashNumber:
                                                event.target
                                                    .value,
                                        })
                                    )
                                }
                                placeholder="09XXXXXXXXX"
                            />

                            <Input
                                label="Account Name"
                                required
                                leftIcon={<User size={16} />}
                                value={
                                    withdrawForm.accountName
                                }
                                onChange={(event) =>
                                    setWithdrawForm(
                                        (current) => ({
                                            ...current,
                                            accountName:
                                                event.target
                                                    .value,
                                        })
                                    )
                                }
                                placeholder="Name on the GCash account"
                            />
                        </div>
                    </div>

                    {withdrawError && (
                        <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                            <AlertCircle
                                size={16}
                                className="mt-0.5 shrink-0"
                            />
                            <span>{withdrawError}</span>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

export default Earnings;