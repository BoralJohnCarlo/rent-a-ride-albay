import {
    CheckCircle2,
    Loader2,
    RotateCcw,
    XCircle,
} from "lucide-react";

import {
    useEffect,
    useRef,
    useState,
} from "react";
import {
    Link,
    useLocation,
    useNavigate,
    useParams,
} from "react-router-dom";

import Button from "../../components/common/Button";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import usePayment from "../../hooks/payments/usePayment";
import { reportPaymentFailure } from "../../api/paymentApi";

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

// A booking in one of these states can no longer accept a payment.
const CLOSED_BOOKING_STATUSES = [
    "Cancelled",
    "Rejected",
    "Expired",
    "No Show",
];

const PaymentResult = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const routeParams = useParams();

    const failureReportedRef = useRef(false);

    const {
        selectedPayment,
        loading,
        fetchPaymentById,
        reconcilePayment,
        clearSelected,
    } = usePayment();

    const [pollExhausted, setPollExhausted] =
        useState(false);

    const [pollError, setPollError] =
        useState(false);

    const queryParams = new URLSearchParams(
        location.search
    );

    const paymentId =
        queryParams.get("paymentId");

    // PayMongo redirects to /customer/payment/success or /customer/payment/cancel
    // (route param). Fall back to a legacy ?status= query param.
    const status =
        routeParams.status ||
        queryParams.get("status") ||
        "success";

    const isSuccess = status === "success";

    // No payment reference at all — nothing to show here.
    useEffect(() => {
        if (!paymentId) {
            navigate("/customer/bookings", {
                replace: true,
            });
        }
    }, [paymentId, navigate]);

    // Cancelled / failed return: load the payment once and record a single
    // "payment didn't go through" notice.
    useEffect(() => {
        if (!paymentId || isSuccess) {
            return;
        }

        fetchPaymentById(paymentId);

        if (!failureReportedRef.current) {
            failureReportedRef.current = true;

            reportPaymentFailure(paymentId).catch(
                () => {
                    // Best-effort: the customer still sees the failure here.
                }
            );
        }
    }, [paymentId, isSuccess, fetchPaymentById]);

    // Successful return: confirm the payment straight from PayMongo (via the
    // reconcile endpoint) instead of waiting for the webhook. Poll on a fixed
    // interval until the payment is verified or the attempts run out. The loop
    // owns its own timer and is torn down on unmount — no re-render churn.
    useEffect(() => {
        if (!paymentId || !isSuccess) {
            return;
        }

        let cancelled = false;
        let timerId = null;

        const poll = async (attempt) => {
            if (cancelled) {
                return;
            }

            const result =
                await reconcilePayment(
                    paymentId
                );

            if (cancelled) {
                return;
            }

            const fulfilled =
                result?.meta?.requestStatus ===
                "fulfilled";

            const data = fulfilled
                ? result.payload?.data
                : null;

            if (!fulfilled) {
                // Couldn't reach PayMongo this round — show whatever the
                // webhook may already have written, then keep trying.
                fetchPaymentById(paymentId);
            }

            const verified =
                data?.paid === true ||
                data?.payment?.status ===
                    "VERIFIED";

            if (verified) {
                return;
            }

            if (attempt >= MAX_POLL_ATTEMPTS) {
                if (fulfilled) {
                    setPollExhausted(true);
                } else {
                    setPollError(true);
                }

                return;
            }

            timerId = setTimeout(
                () => poll(attempt + 1),
                POLL_INTERVAL_MS
            );
        };

        poll(1);

        return () => {
            cancelled = true;

            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [
        paymentId,
        isSuccess,
        reconcilePayment,
        fetchPaymentById,
    ]);

    // Drop the selected payment only when leaving this page.
    useEffect(() => {
        return () => {
            clearSelected();
        };
    }, [clearSelected]);

    if (loading && !selectedPayment) {
        return (
            <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
                <div className="flex min-h-[70vh] items-center justify-center">
                    <LoadingSpinner />
                </div>
            </main>
        );
    }

    const booking =
        selectedPayment?.booking ?? {};

    const formatRentalDates = ({ startDate, endDate } = {}) => {
        const format = (value) =>
            new Date(value).toLocaleString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });

        return startDate && endDate
            ? `${format(startDate)} – ${format(endDate)}`
            : "—";
    };

    const formatCurrency = (value) =>
        `₱${Number(
            value || 0
        ).toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const isPaymentVerified =
        selectedPayment?.status ===
        "VERIFIED";

    /*
     * The customer finished paying, but the booking (or the payment itself)
     * had already been closed — cancelled, rejected, released. The server
     * records that money and refunds it straight away, so this is neither a
     * "Payment Successful" nor a "still confirming" situation: say what
     * actually happened.
     */
    const isRefundedLatePayment =
        isSuccess &&
        ["VERIFIED", "REFUNDED"].includes(
            selectedPayment?.status
        ) &&
        Boolean(selectedPayment?.refund) &&
        CLOSED_BOOKING_STATUSES.includes(
            booking.status
        );

    const hasPollExhausted =
        pollExhausted && !isPaymentVerified;

    const isPolling =
        isSuccess &&
        !isPaymentVerified &&
        !isRefundedLatePayment &&
        !hasPollExhausted &&
        !pollError;

    return (
        <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
                    <div className="text-center">
                        <div
                            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
                                isRefundedLatePayment
                                    ? "bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                    : isSuccess
                                      ? "bg-green-100 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                                      : "bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                            }`}
                        >
                            {isRefundedLatePayment ? (
                                <RotateCcw
                                    size={30}
                                    strokeWidth={1.5}
                                />
                            ) : isSuccess ? (
                                <CheckCircle2
                                    size={30}
                                    strokeWidth={1.5}
                                />
                            ) : (
                                <XCircle
                                    size={30}
                                    strokeWidth={1.5}
                                />
                            )}
                        </div>

                        <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                            {isRefundedLatePayment
                                ? "Payment Refunded"
                                : isSuccess
                                  ? isPaymentVerified
                                      ? "Payment Successful"
                                      : "Processing Payment"
                                  : "Payment Cancelled"}
                        </h1>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            {isRefundedLatePayment
                                ? "Your payment reached us after this booking had already been closed, so it is being refunded in full to your original payment method. It can take a little while to appear."
                                : isSuccess
                                  ? isPaymentVerified
                                      ? "Your payment has been processed successfully."
                                      : "Please wait while we confirm your payment..."
                                  : "Your payment was cancelled. You can try again anytime."}
                        </p>

                        {isSuccess &&
                            isPaymentVerified &&
                            !isRefundedLatePayment && (
                            <p className="mt-2 text-sm text-blue-600 dark:text-blue-400">
                                Your booking is now pending admin approval. You will be notified once it is reviewed.
                            </p>
                        )}

                        {isPolling && (
                            <div className="mt-3 flex items-center justify-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                                <Loader2
                                    size={14}
                                    className="animate-spin"
                                />
                                <span>
                                    Confirming
                                    payment
                                    status...
                                </span>
                            </div>
                        )}

                        {pollError && (
                            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                                Unable to verify payment
                                status right now. Please check
                                your bookings for
                                updates.
                            </div>
                        )}

                        {hasPollExhausted && (
                            <div className="mt-3 text-sm text-yellow-600 dark:text-yellow-400">
                                Payment status
                                confirmation is taking
                                longer than expected.
                                Please check your
                                bookings for updates.
                            </div>
                        )}
                    </div>

                    {selectedPayment && (
                        <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                Payment Details
                            </h2>

                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Rental dates
                                    </span>

                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatRentalDates(booking)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Amount
                                    </span>

                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                        {formatCurrency(
                                            selectedPayment.amount
                                        )}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-300">
                                        Status
                                    </span>

                                    <span
                                        className={`text-sm font-medium ${
                                            selectedPayment.status ===
                                            "VERIFIED"
                                                ? "text-green-600 dark:text-green-400"
                                                : selectedPayment.status ===
                                                        "PENDING"
                                                  ? "text-yellow-600 dark:text-yellow-400"
                                                  : "text-gray-600 dark:text-gray-400"
                                        }`}
                                    >
                                        {isRefundedLatePayment
                                            ? selectedPayment.status ===
                                              "REFUNDED"
                                                ? "Refunded"
                                                : "Refund in progress"
                                            : selectedPayment.status ===
                                                "VERIFIED"
                                              ? "Paid"
                                              : selectedPayment.status ===
                                                      "PENDING"
                                                ? "Pending"
                                                : selectedPayment.status?.toLowerCase()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 space-y-3">
                        <Link
                            to="/customer/bookings"
                            className="block"
                        >
                            <Button
                                type="button"
                                size="lg"
                                className="w-full"
                            >
                                View My Bookings
                            </Button>
                        </Link>

                        {!isSuccess && paymentId && (
                            <Link
                                to={`/customer/checkout/${paymentId}`}
                                className="block"
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    className="w-full"
                                >
                                    Try Again
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default PaymentResult;
