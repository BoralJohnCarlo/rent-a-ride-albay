import {
    ArrowLeft,
    Calendar,
    CalendarClock,
    CheckCircle2,
    Clock,
    Gift,
    MessageSquarePlus,
    ReceiptText,
    Wallet,
    XCircle,
} from "lucide-react";

import {
    useEffect,
    useState,
} from "react";

import {
    Link,
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    isPastCancellationCutoff,
    canCustomerReschedule,
    getPendingReschedule,
} from "../../constants/bookingStatus";

import Button from "../../components/common/Button";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Modal from "../../components/common/Modal";
import Textarea from "../../components/common/Textarea";
import StatusChip from "../../components/common/StatusChip";
import ExtensionRequestModal from "../../components/modals/ExtensionRequestModal";
import RescheduleModal from "../../components/modals/RescheduleModal";
import { cancelBookingReschedule } from "../../api/bookingApi";
import RequestRefundModal from "../../components/modals/RequestRefundModal";
import CancellationRefundNotice from "../../components/booking/CancellationRefundNotice";
import CancelReasonChips from "../../components/booking/CancelReasonChips";
import RefundStatus from "../../components/payment/RefundStatus";

import ReturnTimingNote from "../../components/booking/ReturnTimingNote";
import MaintenanceConflictNotice from "../../components/booking/MaintenanceConflictNotice";
import { getDueBackAt } from "../../utils/returnTiming";
import { getDiscountBadgeText } from "../../utils/vehicleDiscount";

import useBooking from "../../hooks/bookings/useBooking";
import useRental from "../../hooks/rentals/useRental";
import useToast from "../../hooks/toast/useToast";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";
import DriverChangeRequestCard from "../../components/booking/DriverChangeRequestCard";
import AcceptedTerms from "../../components/legal/AcceptedTerms";
import PolicySourceNote from "../../components/legal/PolicySourceNote";

/* ------------------------------------------------------------------ */
/* Same palette/format conventions as pages/customer/Bookings.jsx     */
/* ink #14161B · paper #F7F5F1 · amber #E29B3F · teal #2F6F68 · rust #C1502E */
/* ------------------------------------------------------------------ */

const formatCurrency = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const formatDateTime = (dateString) => {
    if (!dateString) {
        return "—";
    }

    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const getVehicleName = (vehicle) => {
    if (!vehicle) {
        return "—";
    }

    const name = [vehicle.brand, vehicle.model]
        .filter(Boolean)
        .join(" ");

    return vehicle.vehicleCode || name || "—";
};

const canCancel = (status) =>
    status === "Pending" ||
    status === "Payment Received" ||
    status === "Approved";

/*
 * Also offered when the customer cancelled their own payment attempt on a
 * booking that is still Pending: the server reopens it if the payment window
 * hasn't closed, and explains if it has.
 */
const canPayNow = (booking) =>
    booking?.paymentId &&
    (booking.paymentAmount == null || Number(booking.paymentAmount) > 0) &&
    (booking?.paymentStatus === "PENDING" ||
        (booking?.paymentStatus === "CANCELLED" &&
            booking?.status === "Pending")) &&
    booking?.paymentMethod === "GCASH" &&
    booking?.status !== "Cancelled";

/*
 * A GCash extension fee is payable online the same way the reservation fee
 * is; one that inherited "Cash on Pickup" from the original reservation-fee
 * payment method (see approveBookingExtension in bookingService.js) has no
 * online step and is only ever settled in person.
 */
const canPayExtensionFee = (booking) =>
    booking?.extensionPaymentId &&
    booking?.extensionPaymentStatus === "PENDING" &&
    booking?.extensionPaymentMethod === "GCASH" &&
    booking?.status !== "Cancelled";

const hasPendingExtension = (booking) =>
    Array.isArray(booking?.extensions) &&
    booking.extensions.some(
        (extension) => extension?.status === "Pending"
    );

const isExtensionEligible = (status) =>
    status === "Approved" || status === "Ongoing";

const canReview = (status) => status === "Completed";

/* Kept at module scope (rather than as a component closure) since it reads
   the system clock, which the render pass itself must stay free of. */
const canRequestRefund = (booking, windowHours) => {
    const returnedAt = booking?.rental?.return?.date;

    if (!returnedAt) {
        return false;
    }

    /* Don't offer a second request while one is already awaiting review —
       the backend would just reject it against the remaining refundable
       balance, which reads as a confusing, unexplained error. */
    const hasPendingRefund = Array.isArray(
        booking?.rental?.refunds
    ) &&
        booking.rental.refunds.some(
            (refund) => refund.status === "Pending"
        );

    if (hasPendingRefund) {
        return false;
    }

    const hoursSinceReturn =
        (Date.now() - new Date(returnedAt).getTime()) /
        (1000 * 60 * 60);

    return hoursSinceReturn <= windowHours;
};

const getPendingRefund = (booking) => {
    const refunds = booking?.rental?.refunds;

    if (!Array.isArray(refunds)) {
        return null;
    }

    return (
        refunds.find(
            (refund) => refund.status === "Pending"
        ) ?? null
    );
};

/* completeRental blocks on an unresolved security deposit (Pending/Held/
   Partially Deducted) — also a separate admin action, taken independently
   of setting the vehicle outcome. */
const isDepositResolved = (booking) => {
    const deposit = booking?.rental?.securityDeposit;

    if (!deposit?.required) {
        return true;
    }

    return !["Pending", "Held", "Partially Deducted"].includes(
        deposit.status
    );
};

/* Also requires the vehicle outcome to already be set: it's a separate,
   deliberate admin decision (made after inspecting the return) that
   determines whether the vehicle goes back to Available or Maintenance,
   and completeRental refuses to run without it — showing the button any
   earlier would just walk the customer into that error. */
const canMarkCompleted = (booking) =>
    booking?.status === "Ongoing" &&
    Boolean(booking?.rental?.return?.date) &&
    Boolean(booking?.rental?.vehicleOutcome) &&
    isDepositResolved(booking);

const BookingDetails = () => {
    const { bookingId } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const {
        selectedBooking: booking,
        loading,
        error,
        fetchBookingById,
        cancelExistingBooking,
        requestExistingBookingExtension,
        cancelExistingBookingExtension,
        clearSelected,
    } = useBooking();

    const {
        completeAsCustomer,
        submitRefundRequest,
        withdrawRefundRequest,
    } = useRental();

    const {
        requireCancellationReason: cancelReasonRequired,
        refundRequestWindowHours: refundWindowHours,
        noShowGraceHours,
    } = usePublicRefundSettings();

    /*
     * A clock for the pickup-day cutoff, so Cancel disappears on its own
     * when the page is left open (see isPastCancellationCutoff).
     */
    const [now, setNow] = useState(0);

    useEffect(() => {
        const tick = () => setNow(Date.now());

        tick();

        const timer = setInterval(tick, 60 * 1000);

        return () => clearInterval(timer);
    }, []);

    const [confirmState, setConfirmState] = useState(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [extensionModalOpen, setExtensionModalOpen] = useState(false);
    const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
    const [refundModal, setRefundModal] = useState(null);
    const [completing, setCompleting] = useState(false);
    const [payNowLoading, setPayNowLoading] = useState(false);
    const [cancelModal, setCancelModal] = useState(null);

    useEffect(() => {
        if (bookingId) {
            fetchBookingById(bookingId);
        }

        return () => {
            clearSelected();
        };
    }, [bookingId, fetchBookingById, clearSelected]);

    const closeConfirm = () => {
        if (confirmLoading) {
            return;
        }

        setConfirmState(null);
    };

    const runConfirm = async () => {
        if (!confirmState?.onConfirm) {
            setConfirmState(null);
            return;
        }

        setConfirmLoading(true);

        try {
            await confirmState.onConfirm();
            setConfirmState(null);
        } catch (confirmError) {
            toast.error(
                confirmError?.response?.data?.message ||
                    "Something went wrong. Please try again.",
                "Error"
            );
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleCancelBooking = () => {
        if (!booking?._id) {
            return;
        }

        setCancelModal({
            reason: "",
            submitting: false,
        });
    };

    const closeCancelModal = () => {
        if (cancelModal?.submitting) {
            return;
        }

        setCancelModal(null);
    };

    const submitCancelBooking = async () => {
        if (!booking?._id) {
            return;
        }

        const trimmedReason =
            cancelModal.reason.trim();

        if (
            cancelReasonRequired &&
            !trimmedReason
        ) {
            toast.error(
                "Please provide a reason for cancelling.",
                "Reason required"
            );

            return;
        }

        setCancelModal((current) =>
            current
                ? { ...current, submitting: true }
                : current
        );

        const result = await cancelExistingBooking(
            booking._id,
            trimmedReason
        );

        if (
            result?.meta?.requestStatus ===
            "fulfilled"
        ) {
            toast.success(
                "Booking cancelled.",
                "Success"
            );

            setCancelModal(null);

            await fetchBookingById(booking._id);
        } else {
            toast.error(
                typeof result?.payload === "string"
                    ? result.payload
                    : "Unable to cancel booking.",
                "Error"
            );

            setCancelModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    const handleCancelExtension = (extensionId) => {
        if (!booking?._id) {
            return;
        }

        setConfirmState({
            title: "Cancel Extension Request",
            message: "Cancel this extension request?",
            confirmText: "Cancel Request",
            cancelText: "Keep Request",
            confirmVariant: "danger",
            onConfirm: async () => {
                await cancelExistingBookingExtension(
                    booking._id,
                    extensionId,
                    "Cancelled by customer"
                );

                toast.success("Extension request cancelled.", "Success");

                await fetchBookingById(booking._id);
            },
        });
    };

    const handleCancelReschedule = (rescheduleId) => {
        if (!booking?._id) {
            return;
        }

        setConfirmState({
            title: "Cancel Reschedule Request",
            message: "Cancel this reschedule request? Your current dates stay as they are.",
            confirmText: "Cancel Request",
            cancelText: "Keep Request",
            confirmVariant: "danger",
            onConfirm: async () => {
                await cancelBookingReschedule(
                    booking._id,
                    rescheduleId,
                    "Cancelled by customer"
                );

                toast.success("Reschedule request cancelled.", "Success");

                await fetchBookingById(booking._id);
            },
        });
    };

    const handleExtensionSubmit = async (extensionData) => {
        if (!booking?._id) {
            return;
        }

        try {
            await requestExistingBookingExtension(
                booking._id,
                extensionData
            );

            toast.success(
                "Extension request submitted successfully.",
                "Success"
            );

            setExtensionModalOpen(false);

            await fetchBookingById(booking._id);
        } catch (submitError) {
            toast.error(
                submitError?.response?.data?.message ||
                    "Unable to request extension.",
                "Error"
            );
        }
    };

    const handleReview = () => {
        if (!booking?._id) {
            return;
        }

        navigate(`/customer/bookings/${booking._id}/rate`);
    };

    const handleOpenRefundModal = () => {
        if (!booking?.rental?._id) {
            toast.error(
                "Refund requests aren't available for this booking yet."
            );

            return;
        }

        setRefundModal({ submitting: false });
    };

    const closeRefundModal = () => {
        if (refundModal?.submitting) {
            return;
        }

        setRefundModal(null);
    };

    const submitRefundModal = async (refundData) => {
        const rentalId = booking?.rental?._id;

        if (!rentalId) {
            return;
        }

        setRefundModal((current) =>
            current
                ? { ...current, submitting: true }
                : current
        );

        const result = await submitRefundRequest(
            rentalId,
            refundData
        );

        if (result?.meta?.requestStatus === "fulfilled") {
            toast.success(
                "Refund request submitted.",
                "Success"
            );

            setRefundModal(null);

            await fetchBookingById(booking._id);
        } else {
            toast.error(
                typeof result?.payload === "string"
                    ? result.payload
                    : "Unable to submit refund request.",
                "Error"
            );

            setRefundModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    const handleMarkCompleted = async () => {
        const rentalId = booking?.rental?._id;

        if (!rentalId) {
            return;
        }

        setCompleting(true);

        const result = await completeAsCustomer(rentalId);

        if (result?.meta?.requestStatus === "fulfilled") {
            toast.success(
                "Trip marked as completed!",
                "Success"
            );

            navigate(`/customer/bookings/${booking._id}/rate`);
        } else {
            toast.error(
                typeof result?.payload === "string"
                    ? result.payload
                    : "Unable to mark this trip as completed.",
                "Error"
            );

            setCompleting(false);
        }
    };

    const handleWithdrawRefund = () => {
        const pendingRefund = getPendingRefund(booking);

        if (!pendingRefund?._id) {
            return;
        }

        setConfirmState({
            title: "Withdraw Refund Request",
            message:
                "This will cancel your pending refund request. You can submit a new one later if needed.",
            confirmText: "Withdraw Request",
            cancelText: "Keep Request",
            confirmVariant: "danger",
            onConfirm: async () => {
                const result = await withdrawRefundRequest(
                    pendingRefund._id
                );

                if (result?.meta?.requestStatus === "fulfilled") {
                    toast.success(
                        "Refund request withdrawn.",
                        "Success"
                    );

                    await fetchBookingById(booking._id);
                } else {
                    toast.error(
                        typeof result?.payload === "string"
                            ? result.payload
                            : "Unable to withdraw refund request.",
                        "Error"
                    );
                }
            },
        });
    };

    const handlePayNow = () => {
        if (!booking?.paymentId) {
            return;
        }

        setPayNowLoading(true);

        navigate(`/customer/checkout/${booking.paymentId}`);
    };

    const handlePayExtensionNow = () => {
        if (!booking?.extensionPaymentId) {
            return;
        }

        setPayNowLoading(true);

        navigate(
            `/customer/checkout/${booking.extensionPaymentId}`
        );
    };

    const statusHistory = Array.isArray(booking?.statusHistory)
        ? [...booking.statusHistory].reverse()
        : [];

    return (
        <main className="min-h-screen bg-[#F7F5F1] px-4 pt-20 pb-12 dark:bg-gray-950 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl">
                <Link
                    to="/customer/bookings"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#14161B]/60 transition-colors hover:text-[#14161B] dark:text-white/50 dark:hover:text-white"
                >
                    <ArrowLeft size={16} />
                    Back to My Bookings
                </Link>

                {loading && !booking && (
                    <div className="mt-16 flex justify-center">
                        <LoadingSpinner />
                    </div>
                )}

                {!loading && !booking && (
                    <div className="mt-8 rounded-2xl border border-[#14161B]/10 bg-white p-8 text-center dark:border-white/10 dark:bg-[#1B1E24]">
                        <h1 className="text-lg font-semibold text-[#14161B] dark:text-white">
                            Booking not found
                        </h1>

                        <p className="mt-2 text-sm text-[#14161B]/50 dark:text-white/40">
                            {error ||
                                "This booking does not exist or you don't have access to it."}
                        </p>

                        <Link to="/customer/bookings" className="mt-6 inline-block">
                            <Button variant="outline">
                                Back to My Bookings
                            </Button>
                        </Link>
                    </div>
                )}

                {booking && (
                    <div className="mt-4 rounded-2xl border border-[#14161B]/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-[#1B1E24] sm:p-8">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                                <h1 className="break-words text-xl font-semibold text-[#14161B] dark:text-white">
                                    {getVehicleName(booking.vehicle)}
                                </h1>
                                <p className="text-sm text-[#14161B]/50 dark:text-white/40">
                                    Booked on{" "}
                                    {new Date(
                                        booking.createdAt
                                    ).toLocaleString("en-PH", {
                                        year: "numeric",
                                        month: "long",
                                        day: "numeric",
                                        hour: "numeric",
                                        minute: "2-digit",
                                    })}
                                </p>
                            </div>

                            <StatusChip status={booking.status} />
                        </div>

                        {booking.maintenanceConflict && (
                            <div className="mt-5">
                                <MaintenanceConflictNotice
                                    booking={booking}
                                    showResolved
                                    onChanged={() =>
                                        fetchBookingById(booking._id)
                                    }
                                />
                            </div>
                        )}

                        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    Vehicle
                                </h4>
                                <p className="font-medium text-[#14161B] dark:text-white">
                                    {getVehicleName(booking.vehicle)}
                                </p>
                                {booking.vehicle?.plateNumber && (
                                    <p className="text-sm text-[#14161B]/50 dark:text-white/40">
                                        Plate: {booking.vehicle.plateNumber}
                                    </p>
                                )}
                            </div>

                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    Driver Option
                                </h4>
                                <p className="font-medium text-[#14161B] dark:text-white">
                                    {booking.driverOption === "With Driver"
                                        ? "With Driver"
                                        : "Without Driver"}
                                </p>
                                {booking.driverOption === "With Driver" &&
                                    booking.driver && (
                                        <p className="text-sm text-[#14161B]/50 dark:text-white/40">
                                            <Link
                                                to={`/drivers/${booking.driver._id}`}
                                                className="underline decoration-[#14161B]/20 underline-offset-2 hover:decoration-[#14161B]/50 dark:decoration-white/30 dark:hover:decoration-white/60"
                                            >
                                                {[
                                                    booking.driver.firstName,
                                                    booking.driver.lastName,
                                                ]
                                                    .filter(Boolean)
                                                    .join(" ") ||
                                                    "Driver assigned"}
                                            </Link>
                                        </p>
                                    )}
                                {/* Admins assign the driver at approval
                                    (Settings → Drivers). */}
                                {booking.driverOption === "With Driver" &&
                                    !booking.driver && (
                                        <p className="text-sm text-[#14161B]/50 dark:text-white/40">
                                            We'll assign your driver before
                                            pickup.
                                        </p>
                                    )}

                                <DriverChangeRequestCard
                                    booking={booking}
                                    onChanged={() =>
                                        fetchBookingById(booking._id)
                                    }
                                />
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                Dates
                            </h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-[#14161B]/10 p-3 dark:border-white/10">
                                    <p className="text-xs text-[#14161B]/45 dark:text-white/40">
                                        Pickup
                                    </p>
                                    <p className="font-medium text-[#14161B] dark:text-white">
                                        {formatDateTime(booking.startDate)}
                                    </p>
                                    {booking.pickupTime && (
                                        <p className="text-xs text-[#14161B]/50 dark:text-white/40">
                                            Preferred pickup time: {booking.pickupTime}
                                        </p>
                                    )}
                                </div>
                                <div className="rounded-xl border border-[#14161B]/10 p-3 dark:border-white/10">
                                    <p className="text-xs text-[#14161B]/45 dark:text-white/40">
                                        {booking.rental?.return?.date
                                            ? "Returned"
                                            : "Due Back"}
                                    </p>
                                    <p className="font-medium text-[#14161B] dark:text-white">
                                        {formatDateTime(
                                            booking.rental?.return?.date ??
                                                booking.endDate
                                        )}
                                    </p>
                                    {booking.rental?.return?.date &&
                                        getDueBackAt(booking) && (
                                            <ReturnTimingNote
                                                dueBackAt={getDueBackAt(booking)}
                                                returnedAt={booking.rental.return.date}
                                                dueBackLabel={formatDateTime(
                                                    getDueBackAt(booking)
                                                )}
                                            />
                                        )}
                                </div>
                            </div>
                            {booking.scheduledStartDate ? (
                                <p className="mt-2 text-xs text-[#14161B]/50 dark:text-white/40">
                                    Booked schedule:{" "}
                                    {formatDateTime(booking.scheduledStartDate)} –{" "}
                                    {formatDateTime(booking.scheduledEndDate)}. Your
                                    rental period started when the vehicle was handed
                                    over to you.
                                </p>
                            ) : (
                                ["Pending", "Payment Received", "Approved"].includes(
                                    booking.status
                                ) && (
                                    <p className="mt-2 text-xs text-[#14161B]/50 dark:text-white/40">
                                        Your rental period starts when the vehicle is
                                        handed over to you, and it's due back at the
                                        same time of day on your return date.
                                    </p>
                                )
                            )}
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    Pickup Location
                                </h4>
                                <p className="font-medium text-[#14161B] dark:text-white">
                                    {booking.pickupLocation?.address || "—"}
                                </p>
                            </div>

                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    Return Location
                                </h4>
                                <p className="font-medium text-[#14161B] dark:text-white">
                                    {booking.returnLocation?.address || "—"}
                                </p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                Pricing Breakdown
                            </h4>
                            <div className="rounded-xl border border-[#14161B]/10 p-4 dark:border-white/10">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[#14161B]/60 dark:text-white/50">
                                            Daily Rate
                                        </span>
                                        <span className="text-[#14161B] dark:text-white">
                                            {booking.pricing?.vehicleDiscount && (
                                                <span className="mr-1.5 text-xs text-[#14161B]/40 line-through dark:text-white/40">
                                                    {formatCurrency(
                                                        booking.pricing.originalDailyRate
                                                    )}
                                                </span>
                                            )}
                                            {formatCurrency(
                                                booking.pricing?.dailyRate
                                            )}
                                        </span>
                                    </div>
                                    {booking.pricing?.vehicleDiscount && (
                                        <div className="flex justify-between text-sm text-rose-600 dark:text-rose-400">
                                            <span>
                                                {getDiscountBadgeText(
                                                    booking.pricing.vehicleDiscount
                                                )}
                                            </span>
                                            <span>
                                                −
                                                {formatCurrency(
                                                    booking.pricing.vehicleDiscount.amountPerDay
                                                )}
                                                /day
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[#14161B]/60 dark:text-white/50">
                                            Rental Days
                                        </span>
                                        <span className="text-[#14161B] dark:text-white">
                                            {booking.pricing?.rentalDays || "—"}{" "}
                                            {booking.pricing?.rentalDays === 1
                                                ? "day"
                                                : "days"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[#14161B]/60 dark:text-white/50">
                                            Subtotal
                                        </span>
                                        <span className="text-[#14161B] dark:text-white">
                                            {formatCurrency(
                                                booking.pricing?.subtotal
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[#14161B]/60 dark:text-white/50">
                                            Reservation Fee
                                        </span>
                                        <span className="text-[#14161B] dark:text-white">
                                            {formatCurrency(
                                                booking.pricing?.reservationFee
                                            )}
                                        </span>
                                    </div>

                                    {booking.pricing?.pickupDistanceFee > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[#14161B]/60 dark:text-white/50">
                                                Pickup Distance Fee
                                            </span>
                                            <span className="text-[#14161B] dark:text-white">
                                                {formatCurrency(
                                                    booking.pricing
                                                        .pickupDistanceFee
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {booking.pricing?.returnDistanceFee > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[#14161B]/60 dark:text-white/50">
                                                Return Distance Fee
                                            </span>
                                            <span className="text-[#14161B] dark:text-white">
                                                {formatCurrency(
                                                    booking.pricing
                                                        .returnDistanceFee
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    {booking.rental?.financial?.lateCharges > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-[#C1502E]">
                                                Late Return Charge
                                            </span>
                                            <span className="text-[#C1502E]">
                                                {formatCurrency(
                                                    booking.rental.financial
                                                        .lateCharges
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    <div className="border-t border-[#14161B]/10 pt-2 dark:border-white/10">
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-[#14161B] dark:text-white">
                                                Total
                                            </span>
                                            <span className="font-bold text-[#14161B] dark:text-white">
                                                {formatCurrency(
                                                    booking.pricing?.totalAmount
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    {booking.voucher && (
                                        <div className="mt-4 rounded-xl border border-[#E29B3F]/30 bg-[#E29B3F]/8 p-4 dark:border-[#E29B3F]/25 dark:bg-[#E29B3F]/10">
                                            <div className="mb-2 flex items-center gap-2">
                                                <Gift
                                                    size={16}
                                                    className="text-[#E29B3F]"
                                                />
                                                <h4 className="text-sm font-semibold text-[#14161B] dark:text-white">
                                                    Voucher Applied
                                                </h4>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-sm text-[#14161B]/70 dark:text-white/60">
                                                    {booking.voucher.name ||
                                                        booking.voucher.code}
                                                </p>
                                                <p className="font-mono text-xs text-[#E29B3F]">
                                                    {booking.voucher.code}
                                                </p>
                                                {booking.voucher.discountAmount >
                                                    0 && (
                                                    <p className="text-xs font-medium text-[#2F6F68]">
                                                        Discount:{" "}
                                                        {formatCurrency(
                                                            booking.voucher
                                                                .discountAmount
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <RefundStatus
                                booking={booking}
                                rental={booking.rental}
                            />
                        </div>

                        {Array.isArray(booking.extensions) &&
                            booking.extensions.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                        Extensions
                                    </h4>

                                    <div className="space-y-3">
                                        {booking.extensions.map(
                                            (ext, index) => (
                                                <div
                                                    key={ext._id ?? index}
                                                    className="rounded-lg border border-[#14161B]/10 p-3 dark:border-white/10"
                                                >
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <span className="text-sm font-medium text-[#14161B] dark:text-white">
                                                            Request #{index + 1}
                                                        </span>
                                                        <StatusChip
                                                            status={ext.status?.toLowerCase()}
                                                            size="sm"
                                                        />
                                                    </div>

                                                    <div className="space-y-1 text-xs text-[#14161B]/60 dark:text-white/50">
                                                        <p>
                                                            Previous end:{" "}
                                                            {formatDateTime(
                                                                ext.previousEndDate
                                                            )}
                                                        </p>
                                                        <p>
                                                            Requested end:{" "}
                                                            {formatDateTime(
                                                                ext.requestedEndDate
                                                            )}
                                                        </p>
                                                        <p>
                                                            Additional:{" "}
                                                            {ext.additionalHours}{" "}
                                                            hour
                                                            {ext.additionalHours ===
                                                            1
                                                                ? ""
                                                                : "s"}
                                                        </p>
                                                        <p className="font-semibold text-[#14161B] dark:text-white">
                                                            Extension cost:{" "}
                                                            {formatCurrency(
                                                                ext.pricing
                                                                    ?.amount
                                                            )}
                                                        </p>
                                                        {ext.reason && (
                                                            <p className="mt-1 text-[#14161B]/50 dark:text-white/40">
                                                                Reason:{" "}
                                                                {ext.reason}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {ext.status ===
                                                        "Pending" && (
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="danger"
                                                                onClick={() =>
                                                                    handleCancelExtension(
                                                                        ext._id
                                                                    )
                                                                }
                                                                leftIcon={<XCircle size={14} />}
                                                            >
                                                                Cancel Request
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                        {Array.isArray(booking.reschedules) &&
                            booking.reschedules.length > 0 && (
                                <div className="mt-6">
                                    <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                        Reschedule
                                    </h4>

                                    <div className="space-y-3">
                                        {booking.reschedules.map((item, index) => (
                                            <div
                                                key={item._id ?? index}
                                                className="rounded-lg border border-[#14161B]/10 p-3 dark:border-white/10"
                                            >
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <span className="text-sm font-medium text-[#14161B] dark:text-white">
                                                        {item.requestedByAdmin
                                                            ? "Moved by Rent-A-Ride"
                                                            : `Request #${index + 1}`}
                                                    </span>
                                                    <StatusChip
                                                        status={item.status?.toLowerCase()}
                                                        size="sm"
                                                    />
                                                </div>

                                                <div className="space-y-1 text-xs text-[#14161B]/60 dark:text-white/50">
                                                    <p>
                                                        From: {formatDateTime(item.previousStartDate)} – {formatDateTime(item.previousEndDate)}
                                                    </p>
                                                    <p>
                                                        To: {formatDateTime(item.requestedStartDate)} – {formatDateTime(item.requestedEndDate)}
                                                    </p>
                                                    {Number(item.pricing?.difference) !== 0 && (
                                                        <p className="font-semibold text-[#14161B] dark:text-white">
                                                            Price change:{" "}
                                                            {item.pricing.difference > 0 ? "+" : "−"}
                                                            {formatCurrency(Math.abs(item.pricing.difference))}
                                                        </p>
                                                    )}
                                                    {item.status === "Approved" &&
                                                        item.settlement?.kind === "refund" && (
                                                            <p>
                                                                {formatCurrency(item.settlement.amount)} refund{" "}
                                                                {item.settlement.manual
                                                                    ? "is being processed by our team."
                                                                    : "sent to your original payment."}
                                                            </p>
                                                        )}
                                                    {item.reason && (
                                                        <p className="mt-1 text-[#14161B]/50 dark:text-white/40">
                                                            Reason: {item.reason}
                                                        </p>
                                                    )}
                                                    {item.status === "Rejected" &&
                                                        item.rejectionReason && (
                                                            <p className="mt-1 text-red-600 dark:text-red-400">
                                                                Not approved: {item.rejectionReason}
                                                            </p>
                                                        )}
                                                </div>

                                                {item.status === "Pending" && (
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() =>
                                                                handleCancelReschedule(item._id)
                                                            }
                                                         leftIcon={<XCircle size={14} />}>
                                                            Cancel Request
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        {booking.customerNotes && (
                            <div className="mt-6">
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    Notes
                                </h4>
                                <p className="rounded-xl border border-[#14161B]/10 p-3 text-sm text-[#14161B]/75 dark:border-white/10 dark:text-white/60">
                                    {booking.customerNotes}
                                </p>
                            </div>
                        )}

                        {/* The exact terms agreed to when booking. */}
                        {booking.termsAcceptance?.document && (
                            <div className="mt-6">
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    Terms you agreed to
                                </h4>
                                <AcceptedTerms
                                    acceptance={booking.termsAcceptance}
                                />
                            </div>
                        )}

                        {/* What a no-show kept, and under which terms. */}
                        {booking.noShowOutcome?.keptAmount > 0 && (
                            <div className="mt-6">
                                <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    No-show
                                </h4>
                                <div className="space-y-1 rounded-xl border border-[#14161B]/10 p-3 text-sm text-[#14161B]/75 dark:border-white/10 dark:text-white/60">
                                    <p>
                                        {formatCurrency(booking.noShowOutcome.keptAmount)}{" "}
                                        was kept because the vehicle wasn&apos;t picked up
                                        {booking.noShowOutcome.refundAmount > 0
                                            ? `, and ${formatCurrency(
                                                  booking.noShowOutcome.refundAmount
                                              )} was refunded`
                                            : ""}
                                        .
                                    </p>
                                    <PolicySourceNote
                                        source={booking.noShowOutcome.policySource}
                                        version={booking.noShowOutcome.termsVersion}
                                    />
                                </div>
                            </div>
                        )}

                        {booking.paymentStatus &&
                            booking.status !== "Cancelled" && (
                                <div className="mt-6">
                                    <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                        Payment Status
                                    </h4>
                                    <StatusChip
                                        status={
                                            booking.paymentStatus === "VERIFIED"
                                                ? "approved"
                                                : booking.paymentStatus ===
                                                    "PENDING"
                                                  ? "pending"
                                                  : "rejected"
                                        }
                                    />
                                </div>
                            )}

                        {booking.extensionPaymentStatus &&
                            booking.status !== "Cancelled" && (
                                <div className="mt-6">
                                    <h4 className="mb-3 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                        {booking.extensionPaymentPurpose === "reschedule"
                                            ? "Reschedule Difference"
                                            : booking.extensionPaymentPurpose === "vehicleChange"
                                              ? "Vehicle Change Difference"
                                              : "Extension Fee"}
                                        {booking.extensionPaymentAmount
                                            ? ` (${formatCurrency(booking.extensionPaymentAmount)})`
                                            : ""}
                                    </h4>
                                    <StatusChip
                                        status={
                                            booking.extensionPaymentStatus === "VERIFIED"
                                                ? "approved"
                                                : booking.extensionPaymentStatus ===
                                                    "PENDING"
                                                  ? "pending"
                                                  : "rejected"
                                        }
                                    />
                                    {booking.extensionPaymentStatus === "PENDING" &&
                                        booking.extensionPaymentMethod !== "GCASH" && (
                                            <p className="mt-1.5 text-xs text-[#14161B]/50 dark:text-white/40">
                                                Due at pickup.
                                            </p>
                                        )}
                                </div>
                            )}

                        {statusHistory.length > 0 && (
                            <div className="mt-6">
                                <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#14161B]/60 dark:text-white/50">
                                    <Calendar size={14} />
                                    Status History
                                </h4>

                                <ol className="space-y-4 border-l-2 border-[#14161B]/10 pl-4 dark:border-white/10">
                                    {statusHistory.map((entry, index) => (
                                        <li
                                            key={`${entry.status}-${entry.changedAt}-${index}`}
                                            className="relative"
                                        >
                                            <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-[#E29B3F]" />

                                            <div className="flex flex-wrap items-center gap-2">
                                                <StatusChip
                                                    status={entry.status}
                                                    size="sm"
                                                />
                                                <span className="text-xs text-[#14161B]/45 dark:text-white/40">
                                                    {formatDateTime(
                                                        entry.changedAt
                                                    )}
                                                </span>
                                            </div>

                                            {entry.reason && (
                                                <p className="mt-1 text-sm text-[#14161B]/70 dark:text-white/60">
                                                    {entry.reason}
                                                </p>
                                            )}
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        <div className="mt-8 flex flex-wrap gap-3 border-t border-[#14161B]/10 pt-6 dark:border-white/10">
                            {canPayNow(booking) && (
                                    <Button
                                        type="button"
                                        onClick={handlePayNow}
                                        loading={payNowLoading}
                                    >
                                        Pay Now
                                    </Button>
                                )}

                            {canPayExtensionFee(booking) && (
                                    <Button
                                        type="button"
                                        onClick={handlePayExtensionNow}
                                        loading={payNowLoading}
                                    >
                                        {booking.extensionPaymentPurpose === "reschedule"
                                            ? "Pay Reschedule Difference"
                                            : booking.extensionPaymentPurpose === "vehicleChange"
                                              ? "Pay Vehicle Difference"
                                              : "Pay Extension Fee"}
                                    </Button>
                                )}

                            {getPendingReschedule(booking) ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled
                                    title="Your reschedule request is awaiting review."
                                >
                                    <Clock size={16} />
                                    <span className="ml-1.5">Reschedule Pending</span>
                                </Button>
                            ) : (
                                canCustomerReschedule(booking, now) && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setRescheduleModalOpen(true)}
                                    >
                                        <CalendarClock size={16} />
                                        <span className="ml-1.5">Reschedule</span>
                                    </Button>
                                )
                            )}

                            {isExtensionEligible(booking.status) &&
                                (hasPendingExtension(booking) ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled
                                        title="An extension request for this booking is already awaiting review."
                                    >
                                        <Clock size={16} />
                                        <span className="ml-1.5">
                                            Extension Pending
                                        </span>
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            setExtensionModalOpen(true)
                                        }
                                    >
                                        Request Extension
                                    </Button>
                                ))}

                            {canReview(booking.status) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleReview}
                                >
                                    <MessageSquarePlus size={16} />
                                    <span className="ml-1.5">
                                        Leave a Review
                                    </span>
                                </Button>
                            )}

                            {canRequestRefund(booking, refundWindowHours) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleOpenRefundModal}
                                >
                                    <Wallet size={16} />
                                    <span className="ml-1.5">
                                        Request Refund
                                    </span>
                                </Button>
                            )}

                            {getPendingRefund(booking) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleWithdrawRefund}
                                >
                                    <XCircle size={16} />
                                    <span className="ml-1.5">
                                        Cancel Refund Request
                                    </span>
                                </Button>
                            )}

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    navigate(
                                        `/documents/statements/${booking._id}`
                                    )
                                }
                            >
                                <ReceiptText size={16} />
                                <span className="ml-1.5">
                                    Statement & Receipts
                                </span>
                            </Button>

                            {canMarkCompleted(booking) && (
                                <Button
                                    type="button"
                                    variant="success"
                                    loading={completing}
                                    onClick={handleMarkCompleted}
                                >
                                    <CheckCircle2 size={16} />
                                    <span className="ml-1.5">
                                        Mark as Completed
                                    </span>
                                </Button>
                            )}

                            {isPastCancellationCutoff(booking, noShowGraceHours, now) && (
                                <p className="basis-full text-xs text-[#14161B]/60 dark:text-white/60">
                                    It's pickup day, so this booking can no longer be cancelled. Can't make it?{" "}
                                    <Link
                                        to="/customer/customer-service"
                                        onClick={(event) => event.stopPropagation()}
                                        className="font-semibold underline"
                                    >
                                        Contact us
                                    </Link>
                                    {" "}— a booking that isn't picked up is marked as a no-show.
                                </p>
                            )}
                            {canCancel(booking.status) && !isPastCancellationCutoff(booking, noShowGraceHours, now) && (
                                <Button
                                    type="button"
                                    variant="danger"
                                    onClick={handleCancelBooking}
                                >
                                    Cancel Booking
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <ExtensionRequestModal
                isOpen={extensionModalOpen}
                onClose={() => setExtensionModalOpen(false)}
                onSubmit={handleExtensionSubmit}
                loading={false}
                booking={booking}
            />

            <RescheduleModal
                isOpen={rescheduleModalOpen}
                onClose={() => setRescheduleModalOpen(false)}
                booking={booking}
                mode="customer"
                onDone={() => fetchBookingById(booking._id)}
            />

            <RequestRefundModal
                isOpen={Boolean(refundModal)}
                onClose={closeRefundModal}
                onSubmit={submitRefundModal}
                loading={refundModal?.submitting ?? false}
                booking={booking}
            />

            <ConfirmDialog
                isOpen={Boolean(confirmState)}
                onClose={closeConfirm}
                onConfirm={runConfirm}
                title={confirmState?.title}
                message={confirmState?.message}
                confirmText={confirmState?.confirmText ?? "Confirm"}
                cancelText={confirmState?.cancelText ?? "Cancel"}
                confirmVariant={confirmState?.confirmVariant ?? "danger"}
                loading={confirmLoading}
            />

            <Modal
                isOpen={Boolean(cancelModal)}
                onClose={closeCancelModal}
                title="Cancel Booking"
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={closeCancelModal}
                            disabled={
                                cancelModal?.submitting
                            }
                        >
                            Keep Booking
                        </Button>
                        <Button
                            variant="danger"
                            loading={
                                cancelModal?.submitting
                            }
                            onClick={submitCancelBooking}
                        >
                            Cancel Booking
                        </Button>
                    </>
                }
            >
                {cancelModal && (
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                            Cancel your{" "}
                            {getVehicleName(booking?.vehicle)}{" "}
                            booking? This action cannot be undone.
                        </p>

                        {booking?._id && (
                            <CancellationRefundNotice
                                bookingId={booking._id}
                            />
                        )}

                        <CancelReasonChips
                            value={cancelModal.reason ?? ""}
                            disabled={cancelModal.submitting}
                            onSelect={(reason) =>
                                setCancelModal((current) =>
                                    current ? { ...current, reason } : current
                                )
                            }
                        />

                        <Textarea
                            label="Reason"
                            required={
                                cancelReasonRequired
                            }
                            rows={3}
                            value={
                                cancelModal.reason ?? ""
                            }
                            onChange={(event) =>
                                setCancelModal(
                                    (current) =>
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
                            placeholder="Let us know why you're cancelling..."
                        />
                    </div>
                )}
            </Modal>
        </main>
    );
};

export default BookingDetails;
