import {
    AlertTriangle,
    Gift,
    Calendar,
    CalendarClock,
    CalendarOff,
    Car,
    CheckCircle2,
    ChevronRight,
    ClipboardCheck,
    Clock,
    Compass,
    Copy,
    CreditCard,
    Eye,
    Fuel,
    Gauge,
    Heart,
    Hourglass,
    KeyRound,
    MapPin,
    MessageSquarePlus,
    Navigation,
    RefreshCw,
    Sparkles,
    Star,
    Users,
    Wallet,
    XCircle,
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import { reconcilePayment } from "../../api/paymentApi";
import {
    isPastCancellationCutoff,
    canCustomerReschedule,
    getPendingReschedule,
    getReservationPaymentDeadline,
} from "../../constants/bookingStatus";

import Button from "../../components/common/Button";
import Modal from "../../components/common/Modal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Textarea from "../../components/common/Textarea";
import StatusChip from "../../components/common/StatusChip";
import PillTabs from "../../components/common/PillTabs";
import ExtensionRequestModal from "../../components/modals/ExtensionRequestModal";
import RescheduleModal from "../../components/modals/RescheduleModal";
import RequestRefundModal from "../../components/modals/RequestRefundModal";
import CancellationRefundNotice from "../../components/booking/CancellationRefundNotice";
import PolicySourceNote from "../../components/legal/PolicySourceNote";
import CancelReasonChips from "../../components/booking/CancelReasonChips";
import FeaturedVehicleCard from "../../components/vehicle/FeaturedVehicleCard";
import RefundStatus from "../../components/payment/RefundStatus";
import ReturnTimingNote from "../../components/booking/ReturnTimingNote";
import MaintenanceConflictNotice from "../../components/booking/MaintenanceConflictNotice";
import { hasOpenMaintenanceConflict } from "../../constants/maintenanceConflict";
import { getDueBackAt } from "../../utils/returnTiming";
import { getDiscountBadgeText } from "../../utils/vehicleDiscount";
import LightTexture from "../../components/sections/LightTexture";

import heroImage from "../../assets/images/hero/MorePossibilities.png";

import useBooking from "../../hooks/bookings/useBooking";
import useRental from "../../hooks/rentals/useRental";
import useVoucher from "../../hooks/promotions/useVoucher";
import useToast from "../../hooks/toast/useToast";
import useFavorite from "../../hooks/useFavorite";
import useAuth from "../../hooks/auth/useAuth";
import usePublicRefundSettings from "../../hooks/settings/usePublicRefundSettings";

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

const formatDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        return "—";
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime())
    ) {
        return "—";
    }

    return `${start.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
    })} – ${end.toLocaleDateString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
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

const toValidDate = (value) => {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
};

const formatDay = (value) =>
    toValidDate(value)?.toLocaleDateString("en-PH", {
        weekday: "short",
        month: "short",
        day: "numeric",
    }) ?? "—";

const formatTime = (value) =>
    toValidDate(value)?.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
    }) ?? "";

/* Prefer the priced day count; fall back to the date span. */
const getRentalDays = (booking) => {
    const priced = Number(booking?.pricing?.rentalDays);

    if (priced > 0) {
        return priced;
    }

    const start = toValidDate(booking?.startDate);
    const end = toValidDate(booking?.endDate);

    if (!start || !end || end <= start) {
        return null;
    }

    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
};

/* Bookings in these statuses are done — they live in the dock's compact
   history views, not the main working grid. */
const TERMINAL_STATUSES = ["Completed", "Cancelled", "Rejected", "Expired", "No Show"];

/* No-shows share the Expired tile: both are bookings that lapsed without a trip. */
const LAPSED_STATUSES = ["Expired", "No Show"];

/* Refund requests stay visible for a limited window after the vehicle is
   returned — configurable by admin (Settings > Refunds). Kept at module
   scope (rather than as a component closure) since it reads the system
   clock, which the render pass itself must stay free of. */
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

/* Lets the customer close out their own trip once the vehicle's back,
   instead of waiting on staff — unlocks the Rate Your Trip page. Also
   requires the vehicle outcome to already be set: it's a separate,
   deliberate admin decision (made after inspecting the return) that
   determines whether the vehicle goes back to Available or Maintenance,
   and completeRental refuses to run without it — showing the button any
   earlier would just walk the customer into that error. */
const canMarkCompleted = (booking) =>
    booking?.status === "Ongoing" &&
    Boolean(booking?.rental?.return?.date) &&
    Boolean(booking?.rental?.vehicleOutcome) &&
    isDepositResolved(booking);

const getVehicleName = (vehicle) => {
    if (!vehicle) {
        return "—";
    }

    const name = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");

    return name || vehicle.vehicleCode || "—";
};

const getVehicleImage = (vehicle) => {
    const images = vehicle?.images;

    if (!Array.isArray(images) || images.length === 0) {
        return null;
    }

    return (
        images.find((image) => image?.isPrimary)?.url ??
        images[0]?.url ??
        null
    );
};

/*
 * Also offered when the customer cancelled their own payment attempt on a
 * booking that is still Pending: the server reopens it if the payment
 * window hasn't closed, and explains if it has. Never for a booking that
 * has already ended — a lapsed booking's leftover payment can't be paid.
 */
const canPayNow = (booking) =>
    Boolean(booking?.paymentId) &&
    !TERMINAL_STATUSES.includes(booking?.status) &&
    (booking?.paymentStatus === "PENDING" ||
        (booking?.paymentStatus === "CANCELLED" &&
            booking?.status === "Pending")) &&
    booking?.paymentMethod === "GCASH";

/*
 * A GCash extension fee is payable online the same way the reservation
 * fee is; one chosen "Cash on Pickup" (inherited from how the original
 * reservation fee was paid — see approveBookingExtension in
 * bookingService.js) has no online step and is only ever settled in
 * person, so no "Pay" button for it here.
 */
const canPayExtensionFee = (booking) =>
    Boolean(booking?.extensionPaymentId) &&
    booking?.extensionPaymentStatus === "PENDING" &&
    booking?.extensionPaymentMethod === "GCASH" &&
    booking?.status !== "Cancelled";

/* The extension-fee payment also collects a reschedule's extra days and a
   vehicle change's price difference (extensionPaymentPurpose). */
const EXTENSION_FEE_NAMES = {
    extension: "Extension fee",
    reschedule: "Reschedule difference",
    vehicleChange: "Vehicle change difference",
};

const getExtensionFeeName = (booking) =>
    EXTENSION_FEE_NAMES[booking?.extensionPaymentPurpose] ??
    EXTENSION_FEE_NAMES.extension;

const RESERVATION_FEE_CHIPS = {
    VERIFIED: { tone: "emerald", label: "Reservation fee paid" },
    PENDING: { tone: "orange", label: "Reservation fee pending" },
    REFUNDED: { tone: "sky", label: "Reservation fee refunded" },
    CANCELLED: { tone: "gray", label: "Payment cancelled" },
};

const getExtensionFeeChip = (booking) => {
    const name = getExtensionFeeName(booking);

    switch (booking?.extensionPaymentStatus) {
        case "VERIFIED":
            return { tone: "emerald", label: `${name} paid` };
        case "REFUNDED":
            return { tone: "sky", label: `${name} refunded` };
        case "PENDING":
            return {
                tone: "orange",
                label:
                    booking.extensionPaymentMethod === "GCASH"
                        ? `${name} due (${formatCurrency(booking.extensionPaymentAmount)})`
                        : `${name} due at pickup`,
            };
        default:
            return { tone: "gray", label: `${name} cancelled` };
    }
};

const hasPendingExtension = (booking) =>
    Array.isArray(booking?.extensions) &&
    booking.extensions.some(
        (extension) => extension?.status === "Pending"
    );

const isExtensionEligible = (booking) =>
    (booking?.status === "Approved" ||
        booking?.status === "Ongoing") &&
    !booking?.rental?.return?.date;

const canCancel = (status) =>
    status === "Pending" ||
    status === "Payment Received" ||
    status === "Approved";

const needsAction = (booking) =>
    canPayNow(booking) ||
    canPayExtensionFee(booking) ||
    canMarkCompleted(booking) ||
    hasOpenMaintenanceConflict(booking);

/* Filters for the active-trips list. */
const TRIP_FILTERS = [
    { value: "all", label: "All", match: () => true },
    { value: "action", label: "Needs action", match: needsAction },
    {
        value: "awaiting",
        label: "Awaiting approval",
        match: (booking) =>
            ["Pending", "Payment Received"].includes(booking?.status),
    },
    {
        value: "upcoming",
        label: "Upcoming",
        match: (booking) => booking?.status === "Approved",
    },
    {
        value: "ongoing",
        label: "On the road",
        match: (booking) => booking?.status === "Ongoing",
    },
];

/* Full class strings per tone, so Tailwind can see them. */
const TONES = {
    yellow: {
        rail: "bg-yellow-400",
        panel: "border-yellow-200 bg-yellow-50 dark:border-yellow-500/20 dark:bg-yellow-500/10",
        icon: "bg-yellow-400 text-gray-950",
        title: "text-yellow-900 dark:text-yellow-200",
        text: "text-yellow-800/80 dark:text-yellow-100/70",
        soft: "bg-yellow-100 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-300",
    },
    orange: {
        rail: "bg-orange-500",
        panel: "border-orange-200 bg-orange-50 dark:border-orange-500/25 dark:bg-orange-500/10",
        icon: "bg-orange-500 text-white",
        title: "text-orange-900 dark:text-orange-200",
        text: "text-orange-800/80 dark:text-orange-100/70",
        soft: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    },
    sky: {
        rail: "bg-sky-500",
        panel: "border-sky-200 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10",
        icon: "bg-sky-500 text-white",
        title: "text-sky-900 dark:text-sky-200",
        text: "text-sky-800/80 dark:text-sky-100/70",
        soft: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    },
    emerald: {
        rail: "bg-emerald-500",
        panel: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
        icon: "bg-emerald-500 text-white",
        title: "text-emerald-900 dark:text-emerald-200",
        text: "text-emerald-800/80 dark:text-emerald-100/70",
        soft: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    },
    red: {
        rail: "bg-red-500",
        panel: "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10",
        icon: "bg-red-500 text-white",
        title: "text-red-900 dark:text-red-200",
        text: "text-red-800/80 dark:text-red-100/70",
        soft: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    },
    rose: {
        rail: "bg-rose-500",
        panel: "border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10",
        icon: "bg-rose-500 text-white",
        title: "text-rose-900 dark:text-rose-200",
        text: "text-rose-800/80 dark:text-rose-100/70",
        soft: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    },
    gray: {
        rail: "bg-gray-300 dark:bg-gray-600",
        panel: "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40",
        icon: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
        title: "text-gray-900 dark:text-gray-100",
        text: "text-gray-600 dark:text-gray-400",
        soft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    },
};

/* 90 min → "2 hrs", 3 days → "3 days" — coarse, for countdown chips. */
const formatSpan = (ms) => {
    const minutes = Math.max(1, Math.round(ms / (60 * 1000)));

    if (minutes < 60) {
        return `${minutes} min`;
    }

    const hours = Math.round(minutes / 60);

    if (hours < 24) {
        return `${hours} hr${hours === 1 ? "" : "s"}`;
    }

    const days = Math.round(hours / 24);

    return `${days} day${days === 1 ? "" : "s"}`;
};

/* `now` comes from the page's clock state (0 = not started yet). */
const formatCountdown = (value, kind, now) => {
    const at = toValidDate(value)?.getTime();

    if (!now || !at) {
        return null;
    }

    const diff = at - now;

    if (diff > 0) {
        return {
            label: `${kind === "return" ? "Due back" : "Pickup"} in ${formatSpan(diff)}`,
            late: false,
        };
    }

    return kind === "return"
        ? { label: `${formatSpan(-diff)} overdue`, late: true }
        : { label: "Ready for pickup", late: false };
};

const countdownClass = (countdown) =>
    `rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        countdown.late
            ? "bg-red-600 text-white"
            : "bg-white/80 text-gray-800 ring-1 ring-gray-900/5 dark:bg-gray-950/40 dark:text-gray-100 dark:ring-white/10"
    }`;

/* The one thing a card leads with: where the trip stands, and what's next. */
const getTripStage = (booking) => {
    const start = booking?.startDate;
    const end = booking?.endDate;

    switch (booking?.status) {
        case "Ongoing":
            if (booking.rental?.return?.date) {
                return canMarkCompleted(booking)
                    ? {
                          tone: "emerald",
                          icon: CheckCircle2,
                          title: "Vehicle returned",
                          detail: "All set — mark the trip as completed to leave a review.",
                      }
                    : {
                          tone: "sky",
                          icon: ClipboardCheck,
                          title: "Vehicle returned",
                          detail: "We're wrapping up the return check. Nothing for you to do.",
                      };
            }

            return {
                tone: "emerald",
                icon: Navigation,
                title: "On the road",
                detail: `Due back ${formatDay(end)}, ${formatTime(end)}.`,
                countdown: { at: end, kind: "return" },
            };

        case "Approved":
            return {
                tone: "yellow",
                icon: KeyRound,
                title: "Confirmed — see you at pickup",
                detail: `${formatDay(start)}, ${formatTime(start)}. Bring your driver's license.`,
                countdown: { at: start, kind: "pickup" },
            };

        case "Payment Received":
            return {
                tone: "sky",
                icon: Hourglass,
                title: "Awaiting approval",
                detail: "Reservation fee received. We'll notify you once it's confirmed.",
            };

        case "Pending":
            return canPayNow(booking)
                ? {
                      tone: "orange",
                      icon: CreditCard,
                      title: "Reservation fee not paid",
                      detail: `Pay by ${formatDateTime(
                          getReservationPaymentDeadline(booking)
                      )} or the booking is released.`,
                  }
                : {
                      tone: "sky",
                      icon: Hourglass,
                      title: "Awaiting confirmation",
                      detail: "We're reviewing your booking.",
                  };

        default:
            return {
                tone: "gray",
                icon: Clock,
                title: booking?.status ?? "Booking",
                detail: "",
            };
    }
};

/* Archive tile icons on the dark header (always dark, so no light variants). */
const HEADER_TILE_ICONS = {
    gray: "bg-white/10 text-gray-300",
    red: "bg-red-400/15 text-red-300",
    rose: "bg-rose-400/15 text-rose-300",
    yellow: "bg-yellow-400/15 text-yellow-300",
};

/* Vehicle photo on a soft stage; whole vehicle shown, never cropped.
   `glass` is for the dark header, where a light stage would glare. */
const VehicleStage = ({ vehicle, className = "", imageClassName = "", glass = false }) => {
    const image = getVehicleImage(vehicle);

    return (
        <div
            className={`relative overflow-hidden ${
                glass
                    ? "bg-white/[0.06] ring-1 ring-white/10"
                    : "bg-gradient-to-b from-gray-50 to-gray-100 ring-1 ring-gray-900/5 dark:from-gray-800/70 dark:to-gray-900 dark:ring-white/5"
            } ${className}`}
        >
            {image ? (
                <img
                    src={image}
                    alt={getVehicleName(vehicle)}
                    className={`absolute inset-0 h-full w-full object-contain ${imageClassName}`}
                />
            ) : (
                <div
                    className={`absolute inset-0 flex items-center justify-center ${
                        glass ? "text-white/30" : "text-gray-300 dark:text-gray-600"
                    }`}
                >
                    <Car size={32} />
                </div>
            )}
        </div>
    );
};

/* Frosted-glass card over the header photo. No opacity animation may run on
   any ancestor — a fading parent breaks backdrop-blur while it plays. */
const GLASS_CARD =
    "relative overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-white shadow-xl shadow-black/30 backdrop-blur-xl";

/* The trip that matters most right now, in the header. */
const NextRideTicket = ({ booking, now, onViewDetails, onBrowse }) => {
    if (!booking) {
        return (
            <div className={`${GLASS_CARD} flex flex-col gap-3 p-4`}>
                <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                        Next ride
                    </p>
                    <p className="mt-2 text-base font-semibold tracking-tight">
                        Nothing booked yet
                    </p>
                </div>

                <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    fullWidth
                    onClick={onBrowse}
                    leftIcon={<Car size={15} />}
                >
                    Find a ride
                </Button>
            </div>
        );
    }

    const onTheRoad = booking.status === "Ongoing";
    const countdown = onTheRoad
        ? formatCountdown(booking.endDate, "return", now)
        : formatCountdown(booking.startDate, "pickup", now);

    return (
        <div className={GLASS_CARD}>
            <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
                    {onTheRoad ? "On the road" : "Next pickup"}
                </p>
                <StatusChip status={booking.status} size="sm" />
            </div>

            <VehicleStage
                vehicle={booking.vehicle}
                glass
                className="mx-3.5 mt-2.5 h-20 rounded-xl"
                imageClassName="px-3 py-1.5"
            />

            <div className="px-3.5 pb-2.5 pt-2.5">
                <p className="truncate text-sm font-semibold tracking-tight">
                    {getVehicleName(booking.vehicle)}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/65">
                    <Calendar size={11} />
                    {formatDateRange(booking.startDate, booking.endDate)}
                </p>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-dashed border-white/15 px-3.5 py-2.5">
                <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${
                        countdown?.late ? "text-red-300" : "text-white/90"
                    }`}
                >
                    <Clock size={12} />
                    {countdown?.label ??
                        (onTheRoad
                            ? `Due back ${formatDay(booking.endDate)}`
                            : formatDay(booking.startDate))}
                </span>

                <button
                    type="button"
                    onClick={() => onViewDetails(booking)}
                    className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-900 transition hover:bg-gray-100"
                >
                    Details
                    <ChevronRight size={12} />
                </button>
            </div>
        </div>
    );
};

/* Pickup → return, with where each happens. */
const TripRoute = ({ booking }) => {
    const rentalDays = getRentalDays(booking);
    const stops = [
        {
            key: "pickup",
            label: "Pickup",
            at: booking.startDate,
            address: booking.pickupLocation?.address,
            dot: "bg-yellow-400 ring-yellow-400/30",
        },
        {
            key: "return",
            label: "Return",
            at: booking.endDate,
            address: booking.returnLocation?.address,
            dot: "bg-gray-900 ring-gray-900/15 dark:bg-white dark:ring-white/20",
        },
    ];

    const renderStop = (stop, alignRight) => (
        <div className={`min-w-0 ${alignRight ? "text-right" : ""}`}>
            <p
                className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 ${
                    alignRight ? "justify-end" : ""
                }`}
            >
                <span className={`h-2 w-2 rounded-full ring-4 ${stop.dot}`} />
                {stop.label}
            </p>
            <p className="mt-1 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                {formatDay(stop.at)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatTime(stop.at)}
            </p>
            {stop.address && (
                <p
                    className={`mt-1 flex items-center gap-1 truncate text-xs text-gray-500 dark:text-gray-400 ${
                        alignRight ? "justify-end" : ""
                    }`}
                    title={stop.address}
                >
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate">{stop.address}</span>
                </p>
            )}
        </div>
    );

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-gray-50 px-3.5 py-3 ring-1 ring-gray-200/70 dark:bg-gray-800/40 dark:ring-gray-800 sm:grid-cols-[minmax(0,1fr)_minmax(6rem,10rem)_minmax(0,1fr)] sm:gap-3 sm:px-4">
            {renderStop(stops[0], false)}

            <div className="flex items-center gap-1.5">
                <span aria-hidden="true" className="hidden h-px flex-1 border-t-2 border-dotted border-gray-300 dark:border-gray-600 sm:block" />
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 shadow-2xs ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                    <Car size={11} />
                    {rentalDays
                        ? `${rentalDays} day${rentalDays === 1 ? "" : "s"}`
                        : "—"}
                </span>
                <span aria-hidden="true" className="hidden h-px flex-1 border-t-2 border-dotted border-gray-300 dark:border-gray-600 sm:block" />
            </div>

            {renderStop(stops[1], true)}
        </div>
    );
};

const ToneChip = ({ tone = "gray", children, title }) => (
    <span
        title={title}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            (TONES[tone] ?? TONES.gray).soft
        }`}
    >
        {children}
    </span>
);

/* One active booking, laid out like a rental ticket: vehicle, trip, stub. */
const TripCard = ({
    booking,
    index,
    now,
    noShowGraceHours,
    refundWindowHours,
    completing,
    onViewDetails,
    onPay,
    onCancel,
    onReschedule,
    onExtend,
    onRefund,
    onWithdrawRefund,
    onMarkCompleted,
    onMaintenanceChanged,
}) => {
    const vehicleLink = `/vehicles/${booking.vehicle?._id ?? booking.vehicle?.id}`;
    const stage = getTripStage(booking);
    const tone = TONES[stage.tone] ?? TONES.gray;
    const StageIcon = stage.icon;
    const countdown = stage.countdown
        ? formatCountdown(stage.countdown.at, stage.countdown.kind, now)
        : null;

    const specs = [
        booking.vehicle?.specifications?.transmission && {
            icon: Gauge,
            label: booking.vehicle.specifications.transmission,
        },
        booking.vehicle?.specifications?.fuelType && {
            icon: Fuel,
            label: booking.vehicle.specifications.fuelType,
        },
        booking.vehicle?.specifications?.seatingCapacity && {
            icon: Users,
            label: `${booking.vehicle.specifications.seatingCapacity} seats`,
        },
        booking.driverOption && {
            icon: Car,
            label:
                booking.driverOption === "With Driver"
                    ? "With driver"
                    : "Self-drive",
        },
    ].filter(Boolean);

    const pastCutoff = isPastCancellationCutoff(booking, noShowGraceHours, now);
    const pendingReschedule = getPendingReschedule(booking);
    const extensionPending = hasPendingExtension(booking);
    const pendingRefund = getPendingRefund(booking);
    const balance = Number(booking.rental?.financial?.balance);

    /* The stub leads with the single most useful action. */
    let primary = null;

    if (canPayNow(booking)) {
        primary = (
            <Button
                type="button"
                variant="brand"
                fullWidth
                onClick={() => onPay(booking.paymentId)}
                leftIcon={<CreditCard size={16} />}
            >
                Pay reservation fee
            </Button>
        );
    } else if (canPayExtensionFee(booking)) {
        primary = (
            <Button
                type="button"
                variant="brand"
                fullWidth
                onClick={() => onPay(booking.extensionPaymentId)}
                leftIcon={<CreditCard size={16} />}
            >
                {booking.extensionPaymentPurpose === "extension" ||
                !booking.extensionPaymentPurpose
                    ? "Pay extension fee"
                    : "Pay the difference"}
            </Button>
        );
    } else if (canMarkCompleted(booking)) {
        primary = (
            <Button
                type="button"
                variant="success"
                fullWidth
                loading={completing}
                onClick={() => onMarkCompleted(booking)}
                leftIcon={<CheckCircle2 size={16} />}
            >
                Mark as completed
            </Button>
        );
    }

    const secondary = [
        primary && (
            <Button
                key="details"
                type="button"
                size="sm"
                variant="outline"
                fullWidth
                onClick={() => onViewDetails(booking)}
                leftIcon={<Eye size={15} />}
            >
                Details
            </Button>
        ),
        !pendingReschedule &&
            canCustomerReschedule(booking, now) && (
                <Button
                    key="reschedule"
                    type="button"
                    size="sm"
                    variant="outline"
                    fullWidth
                    onClick={() => onReschedule(booking)}
                    leftIcon={<CalendarClock size={15} />}
                >
                    Reschedule
                </Button>
            ),
        isExtensionEligible(booking) &&
            !extensionPending && (
                <Button
                    key="extend"
                    type="button"
                    size="sm"
                    variant="outline"
                    fullWidth
                    onClick={() => onExtend(booking)}
                    leftIcon={<MessageSquarePlus size={15} />}
                >
                    Extend
                </Button>
            ),
        canRequestRefund(booking, refundWindowHours) && (
            <Button
                key="refund"
                type="button"
                size="sm"
                variant="outline"
                fullWidth
                onClick={() => onRefund(booking)}
                leftIcon={<Wallet size={15} />}
            >
                Refund
            </Button>
        ),
        pendingRefund && (
            <Button
                key="withdraw-refund"
                type="button"
                size="sm"
                variant="outline"
                fullWidth
                onClick={() => onWithdrawRefund(booking)}
                leftIcon={<XCircle size={15} />}
            >
                Withdraw refund
            </Button>
        ),
        canCancel(booking.status) && !pastCutoff && (
            <Button
                key="cancel"
                type="button"
                size="sm"
                variant="outline"
                fullWidth
                className="border-red-200! text-red-600! hover:bg-red-50! dark:border-red-500/30! dark:text-red-400! dark:hover:bg-red-500/10!"
                onClick={() => onCancel(booking)}
                leftIcon={<XCircle size={15} />}
            >
                Cancel
            </Button>
        ),
    ].filter(Boolean);

    return (
        <article
            style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
            className="bk-card-in group relative flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-[0_24px_48px_-28px_rgba(15,23,42,0.35)] dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-[0_24px_48px_-28px_rgba(0,0,0,0.8)] lg:flex-row"
        >
            {/* Stage colour rail */}
            <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 z-10 w-1 ${tone.rail}`}
            />

            {/* Vehicle */}
            <Link
                to={vehicleLink}
                className="relative m-3 mb-0 block shrink-0 lg:mb-3 lg:mr-0 lg:w-72"
            >
                <VehicleStage
                    vehicle={booking.vehicle}
                    className="h-44 rounded-2xl lg:h-full lg:min-h-[13rem]"
                    imageClassName="px-4 pb-6 pt-10 transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {/* The road it sits on */}
                <span
                    aria-hidden="true"
                    className="absolute inset-x-6 bottom-4 border-t-2 border-dashed border-gray-300/80 dark:border-gray-700"
                />
                <span className="absolute left-3 top-3">
                    <StatusChip status={booking.status} size="sm" />
                </span>
            </Link>

            {/* Trip */}
            <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            <Link
                                to={vehicleLink}
                                className="transition-colors hover:text-yellow-600 dark:hover:text-yellow-400"
                            >
                                {getVehicleName(booking.vehicle)}
                            </Link>
                        </h3>
                        {specs.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                                {specs.map(({ icon: SpecIcon, label }) => (
                                    <span key={label} className="inline-flex items-center gap-1">
                                        <SpecIcon size={12} />
                                        {label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <RefundStatus booking={booking} rental={booking.rental} />
                        {!extensionPending &&
                            booking.extensions?.length > 0 && (
                                <ToneChip tone="yellow">
                                    Extended ×{booking.extensions.length}
                                </ToneChip>
                            )}
                    </div>
                </div>

                {/* Where things stand */}
                <div className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${tone.panel}`}>
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}>
                        <StageIcon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${tone.title}`}>
                            {stage.title}
                        </p>
                        {stage.detail && (
                            <p className={`mt-0.5 text-xs ${tone.text}`}>
                                {stage.detail}
                            </p>
                        )}
                        {/* Phones: under the text, so it doesn't squeeze it */}
                        {countdown && (
                            <span className={`mt-2 inline-flex sm:hidden ${countdownClass(countdown)}`}>
                                {countdown.label}
                            </span>
                        )}
                    </div>
                    {countdown && (
                        <span className={`hidden shrink-0 self-center sm:inline-flex ${countdownClass(countdown)}`}>
                            {countdown.label}
                        </span>
                    )}
                </div>

                <TripRoute booking={booking} />

                {hasOpenMaintenanceConflict(booking) && (
                    <MaintenanceConflictNotice
                        booking={booking}
                        compact
                        onChanged={onMaintenanceChanged}
                    />
                )}

                {booking.status === "Ongoing" &&
                    !booking.rental?.return?.date &&
                    Number.isFinite(booking.rental?.pickup?.fuelLevel) && (
                        <p className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                            <Fuel size={14} className="shrink-0" />
                            Fuel was at {booking.rental.pickup.fuelLevel}% at
                            pickup — please return with the same level to
                            avoid additional charges.
                        </p>
                    )}
            </div>

            {/* Stub — perforated off the trip */}
            <div className="relative flex shrink-0 flex-col gap-4 border-t border-dashed border-gray-200 p-4 sm:p-5 dark:border-gray-800 lg:w-80 lg:border-l lg:border-t-0">
                <span
                    aria-hidden="true"
                    className="absolute -left-3 -top-3 hidden h-6 w-6 rounded-full border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:block"
                />
                <span
                    aria-hidden="true"
                    className="absolute -bottom-3 -left-3 hidden h-6 w-6 rounded-full border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 lg:block"
                />

                <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                        Trip total
                    </p>
                    <p className="mt-0.5 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                        {formatCurrency(booking.pricing?.totalAmount)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {booking.paymentStatus && !canPayNow(booking) && (
                            <ToneChip
                                tone={
                                    RESERVATION_FEE_CHIPS[booking.paymentStatus]
                                        ?.tone ?? "gray"
                                }
                            >
                                {RESERVATION_FEE_CHIPS[booking.paymentStatus]
                                    ?.label ?? "Payment cancelled"}
                            </ToneChip>
                        )}

                        {booking.extensionPaymentStatus && (
                            <ToneChip tone={getExtensionFeeChip(booking).tone}>
                                {getExtensionFeeChip(booking).label}
                            </ToneChip>
                        )}

                        {balance > 0 && (
                            <ToneChip
                                tone="orange"
                                title="The rest of the rental cost, separate from the reservation fee — settled at pickup."
                            >
                                {formatCurrency(balance)} due at pickup
                            </ToneChip>
                        )}

                        {pendingReschedule && (
                            <ToneChip tone="sky">
                                <Clock size={11} />
                                Reschedule under review
                            </ToneChip>
                        )}

                        {isExtensionEligible(booking) && extensionPending && (
                            <ToneChip tone="sky">
                                <Clock size={11} />
                                Extension under review
                            </ToneChip>
                        )}
                    </div>
                </div>

                <div className="mt-auto flex flex-col gap-2">
                    {primary ?? (
                        <Button
                            type="button"
                            variant="dark"
                            fullWidth
                            onClick={() => onViewDetails(booking)}
                            leftIcon={<Eye size={16} />}
                        >
                            View details
                        </Button>
                    )}

                    {secondary.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 [&>*:last-child:nth-child(odd)]:col-span-2">
                            {secondary}
                        </div>
                    )}

                    {pastCutoff && (
                        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            It's pickup day, so this booking can no longer be
                            cancelled. Can't make it?{" "}
                            <Link
                                to="/customer/customer-service"
                                className="font-semibold text-gray-700 underline underline-offset-2 dark:text-gray-200"
                            >
                                Contact us
                            </Link>{" "}
                            — a booking that isn't picked up is marked as a
                            no-show.
                        </p>
                    )}
                </div>
            </div>
        </article>
    );
};

/* Placeholder card shaped like a TripCard while the first load runs. */
const TripCardSkeleton = () => (
    <div className="flex flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:flex-row">
        <div className="bk-shimmer m-3 mb-0 h-44 rounded-2xl lg:mb-3 lg:mr-0 lg:h-auto lg:min-h-[13rem] lg:w-72" />
        <div className="flex flex-1 flex-col gap-3 p-5">
            <div className="bk-shimmer h-5 w-48 rounded" />
            <div className="bk-shimmer h-3 w-64 rounded" />
            <div className="bk-shimmer h-14 w-full rounded-2xl" />
            <div className="bk-shimmer h-20 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-3 border-t border-dashed border-gray-200 p-5 dark:border-gray-800 lg:w-80 lg:border-l lg:border-t-0">
            <div className="bk-shimmer h-3 w-20 rounded" />
            <div className="bk-shimmer h-7 w-32 rounded" />
            <div className="bk-shimmer mt-auto h-11 w-full rounded-lg" />
        </div>
    </div>
);

/* Small helper for the empty-state rows shared by the list modals */
const EmptyRow = ({ icon: Icon, label }) => (
    <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Icon size={26} className="text-gray-400 dark:text-gray-500" />
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            {label}
        </p>
    </div>
);

/* Shared row used inside the Cancelled / Rejected / Expired / History modals */
const BookingListRow = ({
    booking,
    onViewDetails,
    onReview,
    showReview = false,
    onRequestRefund,
    refundEligible = false,
    onWithdrawRefund,
    pendingRefund = null,
}) => (
    <div
        role="button"
        tabIndex={0}
        className="group cursor-pointer rounded-2xl border border-gray-200 bg-white p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-[0_12px_30px_-16px_rgba(15,23,42,0.3)] focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
        onClick={() => onViewDetails?.(booking)}
        onKeyDown={(event) => {
            if (
                event.target === event.currentTarget &&
                (event.key === "Enter" || event.key === " ")
            ) {
                event.preventDefault();
                onViewDetails?.(booking);
            }
        }}
    >
        <div className="flex items-center gap-3">
            <VehicleStage
                vehicle={booking.vehicle}
                className="h-14 w-20 shrink-0 rounded-xl"
                imageClassName="p-1"
            />

            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                    <Link
                        to={`/vehicles/${booking.vehicle?._id ?? booking.vehicle?.id}`}
                        onClick={(event) => event.stopPropagation()}
                        className="transition-colors hover:text-yellow-600 dark:hover:text-yellow-400"
                    >
                        {getVehicleName(booking.vehicle)}
                    </Link>
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <Clock size={12} />
                    {formatDateRange(booking.startDate, booking.endDate)}
                </p>
            </div>

            <div className="shrink-0 text-right">
                <p className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(booking.pricing?.totalAmount)}
                </p>
                <div className="mt-1 flex flex-col items-end gap-1">
                    <StatusChip status={booking.status} size="sm" dot={false} />
                    <RefundStatus booking={booking} rental={booking.rental} />
                </div>
            </div>
        </div>

        {(showReview || refundEligible || pendingRefund || onViewDetails) && (
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                {showReview && onReview && (
                    <Button
                        type="button"
                        size="sm"
                        variant="brand"
                        onClick={(event) => {
                            event.stopPropagation();
                            onReview(booking);
                        }}
                        leftIcon={<Star size={14} />}
                    >
                        Review
                    </Button>
                )}
                {refundEligible && onRequestRefund && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                            event.stopPropagation();
                            onRequestRefund(booking);
                        }}
                        leftIcon={<Wallet size={14} />}
                    >
                        Refund
                    </Button>
                )}
                {pendingRefund && onWithdrawRefund && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                            event.stopPropagation();
                            onWithdrawRefund(booking);
                        }}
                        leftIcon={<XCircle size={14} />}
                    >
                        Withdraw refund
                    </Button>
                )}
                {onViewDetails && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                            event.stopPropagation();
                            onViewDetails(booking);
                        }}
                        leftIcon={<Eye size={14} />}
                    >
                        Details
                    </Button>
                )}
            </div>
        )}
    </div>
);

const Bookings = () => {
    const navigate = useNavigate();

    const {
        bookings = [],
        loading = false,
        fetchBookings,
        fetchBookingById,
        cancelExistingBooking,
        requestExistingBookingExtension,
        cancelExistingBookingExtension,
    } = useBooking();

    const {
        completeAsCustomer,
        submitRefundRequest,
        withdrawRefundRequest,
    } = useRental();

    const {
        availableVouchers,
        fetchAvailableVouchers,
    } = useVoucher();

    const {
        favorites,
        fetchUserFavorites,
    } = useFavorite();

    const toast = useToast();

    const { user } = useAuth();
    const firstName = user?.firstName?.trim() || "";

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

    const [selectedBooking, setSelectedBooking] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [voucherModalOpen, setVoucherModalOpen] = useState(false);
    const [favoritesModalOpen, setFavoritesModalOpen] = useState(false);
    const [cancelledModalOpen, setCancelledModalOpen] = useState(false);
    const [rejectedModalOpen, setRejectedModalOpen] = useState(false);
    const [expiredModalOpen, setExpiredModalOpen] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [extensionModalOpen, setExtensionModalOpen] = useState(false);
    const [extensionTarget, setExtensionTarget] = useState(null);
    const [extensionSubmitting, setExtensionSubmitting] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState(null);
    const [copiedCode, setCopiedCode] = useState(null);
    const [payNowLoading, setPayNowLoading] = useState(false);
    const [confirmState, setConfirmState] = useState(null);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [cancelModal, setCancelModal] = useState(null);
    const [refundModal, setRefundModal] = useState(null);
    const [completingId, setCompletingId] = useState(null);
    const [activeFilter, setActiveFilter] = useState("all");
    const tripsRef = useRef(null);

    /* From the header: switch the list filter and bring the list into view. */
    const showFilter = (value) => {
        setActiveFilter(value);
        tripsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    /*
     * The booking slice shares one `loading`/`error` across every action
     * (cancel, extension, fetch by id…), so this page tracks its own list
     * load: a failed cancel shouldn't read as "couldn't load bookings", and
     * a background refresh shouldn't blank the list.
     */
    const [loadError, setLoadError] = useState(null);
    const [hasLoaded, setHasLoaded] = useState(false);

    const refreshBookings = useCallback(async () => {
        const result = await fetchBookings({});

        if (result?.meta?.requestStatus === "rejected") {
            setLoadError(
                typeof result.payload === "string"
                    ? result.payload
                    : "Unable to load bookings."
            );
        } else {
            setLoadError(null);
        }

        setHasLoaded(true);
    }, [fetchBookings]);

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
        } finally {
            setConfirmLoading(false);
        }
    };

    useEffect(() => {
        refreshBookings();
        fetchAvailableVouchers();
        fetchUserFavorites();
    }, [
        refreshBookings,
        fetchAvailableVouchers,
        fetchUserFavorites,
    ]);

    /*
     * A reservation fee paid on PayMongo normally shows here once the webhook
     * (or the payment result page) confirms it. If the customer came back
     * another way, or the webhook is late, ask PayMongo directly for any
     * pending payment whose checkout was opened, and refresh the cards when
     * one turns out paid. Each payment is checked at most every 30 seconds.
     */
    const reconcileCheckedAtRef = useRef(new Map());

    useEffect(() => {
        const nowMs = Date.now();

        const toCheck = bookings.filter(
            (booking) =>
                booking.paymentId &&
                booking.paymentStatus === "PENDING" &&
                booking.paymentCheckoutStarted &&
                booking.status === "Pending" &&
                nowMs -
                    (reconcileCheckedAtRef.current.get(
                        booking.paymentId
                    ) ?? 0) >
                    30 * 1000
        );

        if (toCheck.length === 0) {
            return undefined;
        }

        let active = true;

        toCheck.forEach((booking) =>
            reconcileCheckedAtRef.current.set(booking.paymentId, nowMs)
        );

        Promise.allSettled(
            toCheck.map((booking) => reconcilePayment(booking.paymentId))
        ).then((results) => {
            const anyPaid = results.some(
                (result) =>
                    result.status === "fulfilled" &&
                    (result.value?.data?.paid === true ||
                        result.value?.data?.payment?.status === "VERIFIED")
            );

            if (active && anyPaid) {
                refreshBookings();
            }
        });

        return () => {
            active = false;
        };
    }, [bookings, refreshBookings]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                refreshBookings();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
        };
    }, [refreshBookings]);

    const statusCounts = useMemo(() => {
        const counts = {
            All: bookings.length,
            Pending: 0,
            "Payment Received": 0,
            Approved: 0,
            Ongoing: 0,
            Completed: 0,
            Cancelled: 0,
            Rejected: 0,
            Expired: 0,
            "No Show": 0,
        };

        bookings.forEach((booking) => {
            if (Object.prototype.hasOwnProperty.call(counts, booking?.status)) {
                counts[booking.status] += 1;
            }
        });

        return counts;
    }, [bookings]);

    /* Active bookings only — completed/cancelled/rejected/expired trips
       live in the archive views instead, to keep this list tight. */
    const activeBookings = useMemo(
        () =>
            bookings.filter(
                (booking) => !TERMINAL_STATUSES.includes(booking?.status)
            ),
        [bookings]
    );

    const filterOptions = useMemo(
        () =>
            TRIP_FILTERS.map((filter) => ({
                value: filter.value,
                label: filter.label,
                count: activeBookings.filter(filter.match).length,
            })),
        [activeBookings]
    );

    const attentionCount =
        filterOptions.find((option) => option.value === "action")?.count ?? 0;

    /* A filter that empties out (e.g. the last payment was made) falls back
       to All rather than leaving an empty list behind. */
    const effectiveFilter =
        (filterOptions.find((option) => option.value === activeFilter)
            ?.count ?? 0) > 0
            ? activeFilter
            : "all";

    const filteredBookings = useMemo(() => {
        const filter =
            TRIP_FILTERS.find((item) => item.value === effectiveFilter) ??
            TRIP_FILTERS[0];

        return activeBookings.filter(filter.match);
    }, [activeBookings, effectiveFilter]);

    /*
     * The trip that matters most right now: one already on the road (due
     * back soonest), else the soonest confirmed or paid upcoming pickup.
     */
    const nextTrip = useMemo(() => {
        const byTime = (key) => (a, b) =>
            new Date(a[key]).getTime() - new Date(b[key]).getTime();

        const onTheRoad = bookings
            .filter(
                (booking) =>
                    booking?.status === "Ongoing" &&
                    !booking?.rental?.return?.date &&
                    booking?.endDate
            )
            .sort(byTime("endDate"))[0];

        if (onTheRoad) {
            return onTheRoad;
        }

        return (
            bookings
                .filter(
                    (booking) =>
                        ["Approved", "Payment Received"].includes(
                            booking?.status
                        ) && booking?.startDate
                )
                .sort(byTime("startDate"))[0] ?? null
        );
    }, [bookings]);

    const handleCancel = (booking) => {
        if (!booking?._id) {
            return;
        }

        setCancelModal({
            booking,
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
        if (!cancelModal?.booking?._id) {
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
            cancelModal.booking._id,
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

    const handleCopyCode = async (code) => {
        try {
            await navigator.clipboard.writeText(code);

            setCopiedCode(code);

            toast.success(`Voucher code "${code}" copied!`);

            setTimeout(() => {
                setCopiedCode(null);
            }, 2000);
        } catch {
            toast.error("Failed to copy code.");
        }
    };

    const handleRequestExtension = async (booking) => {
        if (!booking?._id) {
            return;
        }

        setExtensionTarget(booking);
        setExtensionModalOpen(true);
    };

    const handleExtensionSubmit = async (extensionData) => {
        if (!extensionTarget?._id) {
            return;
        }

        setExtensionSubmitting(true);

        /* A dispatched thunk never throws — check how it settled. */
        const result = await requestExistingBookingExtension(
            extensionTarget._id,
            extensionData
        );

        setExtensionSubmitting(false);

        if (result?.meta?.requestStatus !== "fulfilled") {
            toast.error(
                typeof result?.payload === "string"
                    ? result.payload
                    : "Unable to request extension.",
                "Error"
            );

            return;
        }

        toast.success(
            "Extension request submitted successfully.",
            "Success"
        );

        setExtensionModalOpen(false);
        setExtensionTarget(null);

        await refreshBookings();
    };

    const handleCustomerCancelExtension = (extensionId) => {
        if (!selectedBooking?._id) {
            return;
        }

        setConfirmState({
            title: "Cancel Extension Request",
            message: "Cancel this extension request?",
            confirmText: "Cancel Request",
            cancelText: "Keep Request",
            confirmVariant: "danger",
            onConfirm: async () => {
                const result = await cancelExistingBookingExtension(
                    selectedBooking._id,
                    extensionId,
                    "Cancelled by customer"
                );

                if (result?.meta?.requestStatus !== "fulfilled") {
                    toast.error(
                        typeof result?.payload === "string"
                            ? result.payload
                            : "Unable to cancel extension.",
                        "Error"
                    );

                    return;
                }

                toast.success(
                    "Extension request cancelled.",
                    "Success"
                );

                const fullBooking = await fetchBookingById(
                    selectedBooking._id
                );

                const refreshed =
                    fullBooking?.payload?.data ??
                    result.payload?.data;

                if (refreshed) {
                    setSelectedBooking(refreshed);
                }
            },
        });
    };

    const handleViewDetails = (booking) => {
        setSelectedBooking(booking);
        setDetailsModalOpen(true);
    };

    const handlePayNow = async () => {
        if (selectedBooking?.paymentId) {
            setPayNowLoading(true);
            setDetailsModalOpen(false);
            navigate(`/customer/checkout/${selectedBooking.paymentId}`);
            setTimeout(() => setPayNowLoading(false), 300);
        }
    };

    const handlePayExtensionNow = async () => {
        if (selectedBooking?.extensionPaymentId) {
            setPayNowLoading(true);
            setDetailsModalOpen(false);
            navigate(
                `/customer/checkout/${selectedBooking.extensionPaymentId}`
            );
            setTimeout(() => setPayNowLoading(false), 300);
        }
    };

    const handleTablePayNow = (paymentId) => {
        navigate(`/customer/checkout/${paymentId}`);
    };

    const handleReview = (booking) => {
        if (!booking?._id) {
            return;
        }

        navigate(`/customer/bookings/${booking._id}/rate`);
    };

    const handleOpenRefundModal = (booking) => {
        if (!booking?.rental?._id) {
            toast.error(
                "Refund requests aren't available for this booking yet."
            );

            return;
        }

        setRefundModal({
            booking,
            submitting: false,
        });
    };

    const closeRefundModal = () => {
        if (refundModal?.submitting) {
            return;
        }

        setRefundModal(null);
    };

    const submitRefundModal = async (refundData) => {
        const rentalId = refundModal?.booking?.rental?._id;

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
            refreshBookings();
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

    const handleMarkCompleted = async (booking) => {
        const rentalId = booking?.rental?._id;

        if (!rentalId) {
            return;
        }

        setCompletingId(booking._id);

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

            setCompletingId(null);
        }
    };

    const handleWithdrawRefund = (booking) => {
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

                    await refreshBookings();
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

    /* Trip archive — finished bookings and saved things, each in a modal */
    const archiveItems = [
        {
            key: "cancelled",
            label: "Cancelled",
            count: statusCounts["Cancelled"],
            icon: XCircle,
            tone: "gray",
            onClick: () => setCancelledModalOpen(true),
        },
        {
            key: "rejected",
            label: "Rejected",
            count: statusCounts["Rejected"],
            icon: XCircle,
            tone: "red",
            onClick: () => setRejectedModalOpen(true),
        },
        {
            key: "expired",
            label: "Expired & no-shows",
            count: statusCounts["Expired"] + statusCounts["No Show"],
            icon: CalendarOff,
            tone: "gray",
            onClick: () => setExpiredModalOpen(true),
        },
        {
            key: "favorites",
            label: "Favorites",
            count: favorites.length,
            icon: Heart,
            tone: "rose",
            onClick: () => setFavoritesModalOpen(true),
        },
        {
            key: "vouchers",
            label: "Vouchers",
            count: availableVouchers.length,
            icon: Gift,
            tone: "yellow",
            onClick: () => setVoucherModalOpen(true),
        },
    ];

    const headerStats = [
        {
            key: "awaiting",
            label: "Awaiting",
            value: statusCounts.Pending + statusCounts["Payment Received"],
            dot: "bg-sky-400",
            filter: "awaiting",
        },
        {
            key: "upcoming",
            label: "Upcoming",
            value: statusCounts.Approved,
            dot: "bg-yellow-400",
            filter: "upcoming",
        },
        {
            key: "ongoing",
            label: "On the road",
            value: statusCounts.Ongoing,
            dot: "bg-emerald-400",
            filter: "ongoing",
        },
        {
            key: "completed",
            label: "History",
            value: statusCounts.Completed,
            dot: "bg-gray-400",
            filter: null,
        },
    ];

    /* Skeletons only before the first load — later refreshes keep the list. */
    const showSkeleton = !hasLoaded && loading && bookings.length === 0;

    return (
        <>
            <style>{`
                @keyframes bk-fade-up {
                    from { opacity: 0; transform: translateY(14px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes bk-shimmer {
                    0% { background-position: -400px 0; }
                    100% { background-position: 400px 0; }
                }
                .bk-card-in {
                    animation: bk-fade-up 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                .bk-shimmer {
                    background-image: linear-gradient(
                        90deg,
                        rgba(15,23,42,0.05) 0px,
                        rgba(15,23,42,0.10) 40px,
                        rgba(15,23,42,0.05) 80px
                    );
                    background-size: 800px 100%;
                    animation: bk-shimmer 1.6s linear infinite;
                }
                [data-theme="dark"] .bk-shimmer {
                    background-image: linear-gradient(
                        90deg,
                        rgba(255,255,255,0.04) 0px,
                        rgba(255,255,255,0.09) 40px,
                        rgba(255,255,255,0.04) 80px
                    );
                }
                @media (prefers-reduced-motion: reduce) {
                    .bk-card-in, .bk-shimmer {
                        animation: none !important;
                    }
                }
            `}</style>

            {/*
              * Two stacked full-width <section>s, like the other public and
              * customer pages: site-texture.css gives each its own texture
              * (dark: dot grid + glows) and lit-seams draws the yellow seam
              * between them. Both need a `py-*` class (the seam's selector)
              * and, in dark mode, at least 3.5rem of padding at the seam —
              * it's painted inside that padding. Light mode has no seam, so
              * the gap stays tight there.
              */}
            <main className="relative isolate flex min-h-screen flex-col">
                <LightTexture
                    accent="yellow"
                    decorOnly
                    className="inset-x-0 top-0 -z-10 h-[48rem]"
                />

                <section className="px-4 py-14 pb-4 pt-24 sm:px-6 sm:pt-28 lg:px-8 dark:pb-14">
                <div className="mx-auto w-full max-w-7xl">
                    {/* Header — photo backdrop, archive tiles, and the trip that matters most */}
                    <div className="relative isolate overflow-hidden rounded-3xl bg-gray-950 text-white ring-1 ring-white/10">
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-cover bg-center"
                            style={{ backgroundImage: `url(${heroImage})` }}
                        />
                        <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-br from-gray-950/95 via-gray-950/85 to-gray-950/45"
                        />
                        <div
                            aria-hidden="true"
                            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-yellow-400/20 blur-3xl"
                        />

                        <div className="relative grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_14.5rem] lg:items-center lg:gap-8 lg:p-6">
                            <div>
                                <h1 className="text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                                    {firstName
                                        ? `Welcome back, ${firstName}.`
                                        : "Welcome back."}
                                    <span className="mt-0.5 block bg-gradient-to-r from-yellow-300 to-yellow-500 bg-clip-text text-transparent">
                                        Where to next in Albay?
                                    </span>
                                </h1>

                                {attentionCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => showFilter("action")}
                                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-semibold text-orange-200 ring-1 ring-orange-400/30 transition hover:bg-orange-500/25"
                                    >
                                        <AlertTriangle size={13} />
                                        {attentionCount} trip
                                        {attentionCount === 1 ? " needs" : "s need"} your
                                        attention
                                        <ChevronRight size={13} />
                                    </button>
                                )}

                                <div className="mt-4 grid max-w-xl grid-cols-2 gap-1.5 sm:grid-cols-4">
                                    {headerStats.map((stat) => (
                                        <button
                                            key={stat.key}
                                            type="button"
                                            onClick={() =>
                                                stat.filter
                                                    ? showFilter(stat.filter)
                                                    : setHistoryModalOpen(true)
                                            }
                                            disabled={stat.value === 0}
                                            className="rounded-xl bg-white/[0.06] px-2.5 py-1.5 text-left ring-1 ring-white/10 transition hover:bg-white/[0.1] disabled:cursor-default disabled:hover:bg-white/[0.06]"
                                        >
                                            <p className="text-base font-semibold tabular-nums">
                                                {stat.value}
                                            </p>
                                            <p className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400">
                                                <span className={`h-1.5 w-1.5 rounded-full ${stat.dot}`} />
                                                {stat.label}
                                            </p>
                                        </button>
                                    ))}
                                </div>

                                {/* Archive & saved — each opens its list */}
                                <div className="mt-1.5 grid max-w-xl grid-cols-3 gap-1.5 sm:grid-cols-5">
                                    {archiveItems.map((item) => {
                                        const Icon = item.icon;
                                        const isEmpty = item.count === 0;

                                        return (
                                            <button
                                                key={item.key}
                                                type="button"
                                                onClick={item.onClick}
                                                disabled={isEmpty}
                                                className="group flex min-w-0 flex-col rounded-xl bg-white/[0.06] px-2 py-1.5 text-left ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-white/[0.06]"
                                            >
                                                <span className="flex items-center justify-between">
                                                    <span
                                                        className={`flex h-5 w-5 items-center justify-center rounded-md ${
                                                            HEADER_TILE_ICONS[item.tone] ?? HEADER_TILE_ICONS.gray
                                                        }`}
                                                    >
                                                        <Icon size={11} />
                                                    </span>
                                                    <span className="text-sm font-semibold tabular-nums">
                                                        {item.count}
                                                    </span>
                                                </span>
                                                <span className="mt-1 truncate text-[10px] font-medium text-gray-400 group-hover:text-gray-200">
                                                    {item.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <Link
                                    to="/explore"
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-gray-300 transition hover:text-white"
                                >
                                    <MapPin size={13} />
                                    Explore Albay
                                </Link>
                            </div>

                            <NextRideTicket
                                booking={nextTrip}
                                now={now}
                                onViewDetails={handleViewDetails}
                                onBrowse={() => navigate("/vehicles")}
                            />
                        </div>
                    </div>
                </div>
                </section>

                {/* flex-1: the texture runs down to the footer on short pages */}
                <section className="flex-1 px-4 py-14 pt-4 sm:px-6 lg:px-8 dark:pt-14">
                <div className="mx-auto w-full max-w-7xl">
                    {/* Active trips */}
                    <div
                        ref={tripsRef}
                        className="flex scroll-mt-28 flex-wrap items-end justify-between gap-4"
                    >
                        <div>
                            <h2 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                                Active trips
                                {activeBookings.length > 0 && (
                                    <span className="rounded-full bg-yellow-100 px-2.5 py-0.5 text-sm font-semibold text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300">
                                        {activeBookings.length}
                                    </span>
                                )}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Upcoming and in-progress rides. Finished ones
                                are in the header above.
                            </p>
                        </div>

                        {activeBookings.length > 1 && (
                            <PillTabs
                                value={effectiveFilter}
                                onChange={setActiveFilter}
                                options={filterOptions.filter(
                                    (option) =>
                                        option.value === "all" ||
                                        option.count > 0
                                )}
                                size="sm"
                                tone="brand"
                                countTone="muted"
                                layoutId="customer-trip-filter"
                                label="Filter active trips"
                            />
                        )}
                    </div>

                    {loadError && (
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/25 dark:bg-red-500/10">
                            <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-300">
                                <AlertTriangle size={16} className="shrink-0" />
                                {loadError}
                            </p>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                loading={loading}
                                onClick={refreshBookings}
                                leftIcon={<RefreshCw size={14} />}
                            >
                                Try again
                            </Button>
                        </div>
                    )}

                    <div className="mt-5 flex flex-col gap-5">
                        {showSkeleton &&
                            Array.from({ length: 3 }).map((_, index) => (
                                <TripCardSkeleton key={index} />
                            ))}

                        {!showSkeleton &&
                            filteredBookings.map((booking, index) => (
                                <TripCard
                                    key={booking._id}
                                    booking={booking}
                                    index={index}
                                    now={now}
                                    noShowGraceHours={noShowGraceHours}
                                    refundWindowHours={refundWindowHours}
                                    completing={completingId === booking._id}
                                    onViewDetails={handleViewDetails}
                                    onPay={handleTablePayNow}
                                    onCancel={handleCancel}
                                    onReschedule={setRescheduleTarget}
                                    onExtend={handleRequestExtension}
                                    onRefund={handleOpenRefundModal}
                                    onWithdrawRefund={handleWithdrawRefund}
                                    onMarkCompleted={handleMarkCompleted}
                                    onMaintenanceChanged={refreshBookings}
                                />
                            ))}

                        {!showSkeleton &&
                            !loadError &&
                            activeBookings.length === 0 && (
                                <div className="relative isolate flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-gray-300 bg-white/60 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900/40">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-yellow-400 text-gray-950 shadow-lg shadow-yellow-500/25">
                                        <Car size={30} />
                                    </div>
                                    <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">
                                        {bookings.length === 0
                                            ? "Your first Albay ride starts here"
                                            : "No active trips right now"}
                                    </h3>
                                    <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                                        {bookings.length === 0
                                            ? "Pick a vehicle, choose your dates, and your booking shows up on this page."
                                            : "Past trips are in the tiles above. Ready for the next one?"}
                                    </p>
                                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                                        <Button
                                            type="button"
                                            variant="brand"
                                            onClick={() => navigate("/vehicles")}
                                            leftIcon={<Car size={16} />}
                                        >
                                            Browse vehicles
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => navigate("/explore")}
                                            leftIcon={<Compass size={16} />}
                                        >
                                            Explore Albay
                                        </Button>
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
                </section>
            </main>

            {/* ---------------------------------------------------------------- */}
            {/* Booking details modal                                              */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={detailsModalOpen}
                onClose={() => {
                    setDetailsModalOpen(false);
                    setSelectedBooking(null);
                }}
                title="Booking Details"
                size="lg"
                footer={
                    <div className="flex flex-wrap gap-3">
                        {canPayNow(selectedBooking) && (
                                <Button type="button" onClick={handlePayNow} loading={payNowLoading}>
                                    Pay Now
                                </Button>
                            )}
                        {canPayExtensionFee(selectedBooking) && (
                                <Button type="button" onClick={handlePayExtensionNow} loading={payNowLoading}>
                                    {selectedBooking?.extensionPaymentPurpose === "reschedule"
                                        ? "Pay Reschedule Difference"
                                        : selectedBooking?.extensionPaymentPurpose === "vehicleChange"
                                          ? "Pay Vehicle Difference"
                                          : "Pay Extension Fee"}
                                </Button>
                            )}
                        {getPendingReschedule(selectedBooking) ? (
                            <Button
                                type="button"
                                variant="outline"
                                disabled
                                title="Your reschedule request is awaiting review."
                                leftIcon={<Clock size={15} />}
                            >
                                Reschedule Pending
                            </Button>
                        ) : (
                            canCustomerReschedule(selectedBooking, now) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setRescheduleTarget(selectedBooking);
                                        setDetailsModalOpen(false);
                                        setSelectedBooking(null);
                                    }}
                                    leftIcon={<CalendarClock size={15} />}
                                >
                                    Reschedule
                                </Button>
                            )
                        )}
                        {selectedBooking?._id && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                    navigate(
                                        `/customer/bookings/${selectedBooking._id}`
                                    )
                                }
                            >
                                Open Full Page
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => {
                                setDetailsModalOpen(false);
                                setSelectedBooking(null);
                            }}
                        >
                            Close
                        </Button>
                    </div>
                }
            >
                {selectedBooking && (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <VehicleStage
                                vehicle={selectedBooking.vehicle}
                                className="h-20 w-28 shrink-0 rounded-2xl"
                                imageClassName="p-2"
                            />
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                                    {getVehicleName(selectedBooking.vehicle)}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Booked on{" "}
                                    {formatDateTime(selectedBooking.createdAt)}
                                </p>
                            </div>
                            <StatusChip status={selectedBooking.status} />
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Vehicle
                                </h4>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {getVehicleName(selectedBooking.vehicle)}
                                </p>
                                {selectedBooking.vehicle?.plateNumber && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Plate: {selectedBooking.vehicle.plateNumber}
                                    </p>
                                )}
                            </div>

                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Driver Option
                                </h4>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedBooking.driverOption === "With Driver"
                                        ? "With Driver"
                                        : "Without Driver"}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                Dates
                            </h4>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {selectedBooking.scheduledStartDate
                                            ? "Picked Up"
                                            : "Pickup"}
                                    </p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {formatDay(selectedBooking.startDate)}
                                        <span className="ml-1.5 text-sm font-normal text-gray-600 dark:text-gray-400">
                                            {formatTime(selectedBooking.startDate)}
                                        </span>
                                    </p>
                                </div>
                                <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {selectedBooking.rental?.return?.date
                                            ? "Returned"
                                            : selectedBooking.scheduledStartDate
                                              ? "Due Back"
                                              : "Return"}
                                    </p>
                                    <p className="font-medium text-gray-900 dark:text-white">
                                        {formatDay(
                                            selectedBooking.rental?.return?.date ??
                                                selectedBooking.endDate
                                        )}
                                        <span className="ml-1.5 text-sm font-normal text-gray-600 dark:text-gray-400">
                                            {formatTime(
                                                selectedBooking.rental?.return?.date ??
                                                    selectedBooking.endDate
                                            )}
                                        </span>
                                    </p>
                                    {selectedBooking.rental?.return?.date &&
                                        getDueBackAt(selectedBooking) && (
                                            <ReturnTimingNote
                                                dueBackAt={getDueBackAt(selectedBooking)}
                                                returnedAt={selectedBooking.rental.return.date}
                                                dueBackLabel={`${formatDay(
                                                    getDueBackAt(selectedBooking)
                                                )} ${formatTime(
                                                    getDueBackAt(selectedBooking)
                                                )}`}
                                            />
                                        )}
                                </div>
                            </div>
                            {selectedBooking.scheduledStartDate ? (
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Booked schedule:{" "}
                                    {formatDay(selectedBooking.scheduledStartDate)}{" "}
                                    {formatTime(selectedBooking.scheduledStartDate)} –{" "}
                                    {formatDay(selectedBooking.scheduledEndDate)}{" "}
                                    {formatTime(selectedBooking.scheduledEndDate)}. Your
                                    rental period started when the vehicle was handed
                                    over to you.
                                </p>
                            ) : (
                                ["Pending", "Payment Received", "Approved"].includes(
                                    selectedBooking.status
                                ) && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        Your rental period starts when the vehicle is
                                        handed over to you, and it's due back at the
                                        same time of day on your return date.
                                    </p>
                                )
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Pickup Location
                                </h4>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedBooking.pickupLocation?.address || "—"}
                                </p>
                            </div>

                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Return Location
                                </h4>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    {selectedBooking.returnLocation?.address || "—"}
                                </p>
                            </div>
                        </div>

                        <div>
                            <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                Pricing Breakdown
                            </h4>
                            <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Daily Rate</span>
                                        <span className="text-gray-900 dark:text-white">
                                            {selectedBooking.pricing?.vehicleDiscount && (
                                                <span className="mr-1.5 text-xs text-gray-400 line-through dark:text-gray-400">
                                                    {formatCurrency(selectedBooking.pricing.originalDailyRate)}
                                                </span>
                                            )}
                                            {formatCurrency(selectedBooking.pricing?.dailyRate)}
                                        </span>
                                    </div>
                                    {selectedBooking.pricing?.vehicleDiscount && (
                                        <div className="flex justify-between text-sm text-rose-600 dark:text-rose-400">
                                            <span>{getDiscountBadgeText(selectedBooking.pricing.vehicleDiscount)}</span>
                                            <span>−{formatCurrency(selectedBooking.pricing.vehicleDiscount.amountPerDay)}/day</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Rental Days</span>
                                        <span className="text-gray-900 dark:text-white">
                                            {selectedBooking.pricing?.rentalDays || "—"}{" "}
                                            {selectedBooking.pricing?.rentalDays === 1 ? "day" : "days"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                                        <span className="text-gray-900 dark:text-white">
                                            {formatCurrency(selectedBooking.pricing?.subtotal)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">
                                            Reservation Fee
                                        </span>
                                        <span className="text-gray-900 dark:text-white">
                                            {formatCurrency(selectedBooking.pricing?.reservationFee)}
                                        </span>
                                    </div>

                                    {selectedBooking.pricing?.pickupDistanceFee > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                Pickup Distance Fee
                                            </span>
                                            <span className="text-gray-900 dark:text-white">
                                                {formatCurrency(selectedBooking.pricing.pickupDistanceFee)}
                                            </span>
                                        </div>
                                    )}

                                    {selectedBooking.pricing?.returnDistanceFee > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-600 dark:text-gray-400">
                                                Return Distance Fee
                                            </span>
                                            <span className="text-gray-900 dark:text-white">
                                                {formatCurrency(selectedBooking.pricing.returnDistanceFee)}
                                            </span>
                                        </div>
                                    )}

                                    {selectedBooking.rental?.financial?.lateCharges > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-red-600 dark:text-red-400">Late Return Charge</span>
                                            <span className="text-red-600 dark:text-red-400">
                                                {formatCurrency(selectedBooking.rental.financial.lateCharges)}
                                            </span>
                                        </div>
                                    )}

                                    <div className="border-t border-gray-200 pt-2 dark:border-gray-800">
                                        <div className="flex justify-between">
                                            <span
                                                className="font-semibold text-gray-900 dark:text-white"
                                                
                                            >
                                                Total
                                            </span>
                                            <span
                                                className="font-bold text-gray-900 dark:text-white"
                                                
                                            >
                                                {formatCurrency(selectedBooking.pricing?.totalAmount)}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedBooking.rental?.lateReturn?.amount > 0 && (
                                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-500/25 dark:bg-red-500/10">
                                            <h4 className="mb-3 text-sm font-semibold text-red-600 dark:text-red-400">
                                                Late Return
                                            </h4>

                                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        Expected Return
                                                    </span>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {formatDateTime(
                                                            selectedBooking.rental.lateReturn.expectedReturnAt
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        Actual Return
                                                    </span>
                                                    <p className="font-medium text-gray-900 dark:text-white">
                                                        {formatDateTime(
                                                            selectedBooking.rental.lateReturn.actualReturnAt
                                                        )}
                                                    </p>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        Late Duration
                                                    </span>
                                                    <p className="font-medium text-red-600 dark:text-red-400">
                                                        {selectedBooking.rental.lateReturn.lateDurationMinutes}{" "}
                                                        minutes
                                                    </p>
                                                </div>

                                                <div>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        Charged Units
                                                    </span>
                                                    <p className="font-medium text-red-600 dark:text-red-400">
                                                        {selectedBooking.rental.lateReturn.chargedUnits}{" "}
                                                        {selectedBooking.rental.lateReturn.chargingUnit?.toLowerCase() ??
                                                            "hour"}
                                                        {selectedBooking.rental.lateReturn.chargedUnits === 1
                                                            ? ""
                                                            : "s"}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between rounded-lg border border-red-200 bg-white p-3 dark:border-red-500/25 dark:bg-gray-800/40">
                                                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                                                    Late Return Penalty
                                                </span>
                                                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                                                    {formatCurrency(selectedBooking.rental.lateReturn.amount)}
                                                </span>
                                            </div>

                                            <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                {selectedBooking.rental.lateReturn.gracePeriodMinutes > 0 && (
                                                    <p>
                                                        Grace period:{" "}
                                                        {selectedBooking.rental.lateReturn.gracePeriodMinutes}{" "}
                                                        minutes applied
                                                    </p>
                                                )}

                                                <p>
                                                    Rate: {formatCurrency(selectedBooking.rental.lateReturn.rate ?? 0)}{" "}
                                                    per{" "}
                                                    {selectedBooking.rental.lateReturn.chargingUnit?.toLowerCase() ??
                                                        "hour"}
                                                    {selectedBooking.rental.lateReturn.rateType
                                                        ? ` (${selectedBooking.rental.lateReturn.rateType})`
                                                        : ""}
                                                </p>

                                                <p>
                                                    Calculation:{" "}
                                                    {selectedBooking.rental.lateReturn.chargedUnits ?? 0}{" "}
                                                    {selectedBooking.rental.lateReturn.chargingUnit?.toLowerCase() ??
                                                        "hour"}
                                                    {(selectedBooking.rental.lateReturn.chargedUnits ?? 0) === 1
                                                        ? ""
                                                        : "s"}{" "}
                                                    × {formatCurrency(selectedBooking.rental.lateReturn.rate ?? 0)} ={" "}
                                                    {formatCurrency(selectedBooking.rental.lateReturn.amount)}
                                                </p>

                                                <PolicySourceNote
                                                    source={selectedBooking.rental.lateReturn.policySource}
                                                    version={selectedBooking.rental.lateReturn.termsVersion}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {selectedBooking.voucher && (
                                        <div className="mt-4 rounded-xl border border-yellow-300 bg-yellow-50 p-4 dark:border-yellow-500/20 dark:bg-yellow-500/10">
                                            <div className="mb-2 flex items-center gap-2">
                                                <Gift size={16} className="text-yellow-600 dark:text-yellow-400" />
                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                    Voucher Applied
                                                </h4>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                                    {selectedBooking.voucher.name || selectedBooking.voucher.code}
                                                </p>
                                                <p className="font-mono text-xs text-yellow-600 dark:text-yellow-400">
                                                    {selectedBooking.voucher.code}
                                                </p>
                                                {selectedBooking.voucher.discountAmount > 0 && (
                                                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                                        Discount:{" "}
                                                        {formatCurrency(selectedBooking.voucher.discountAmount)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {selectedBooking.extensions && selectedBooking.extensions.length > 0 && (
                                        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-800/40">
                                            <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                                Extensions
                                            </h4>

                                            <div className="space-y-3">
                                                {selectedBooking.extensions.map((ext, index) => (
                                                    <div
                                                        key={ext._id ?? index}
                                                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                Request #{index + 1}
                                                            </span>
                                                            <StatusChip
                                                                status={ext.status?.toLowerCase()}
                                                                size="sm"
                                                            />
                                                        </div>

                                                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                                                            <p>
                                                                Previous end:{" "}
                                                                {formatDateTime(ext.previousEndDate)}
                                                            </p>
                                                            <p>
                                                                Requested end:{" "}
                                                                {formatDateTime(ext.requestedEndDate)}
                                                            </p>
                                                            <p>
                                                                Additional: {ext.additionalHours} hour
                                                                {ext.additionalHours === 1 ? "" : "s"}
                                                            </p>
                                                            <p className="font-semibold text-gray-900 dark:text-white">
                                                                Extension cost:{" "}
                                                                {formatCurrency(ext.pricing?.amount)}
                                                            </p>
                                                            {ext.reason && (
                                                                <p className="mt-1 text-gray-500 dark:text-gray-400">
                                                                    Reason: {ext.reason}
                                                                </p>
                                                            )}

                                                            {ext.status === "Pending" && (
                                                                <div className="mt-2 flex flex-wrap gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        size="sm"
                                                                        variant="danger"
                                                                        onClick={() =>
                                                                            handleCustomerCancelExtension(ext._id)
                                                                        }
                                                                     leftIcon={<XCircle size={14} />}>
                                                                        Cancel Request
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {selectedBooking.customerNotes && (
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Notes
                                </h4>
                                <p className="rounded-xl border border-gray-200 p-3 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                                    {selectedBooking.customerNotes}
                                </p>
                            </div>
                        )}

                        {selectedBooking.paymentStatus && selectedBooking.status !== "Cancelled" && (
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Reservation Fee
                                </h4>
                                <StatusChip
                                    status={
                                        {
                                            VERIFIED: "paid",
                                            PENDING: "pending",
                                            REFUNDED: "refunded",
                                        }[selectedBooking.paymentStatus] ??
                                        "cancelled"
                                    }
                                />
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    Covers the booking confirmation only — the
                                    rest of the rental cost is separate.
                                </p>
                            </div>
                        )}

                        {Number(selectedBooking.rental?.financial?.balance) > 0 && (
                            <div>
                                <h4 className="mb-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                                    Balance Due
                                </h4>
                                <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">
                                    {formatCurrency(selectedBooking.rental.financial.balance)}
                                </p>
                                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    The remaining rental cost, settled at pickup.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            {/* ---------------------------------------------------------------- */}
            {/* Vouchers modal                                                     */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={voucherModalOpen}
                onClose={() => setVoucherModalOpen(false)}
                title="Vouchers"
                size="lg"
            >
                <div className="space-y-4">
                    {availableVouchers.length === 0 ? (
                        <EmptyRow icon={Gift} label="No vouchers available right now." />
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {availableVouchers.map((voucher) => {
                                const isCopied = copiedCode === voucher.code;

                                return (
                                    <button
                                        key={voucher._id || voucher.code}
                                        type="button"
                                        onClick={() => handleCopyCode(voucher.code)}
                                        className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-yellow-400 hover:shadow-[0_14px_28px_-16px_rgba(226,155,63,0.5)] dark:border-yellow-500/20 dark:bg-yellow-500/10"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-semibold text-gray-900 dark:text-white">
                                                    {voucher.name || voucher.code}
                                                </p>
                                                <p className="mt-1 flex items-center gap-1.5 font-mono text-xs text-yellow-600 dark:text-yellow-400">
                                                    {voucher.code}
                                                    <Copy size={10} />
                                                </p>
                                            </div>
                                            <span className="shrink-0 rounded-full bg-yellow-400 px-2.5 py-1 text-xs font-semibold text-gray-950">
                                                {voucher.discountMethod === "percentage"
                                                    ? `${voucher.discountValue}% off`
                                                    : `₱${voucher.discountValue} off`}
                                            </span>
                                        </div>

                                        {voucher.description && (
                                            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                                                {voucher.description}
                                            </p>
                                        )}

                                        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Valid: {formatDateRange(voucher.startDate, voucher.endDate)}
                                            </span>
                                            <span
                                                className={
                                                    isCopied
                                                        ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
                                                        : "text-xs font-medium text-yellow-600 dark:text-yellow-400"
                                                }
                                            >
                                                {isCopied
                                                    ? "Copied!"
                                                    : voucher.type === "reservation_fee"
                                                      ? "Reservation"
                                                      : voucher.type === "pickup_fee"
                                                        ? "Pickup"
                                                        : voucher.type === "vehicle_price"
                                                          ? "Vehicle"
                                                          : "Total"}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Modal>

            {/* ---------------------------------------------------------------- */}
            {/* Favorites modal                                                    */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={favoritesModalOpen}
                onClose={() => setFavoritesModalOpen(false)}
                title="My Favorites"
                size="xl"
            >
                <div className="space-y-4">
                    {favorites.length === 0 ? (
                        <EmptyRow
                            icon={Heart}
                            label="No favorites yet. Browse vehicles and tap the heart icon to save your favorites."
                        />
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {favorites.map((vehicle) => (
                                <FeaturedVehicleCard
                                    key={vehicle._id ?? vehicle.id}
                                    vehicle={vehicle}
                                    publicView={true}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* ---------------------------------------------------------------- */}
            {/* Cancelled bookings modal                                           */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={cancelledModalOpen}
                onClose={() => setCancelledModalOpen(false)}
                title="Cancelled Bookings"
                size="xl"
            >
                <div className="space-y-3">
                    {bookings.filter((booking) => booking.status === "Cancelled").length === 0 ? (
                        <EmptyRow icon={XCircle} label="No cancelled bookings." />
                    ) : (
                        bookings
                            .filter((booking) => booking.status === "Cancelled")
                            .map((booking) => (
                                <BookingListRow
                                    key={booking._id}
                                    booking={booking}
                                    onViewDetails={handleViewDetails}
                                />
                            ))
                    )}
                </div>
            </Modal>

            {/* ---------------------------------------------------------------- */}
            {/* Rejected bookings modal                                            */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={rejectedModalOpen}
                onClose={() => setRejectedModalOpen(false)}
                title="Rejected Bookings"
                size="xl"
            >
                <div className="space-y-3">
                    {bookings.filter((booking) => booking.status === "Rejected").length === 0 ? (
                        <EmptyRow icon={XCircle} label="No rejected bookings." />
                    ) : (
                        bookings
                            .filter((booking) => booking.status === "Rejected")
                            .map((booking) => (
                                <BookingListRow
                                    key={booking._id}
                                    booking={booking}
                                    onViewDetails={handleViewDetails}
                                />
                            ))
                    )}
                </div>
            </Modal>

            {/* ---------------------------------------------------------------- */}
            {/* Expired bookings modal                                             */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={expiredModalOpen}
                onClose={() => setExpiredModalOpen(false)}
                title="Expired Bookings & No-Shows"
                size="xl"
            >
                <div className="space-y-3">
                    {bookings.filter((booking) => LAPSED_STATUSES.includes(booking.status)).length === 0 ? (
                        <EmptyRow icon={CalendarOff} label="No expired bookings or no-shows." />
                    ) : (
                        bookings
                            .filter((booking) => LAPSED_STATUSES.includes(booking.status))
                            .map((booking) => (
                                <BookingListRow
                                    key={booking._id}
                                    booking={booking}
                                    onViewDetails={handleViewDetails}
                                />
                            ))
                    )}
                </div>
            </Modal>

            {/* ---------------------------------------------------------------- */}
            {/* Booking history modal                                              */}
            {/* ---------------------------------------------------------------- */}
            <Modal
                isOpen={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                title="Booking History"
                size="xl"
            >
                <div className="space-y-3">
                    {bookings.filter((booking) => booking.status === "Completed").length === 0 ? (
                        <EmptyRow icon={Sparkles} label="No completed bookings." />
                    ) : (
                        bookings
                            .filter((booking) => booking.status === "Completed")
                            .map((booking) => (
                                <BookingListRow
                                    key={booking._id}
                                    booking={booking}
                                    onViewDetails={handleViewDetails}
                                    onReview={handleReview}
                                    showReview={!booking.hasReview}
                                    onRequestRefund={handleOpenRefundModal}
                                    refundEligible={canRequestRefund(booking, refundWindowHours)}
                                    onWithdrawRefund={handleWithdrawRefund}
                                    pendingRefund={getPendingRefund(booking)}
                                />
                            ))
                    )}
                </div>
            </Modal>

            <RescheduleModal
                isOpen={Boolean(rescheduleTarget)}
                onClose={() => setRescheduleTarget(null)}
                booking={rescheduleTarget}
                mode="customer"
                onDone={() => refreshBookings()}
            />

            <ExtensionRequestModal
                isOpen={extensionModalOpen}
                onClose={() => {
                    if (extensionSubmitting) {
                        return;
                    }

                    setExtensionModalOpen(false);
                    setExtensionTarget(null);
                }}
                onSubmit={handleExtensionSubmit}
                loading={extensionSubmitting}
                booking={extensionTarget}
            />

            <RequestRefundModal
                isOpen={Boolean(refundModal)}
                onClose={closeRefundModal}
                onSubmit={submitRefundModal}
                loading={refundModal?.submitting ?? false}
                booking={refundModal?.booking}
            />

            <ConfirmDialog
                isOpen={Boolean(confirmState)}
                onClose={closeConfirm}
                onConfirm={runConfirm}
                title={confirmState?.title}
                message={confirmState?.message}
                confirmText={
                    confirmState?.confirmText ?? "Confirm"
                }
                cancelText={
                    confirmState?.cancelText ?? "Cancel"
                }
                confirmVariant={
                    confirmState?.confirmVariant ?? "danger"
                }
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
                            {getVehicleName(cancelModal.booking?.vehicle)}{" "}
                            booking? This action cannot be undone.
                        </p>

                        {cancelModal.booking?._id && (
                            <CancellationRefundNotice
                                bookingId={
                                    cancelModal.booking._id
                                }
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
        </>
    );
};

export default Bookings;