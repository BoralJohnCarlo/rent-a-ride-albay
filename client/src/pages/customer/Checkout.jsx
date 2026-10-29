import {
    CreditCard,
    Loader2,
    RefreshCw,
    ShieldCheck,
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useState,
} from "react";
import {
    Link,
    useNavigate,
    useParams,
} from "react-router-dom";

import Button from "../../components/common/Button";
import LoadingSpinner from "../../components/common/LoadingSpinner";

import usePayment from "../../hooks/payments/usePayment";

const SESSION_EXISTS_ERROR =
    "A PayMongo Checkout Session has already been created for this payment.";

const Checkout = () => {
    const { paymentId } = useParams();
    const navigate = useNavigate();

    const {
        selectedPayment,
        loading,
        error,
        fetchPaymentById,
        initiateCheckout,
        clearError,
    } = usePayment();

    const [
        isRedirecting,
        setIsRedirecting,
    ] = useState(false);

    useEffect(() => {
        if (!paymentId) {
            navigate("/customer/bookings");

            return;
        }

        fetchPaymentById(paymentId);
    }, [
        paymentId,
        fetchPaymentById,
        navigate,
    ]);

    useEffect(() => {
        if (
            selectedPayment?.status ===
            "VERIFIED"
        ) {
            navigate(
                "/customer/payment/success",
                {
                    replace: true,
                }
            );
        }
    }, [
        selectedPayment,
        navigate,
    ]);

    const handleCheckout = useCallback(
        async () => {
            if (!paymentId) {
                return;
            }

            setIsRedirecting(true);

            const result =
                await initiateCheckout(
                    paymentId
                );

            if (
                result?.meta
                    ?.requestStatus ===
                "fulfilled"
            ) {
                const checkoutUrl =
                    result.payload?.data
                        ?.checkoutUrl;

                if (checkoutUrl) {
                    window.location.href =
                        checkoutUrl;
                }
            } else {
                setIsRedirecting(false);
            }
        },
        [paymentId, initiateCheckout]
    );

    const handleRetryCheckout =
        useCallback(async () => {
            if (!paymentId) {
                return;
            }

            clearError();

            setIsRedirecting(true);

            const result =
                await initiateCheckout(
                    paymentId,
                    true
                );

            if (
                result?.meta
                    ?.requestStatus ===
                "fulfilled"
            ) {
                const checkoutUrl =
                    result.payload?.data
                        ?.checkoutUrl;

                if (checkoutUrl) {
                    window.location.href =
                        checkoutUrl;
                }
            } else {
                setIsRedirecting(false);
            }
        }, [
            paymentId,
            initiateCheckout,
            clearError,
        ]);

    const isSessionExpiredError =
        error?.includes(
            SESSION_EXISTS_ERROR
        );

    if (loading && !selectedPayment) {
        return (
            <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
                <div className="flex min-h-[70vh] items-center justify-center">
                    <LoadingSpinner />
                </div>
            </main>
        );
    }

    if (!selectedPayment) {
        return (
            <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
                <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center px-4 py-16">
                    <div className="w-full rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Payment Not Found
                        </h1>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            The payment you are looking
                            for does not exist or has
                            been removed.
                        </p>

                        <div className="mt-6 flex flex-col gap-3">
                            <Button
                                type="button"
                                onClick={() =>
                                    fetchPaymentById(
                                        paymentId
                                    )
                                }
                                leftIcon={
                                    <RefreshCw
                                        size={18}
                                    />
                                }
                            >
                                Try Again
                            </Button>

                            <Link to="/customer/bookings">
                                <Button
                                    variant="outline"
                                    className="w-full"
                                >
                                    Back to Bookings
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    const booking =
        selectedPayment.booking ?? {};

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

    return (
        <main className="min-h-[70vh] bg-gray-50 dark:bg-gray-950">
            <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
                <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-8">
                    <div className="text-center">
                        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-400">
                            <CreditCard
                                size={30}
                                strokeWidth={1.5}
                            />
                        </div>

                        <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                            Complete Your Payment
                        </h1>

                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            You will be redirected to
                            PayMongo to securely
                            complete your payment.
                        </p>
                    </div>

                    <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800/50">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Payment Summary
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
                                    Payment Method
                                </span>

                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    GCash
                                </span>
                            </div>

                            <div className="border-t border-gray-200 pt-3 dark:border-gray-700">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Amount Due
                                    </span>

                                    <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400">
                                        {formatCurrency(
                                            selectedPayment.amount
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
                            <p className="text-sm font-medium text-red-800 dark:text-red-300">
                                {error}
                            </p>

                            {isSessionExpiredError && (
                                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                    Your previous checkout
                                    session may have expired.
                                    Please try again.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-8 space-y-4">
                        <Button
                            type="button"
                            size="lg"
                            className="w-full"
                            disabled={
                                loading ||
                                isRedirecting
                            }
                            loading={
                                loading ||
                                isRedirecting
                            }
                            onClick={handleCheckout}
                            leftIcon={
                                loading ||
                                isRedirecting ? (
                                    <Loader2
                                        size={18}
                                        className="animate-spin"
                                    />
                                ) : (
                                    <CreditCard
                                        size={18}
                                    />
                                )
                            }
                        >
                            {isRedirecting
                                ? "Redirecting..."
                                : "Pay with GCash via PayMongo"}
                        </Button>

                        {isSessionExpiredError && (
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                className="w-full"
                                disabled={
                                    loading ||
                                    isRedirecting
                                }
                                loading={
                                    loading ||
                                    isRedirecting
                                }
                                onClick={
                                    handleRetryCheckout
                                }
                                leftIcon={
                                    <RefreshCw
                                        size={18}
                                    />
                                }
                            >
                                Create New Checkout Session
                            </Button>
                        )}

                        <Link
                            to="/customer/bookings"
                            className="block"
                        >
                            <Button
                                type="button"
                                variant="ghost"
                                size="lg"
                                className="w-full"
                                disabled={
                                    loading ||
                                    isRedirecting
                                }
                            >
                                Cancel
                            </Button>
                        </Link>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                        <ShieldCheck size={14} />

                        <span>
                            Secured by PayMongo.
                            Your payment details
                            are encrypted.
                        </span>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default Checkout;
