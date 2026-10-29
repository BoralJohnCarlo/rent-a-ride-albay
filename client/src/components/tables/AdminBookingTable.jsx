import { useNavigate } from "react-router-dom";

import { AnimatePresence, motion } from "framer-motion";

import {
    CarFront,
    CheckCircle2,
    Eye,
    UserRound,
    UserX,
    Wallet,
    XCircle,
} from "lucide-react";

import { canMarkNoShow } from "../../constants/bookingStatus";
import {
    MAINTENANCE_CONFLICT_STATUS,
    hasOpenMaintenanceConflict,
    isLateReturnConflict,
} from "../../constants/maintenanceConflict";
import Button from "../common/Button";
import StatusChip from "../common/StatusChip";
import CardActionMenu from "../cards/CardActionMenu";
import RefundStatus from "../payment/RefundStatus";
import EmptyState from "../common/EmptyState";
import LoadingSpinner from "../common/LoadingSpinner";
import TripProgressBar from "../bookings/TripProgressBar";
import {
    getDriverIssue,
    getPendingDriverChangeRequest,
} from "../../utils/driverChange";

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

const formatAmount = (value) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getCustomerName = (customer) => {
    if (!customer) {
        return "—";
    }

    const fullName = [
        customer.firstName,
        customer.lastName,
    ]
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

const getVehicleName = (vehicle) => {
    if (!vehicle) {
        return "—";
    }

    const name = [
        vehicle.brand,
        vehicle.model,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        name ||
        vehicle.name ||
        vehicle.vehicleCode ||
        "—"
    );
};

const getVehicleImage = (vehicle) =>
    vehicle?.image ||
    vehicle?.imageUrl ||
    vehicle?.vehicleImage ||
    vehicle?.vehicleImageUrl ||
    vehicle?.images?.[0]?.url ||
    vehicle?.images?.[0] ||
    null;

const getVehicleMeta = (vehicle) => {
    if (!vehicle) {
        return "—";
    }

    const type =
        vehicle.vehicleType ||
        vehicle.type ||
        vehicle.category;

    const transmission =
        vehicle.transmission ||
        vehicle.transmissionType;

    const parts = [type, transmission].filter(Boolean);

    return (
        parts.join(" · ") ||
        vehicle.vehicleCode ||
        vehicle.plateNumber ||
        "—"
    );
};

const getVehicleIdentifier = (vehicle) =>
    vehicle?.plateNumber ||
    vehicle?.vehicleCode ||
    "—";

/*
 * Deliberately says "Reservation fee" rather than just "Fee" - this only
 * reflects the upfront booking-confirmation payment, not the full rental
 * cost. Labeling it ambiguously as "paid" reads as "fully paid", which is
 * exactly what led to confusion over a real remaining balance (see the
 * BalanceDueBadge below, which surfaces that separately).
 */
const PAYMENT_BADGE = {
    VERIFIED: {
        label: "Reservation fee paid",
        className:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
    PENDING: {
        label: "Reservation fee pending",
        className:
            "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    CANCELLED: {
        label: "Payment cancelled",
        className:
            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    },
};

const PaymentBadge = ({ status }) => {
    const config = PAYMENT_BADGE[status];

    if (!config) {
        return null;
    }

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${config.className}`}
        >
            {config.label}
        </span>
    );
};

const BalanceDueBadge = ({ balance }) => {
    const amount = Number(balance);

    if (!(amount > 0)) {
        return null;
    }

    return (
        <span
            className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            title="The rest of the rental cost, separate from the reservation fee - settled at pickup."
        >
            {formatAmount(amount)} balance due
        </span>
    );
};

const formatShortDate = (value) => {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
          })
        : "—";
};

const getInitials = (name) =>
    name === "—"
        ? ""
        : name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((word) => word.charAt(0).toUpperCase())
              .join("");

/*
 * The ticket stub is tinted by status — same palette as the booking drawer
 * header (AdminBookingDetailModal). Full class strings so Tailwind sees them.
 */
const STUB_TONES = {
    amber: {
        stub: "bg-amber-50 dark:bg-amber-500/10",
        code: "text-amber-700 dark:text-amber-300",
    },
    sky: {
        stub: "bg-sky-50 dark:bg-sky-500/10",
        code: "text-sky-700 dark:text-sky-300",
    },
    emerald: {
        stub: "bg-emerald-50 dark:bg-emerald-500/10",
        code: "text-emerald-700 dark:text-emerald-300",
    },
    blue: {
        stub: "bg-blue-50 dark:bg-blue-500/10",
        code: "text-blue-700 dark:text-blue-300",
    },
    rose: {
        stub: "bg-rose-50 dark:bg-rose-500/10",
        code: "text-rose-700 dark:text-rose-300",
    },
    gray: {
        stub: "bg-gray-100 dark:bg-gray-800/60",
        code: "text-gray-600 dark:text-gray-300",
    },
};

const STATUS_TONE = {
    Pending: "amber",
    "Payment Received": "sky",
    Approved: "emerald",
    Ongoing: "blue",
    Completed: "emerald",
    Cancelled: "rose",
    Rejected: "rose",
    "No Show": "rose",
    Expired: "gray",
};

// A small attention flag under the card's route row.
const Flag = ({ tone = "amber", children }) => (
    <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            {
                amber: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                rose: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
                teal: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
            }[tone]
        }`}
    >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {children}
    </span>
);

const AdminBookingTable = ({
    bookings = [],
    loading = false,
    leavingRowId = null,
    busyId = null,
    onView,
    onApprove,
    onReject,
    onCancel,
    onExpire,
    onMarkNoShow,
    noShowGraceHours,
    now = 0,
    onPickup,
    onReturn,
    onVehicleOutcome,
    onPayment,
}) => {
    const navigate = useNavigate();

    if (loading) {
        return (
            <LoadingSpinner
                message="Loading bookings..."
                fullScreen={false}
            />
        );
    }

    if (!loading && !bookings.length) {
        return (
            <EmptyState
                title="No Results"
                description="No bookings match the current search."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
                {bookings.map((booking) => {
                    const rowId =
                        booking?._id ?? booking?.bookingCode;
                    const isLeaving =
                        leavingRowId === rowId;

                    const vehicle = booking?.vehicle;
                    const image = getVehicleImage(vehicle);

                    const extensions = Array.isArray(
                        booking?.extensions
                    )
                        ? booking.extensions
                        : [];

                    const pendingExtensions =
                        extensions.filter(
                            (extension) =>
                                extension?.status ===
                                "Pending"
                        ).length;

                    const hasPendingReschedule = (
                        booking?.reschedules || []
                    ).some(
                        (reschedule) =>
                            reschedule?.status === "Pending"
                    );

                    /*
                     * The Booking model has no separate "Returned" status -
                     * a returned-but-not-yet-completed rental still shows
                     * as "Ongoing" (completion requires a vehicle outcome
                     * and a resolved balance, both separate admin actions).
                     * Without this, the card gives no hint that a vehicle
                     * is actually back and needs attention.
                     */
                    const isReturned = Boolean(
                        booking?.status === "Ongoing" &&
                            booking?.rental?.return?.date
                    );

                    const isActionable =
                        booking?.status === "Pending" ||
                        booking?.status ===
                            "Payment Received";

                    const isPickupReady =
                        booking?.status === "Approved";

                    const isReturnReady =
                        booking?.status === "Ongoing" &&
                        !booking?.rental?.return?.date;

                    const needsOutcome =
                        booking?.status === "Ongoing" &&
                        Boolean(
                            booking?.rental?.return?.date
                        ) &&
                        !booking?.rental?.vehicleOutcome;

                    const hasBalanceDue = Number(
                        booking?.rental?.financial
                            ?.balance
                    ) > 0;

                    const customerId =
                        booking?.customer?._id ??
                        booking?.customer?.id ??
                        (typeof booking?.customer ===
                        "string"
                            ? booking.customer
                            : null);

                    const busy = busyId === booking?._id;

                    const menuActions = [
                        {
                            label: "View Details",
                            icon: Eye,
                            onClick: () =>
                                onView?.(booking),
                        },
                    ];

                    if (customerId) {
                        menuActions.push({
                            label: "View Profile",
                            icon: UserRound,
                            onClick: () =>
                                navigate(
                                    `/admin/users?userId=${customerId}`
                                ),
                        });
                    }

                    if (needsOutcome) {
                        menuActions.push({
                            label: "Set Outcome",
                            icon: CheckCircle2,
                            onClick: () =>
                                onVehicleOutcome?.(
                                    booking?.rental
                                ),
                        });
                    }

                    if (hasBalanceDue) {
                        menuActions.push({
                            label: "Confirm Payment",
                            icon: Wallet,
                            variant: "success",
                            onClick: () =>
                                onPayment?.(
                                    booking?.rental
                                ),
                        });
                    }

                    if (
                        booking?.status === "Approved" ||
                        booking?.status ===
                            "Payment Received"
                    ) {
                        menuActions.push({
                            label: "Cancel Booking",
                            icon: XCircle,
                            variant: "danger",
                            onClick: () =>
                                onCancel?.(booking),
                        });
                    }

                    if (
                        onMarkNoShow &&
                        canMarkNoShow(
                            booking,
                            noShowGraceHours,
                            now
                        )
                    ) {
                        menuActions.push({
                            label: "Mark as No-Show",
                            icon: UserX,
                            variant: "danger",
                            onClick: () =>
                                onMarkNoShow(booking),
                        });
                    }

                    // Approved bookings that weren't picked up are no-shows, not
                    // expiries. The server only expires unapproved ones whose
                    // rental period has ended.
                    if (
                        ["Pending", "Payment Received"].includes(
                            booking?.status
                        ) &&
                        new Date(booking?.endDate) <= now
                    ) {
                        menuActions.push({
                            label: "Expire Booking",
                            icon: XCircle,
                            variant: "danger",
                            onClick: () =>
                                onExpire?.(booking),
                        });
                    }

                    const tone =
                        STUB_TONES[
                            STATUS_TONE[booking?.status] ?? "gray"
                        ];
                    const customerName = getCustomerName(
                        booking?.customer
                    );
                    const vehicleIdentifier =
                        getVehicleIdentifier(vehicle);
                    const vehicleMeta = getVehicleMeta(vehicle);
                    const rentalDays = booking?.pricing?.rentalDays;
                    const hasEarlyReturnCredit =
                        booking?.rental?.earlyReturn?.detected ===
                            true &&
                        booking?.rental?.earlyReturn?.status ===
                            "Pending";
                    const driverIssue = getDriverIssue(booking);
                    const hasDriverChangeRequest = Boolean(
                        getPendingDriverChangeRequest(booking)
                    );
                    const hasFlags =
                        hasOpenMaintenanceConflict(booking) ||
                        isReturned ||
                        pendingExtensions > 0 ||
                        hasPendingReschedule ||
                        hasEarlyReturnCredit ||
                        Boolean(driverIssue) ||
                        hasDriverChangeRequest;

                    return (
                        <motion.div
                            key={rowId}
                            layout
                            initial={{
                                opacity: 0,
                                y: 8,
                            }}
                            animate={{
                                opacity: isLeaving ? 0.4 : 1,
                                y: 0,
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.98,
                            }}
                            transition={{
                                duration: 0.2,
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={`Open booking ${booking?.bookingCode ?? ""}`}
                            className="group cursor-pointer rounded-2xl drop-shadow-sm transition-[filter,translate] duration-200 hover:-translate-y-0.5 hover:drop-shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                            onClick={() =>
                                onView?.(booking)
                            }
                            onKeyDown={(event) => {
                                if (
                                    event.target ===
                                        event.currentTarget &&
                                    (event.key === "Enter" ||
                                        event.key === " ")
                                ) {
                                    event.preventDefault();
                                    onView?.(booking);
                                }
                            }}
                        >
                            {/* Ticket: notched stub | dashed tear | body */}
                            <div className="booking-ticket flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white sm:flex-row dark:border-gray-800 dark:bg-gray-900">
                                {/* Stub */}
                                <div
                                    className={`flex shrink-0 items-center gap-3 p-3 sm:w-[9.5rem] sm:flex-col sm:items-stretch sm:justify-between sm:gap-3 sm:p-3.5 ${tone.stub}`}
                                >
                                    <div className="min-w-0">
                                        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                                            Booking
                                        </p>
                                        <p
                                            className={`mt-0.5 truncate font-mono text-base font-bold tracking-tight ${tone.code}`}
                                        >
                                            {booking?.bookingCode ||
                                                "—"}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                            Created{" "}
                                            {formatDate(
                                                booking?.createdAt
                                            )}
                                        </p>
                                    </div>

                                    <div className="ml-auto flex h-14 w-[84px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/80 ring-1 ring-black/5 sm:ml-0 sm:h-[72px] sm:w-full dark:bg-gray-900/60 dark:ring-white/10">
                                        {image ? (
                                            <img
                                                src={image}
                                                alt={getVehicleName(
                                                    vehicle
                                                )}
                                                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <CarFront
                                                size={26}
                                                className="text-gray-400"
                                            />
                                        )}
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="min-w-0 flex-1 border-dashed border-gray-200 p-4 max-sm:border-t-2 sm:border-l-2 sm:p-5 dark:border-gray-700">
                                    {/* Vehicle + status */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-base font-bold text-gray-900 dark:text-white">
                                                {getVehicleName(
                                                    vehicle
                                                )}
                                            </p>

                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <span className="rounded-md border border-gray-300 px-1.5 py-px font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                                    {vehicleIdentifier}
                                                </span>

                                                {vehicleMeta !==
                                                    vehicleIdentifier && (
                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                        {vehicleMeta}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div
                                            className="flex shrink-0 items-center gap-2"
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            <StatusChip
                                                status={
                                                    booking?.status ||
                                                    "Unknown"
                                                }
                                                size="sm"
                                            />

                                            <CardActionMenu
                                                actions={
                                                    menuActions
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Customer + route */}
                                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] md:items-center">
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white dark:bg-white dark:text-gray-900">
                                                {getInitials(
                                                    customerName
                                                ) || (
                                                    <UserRound
                                                        size={16}
                                                    />
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                        {customerName}
                                                    </p>

                                                    {booking
                                                        ?.customer
                                                        ?.isVerified && (
                                                        <CheckCircle2
                                                            size={14}
                                                            aria-label="Verified"
                                                            className="shrink-0 text-blue-600 dark:text-blue-400"
                                                        />
                                                    )}
                                                </div>

                                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                    {booking
                                                        ?.customer
                                                        ?.phoneNumber ||
                                                        booking
                                                            ?.customer
                                                            ?.email ||
                                                        "—"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/40">
                                            <div className="shrink-0">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                                    Pickup
                                                </p>
                                                <p className="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                                    {formatShortDate(
                                                        booking?.startDate
                                                    )}
                                                </p>
                                            </div>

                                            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
                                                {rentalDays !==
                                                    undefined &&
                                                    rentalDays !==
                                                        null && (
                                                        <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                                                            {rentalDays}{" "}
                                                            {rentalDays ===
                                                            1
                                                                ? "day"
                                                                : "days"}
                                                        </span>
                                                    )}

                                                <TripProgressBar
                                                    startDate={
                                                        booking?.startDate
                                                    }
                                                    endDate={
                                                        booking?.endDate
                                                    }
                                                    status={
                                                        booking?.status
                                                    }
                                                    returnDate={
                                                        booking
                                                            ?.rental
                                                            ?.return
                                                            ?.date
                                                    }
                                                    hideDates
                                                />
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                    Return
                                                </p>
                                                <p className="whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                                    {formatDate(
                                                        booking?.endDate
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attention flags */}
                                    {hasFlags && (
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {hasOpenMaintenanceConflict(
                                                booking
                                            ) && (
                                                <Flag tone="rose">
                                                    {isLateReturnConflict(
                                                        booking
                                                    )
                                                        ? `Late return · ${
                                                              {
                                                                  [MAINTENANCE_CONFLICT_STATUS.DETECTED]:
                                                                      "at risk",
                                                                  [MAINTENANCE_CONFLICT_STATUS.WAITING]:
                                                                      "customer waiting",
                                                              }[
                                                                  booking
                                                                      .maintenanceConflict
                                                                      .status
                                                              ] ??
                                                              "awaiting customer"
                                                          }`
                                                        : `Maintenance · ${
                                                              booking
                                                                  .maintenanceConflict
                                                                  .status ===
                                                              MAINTENANCE_CONFLICT_STATUS.DETECTED
                                                                  ? "send options"
                                                                  : "awaiting customer"
                                                          }`}
                                                </Flag>
                                            )}

                                            {isReturned && (
                                                <Flag
                                                    tone={
                                                        booking
                                                            ?.rental
                                                            ?.vehicleOutcome
                                                            ? "teal"
                                                            : "amber"
                                                    }
                                                >
                                                    {booking
                                                        ?.rental
                                                        ?.vehicleOutcome
                                                        ? "Ready to complete"
                                                        : "Set outcome"}
                                                </Flag>
                                            )}

                                            {pendingExtensions >
                                                0 && (
                                                <Flag>
                                                    {pendingExtensions}{" "}
                                                    extension
                                                    {pendingExtensions ===
                                                    1
                                                        ? ""
                                                        : "s"}{" "}
                                                    pending
                                                </Flag>
                                            )}

                                            {hasPendingReschedule && (
                                                <Flag>
                                                    Reschedule pending
                                                </Flag>
                                            )}

                                            {driverIssue && (
                                                <Flag tone="rose">
                                                    Needs a new driver
                                                </Flag>
                                            )}

                                            {hasDriverChangeRequest && (
                                                <Flag>
                                                    Driver change requested
                                                </Flag>
                                            )}

                                            {hasEarlyReturnCredit && (
                                                <Flag>
                                                    Early return credit
                                                    pending
                                                </Flag>
                                            )}
                                        </div>
                                    )}

                                    {/* Amount + actions */}
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="whitespace-nowrap text-lg font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
                                                {formatAmount(
                                                    booking
                                                        ?.pricing
                                                        ?.totalAmount
                                                )}
                                            </span>

                                            <PaymentBadge
                                                status={
                                                    booking?.paymentStatus
                                                }
                                            />

                                            <BalanceDueBadge
                                                balance={
                                                    booking
                                                        ?.rental
                                                        ?.financial
                                                        ?.balance
                                                }
                                            />

                                            <RefundStatus
                                                booking={booking}
                                                rental={
                                                    booking?.rental
                                                }
                                            />
                                        </div>

                                        <div
                                            className="flex items-center gap-2"
                                            onClick={(event) =>
                                                event.stopPropagation()
                                            }
                                        >
                                            {isActionable && (
                                                <>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="danger"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            onReject?.(
                                                                booking
                                                            )
                                                        }
                                                    >
                                                        Reject
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="primary"
                                                        loading={busy}
                                                        disabled={busy}
                                                        onClick={() =>
                                                            onApprove?.(
                                                                booking
                                                            )
                                                        }
                                                    >
                                                        Accept
                                                    </Button>
                                                </>
                                            )}

                                            {isPickupReady && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() =>
                                                        onPickup?.(
                                                            booking
                                                        )
                                                    }
                                                >
                                                    Picked Up
                                                </Button>
                                            )}

                                            {isReturnReady && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="primary"
                                                    onClick={() =>
                                                        onReturn?.(
                                                            booking?.rental
                                                        )
                                                    }
                                                >
                                                    Returned
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default AdminBookingTable;
