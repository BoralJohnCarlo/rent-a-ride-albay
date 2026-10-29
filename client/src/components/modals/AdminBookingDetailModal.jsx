import { useNavigate } from "react-router-dom";

import {
    ArrowUpRight,
    BadgeDollarSign,
    Ban,
    CalendarClock,
    CalendarDays,
    CarFront,
    Check,
    CheckCircle2,
    Eye,
    FileCheck2,
    Flag,
    IdCard,
    Mail,
    Phone,
    Plus,
    ReceiptText,
    Repeat2,
    ShieldAlert,
    ShieldCheck,
    SlidersHorizontal,
    StickyNote,
    TriangleAlert,
    User,
    UserRound,
    Wallet,
    X,
} from "lucide-react";

import { canMarkNoShow, isReschedulable } from "../../constants/bookingStatus";
import Avatar from "../common/Avatar";
import Button from "../common/Button";
import StatusChip from "../common/StatusChip";
import Select from "../common/Select";
import RentalPickupPanel from "../rentals/RentalPickupPanel";
import RentalReturnPanel from "../rentals/RentalReturnPanel";
import RentalFinancialSummary from "../rentals/RentalFinancialSummary";
import ReturnTimingNote from "../booking/ReturnTimingNote";
import MaintenanceConflictAdminPanel from "../booking/MaintenanceConflictAdminPanel";
import LateReturnImpactPanel from "../booking/LateReturnImpactPanel";
import { getDueBackAt } from "../../utils/returnTiming";
import { getDiscountBadgeText } from "../../utils/vehicleDiscount";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDriver from "../../hooks/drivers/useDriver";
import DriverChangeAdminPanel from "../booking/DriverChangeAdminPanel";
import AcceptedTerms from "../legal/AcceptedTerms";
import PolicySourceNote from "../legal/PolicySourceNote";
import {
    getDriverIssue,
    getPendingDriverChangeRequest,
} from "../../utils/driverChange";
import useProofOfBillingEnabled from "../../hooks/settings/useProofOfBillingEnabled";

const formatCurrency = (value) => {
    const amount = Number(value);

    return Number.isFinite(amount)
        ? `₱${amount.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })}`
        : "₱0.00";
};

const formatDate = (value, includeTime = false) => {
    if (!value) {
        return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("en-PH", {
        weekday: includeTime ? undefined : "short",
        year: "numeric",
        month: includeTime ? "short" : "long",
        day: "numeric",
        ...(includeTime && {
            hour: "2-digit",
            minute: "2-digit",
        }),
    });
};

const toValidDate = (value) => {
    const date = value ? new Date(value) : null;

    return date && !Number.isNaN(date.getTime()) ? date : null;
};

// "Fri, Oct 2" — the big line of a trip endpoint.
const formatDay = (value) =>
    toValidDate(value)?.toLocaleDateString("en-PH", {
        weekday: "short",
        month: "short",
        day: "numeric",
    }) ?? "—";

// "2026 · 02:35 PM" — the small line under it.
const formatYearTime = (value) => {
    const date = toValidDate(value);

    if (!date) {
        return "";
    }

    return `${date.getFullYear()} · ${date.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
    })}`;
};

const getName = (person = {}, fallback = "—") =>
    [person.firstName, person.lastName]
        .filter(Boolean)
        .join(" ") ||
    person.fullName ||
    person.name ||
    person.email ||
    fallback;

const getVehicleName = (vehicle = {}) =>
    [vehicle.brand, vehicle.model]
        .filter(Boolean)
        .join(" ") ||
    vehicle.name ||
    vehicle.vehicleCode ||
    "—";

const getVehicleImage = (vehicle = {}) =>
    vehicle.image ||
    vehicle.imageUrl ||
    vehicle.vehicleImage ||
    vehicle.vehicleImageUrl ||
    vehicle.images?.[0]?.url ||
    vehicle.images?.[0] ||
    null;

const getExtensionStatusClass = (status) =>
    ({
        Pending:
            "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
        Approved:
            "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
        Rejected:
            "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
        Cancelled:
            "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    })[status] ??
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300";

// Left accent stripe on extension / reschedule request cards.
const getRequestStripeClass = (status) =>
    ({
        Pending: "before:bg-amber-400",
        Approved: "before:bg-emerald-500",
        Rejected: "before:bg-red-500",
    })[status] ?? "before:bg-gray-300 dark:before:bg-gray-700";

/*
 * The drawer's header is tinted by where the booking stands. Full class
 * strings (not interpolated) so Tailwind picks them up.
 */
const TONES = {
    amber: {
        hero: "from-amber-100/80 dark:from-amber-500/15",
        accent: "bg-amber-400",
        step: "bg-amber-500 text-white",
        line: "bg-amber-400",
        ring: "ring-amber-200 dark:ring-amber-500/40",
    },
    sky: {
        hero: "from-sky-100/80 dark:from-sky-500/15",
        accent: "bg-sky-500",
        step: "bg-sky-500 text-white",
        line: "bg-sky-400",
        ring: "ring-sky-200 dark:ring-sky-500/40",
    },
    emerald: {
        hero: "from-emerald-100/80 dark:from-emerald-500/15",
        accent: "bg-emerald-500",
        step: "bg-emerald-500 text-white",
        line: "bg-emerald-400",
        ring: "ring-emerald-200 dark:ring-emerald-500/40",
    },
    blue: {
        hero: "from-blue-100/80 dark:from-blue-500/15",
        accent: "bg-blue-500",
        step: "bg-blue-600 text-white",
        line: "bg-blue-400",
        ring: "ring-blue-200 dark:ring-blue-500/40",
    },
    rose: {
        hero: "from-rose-100/80 dark:from-rose-500/15",
        accent: "bg-rose-500",
        step: "bg-rose-500 text-white",
        line: "bg-rose-300 dark:bg-rose-500/60",
        ring: "ring-rose-200 dark:ring-rose-500/40",
    },
    gray: {
        hero: "from-gray-200/70 dark:from-gray-500/15",
        accent: "bg-gray-400",
        step: "bg-gray-500 text-white",
        line: "bg-gray-300 dark:bg-gray-600",
        ring: "ring-gray-200 dark:ring-gray-600",
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

const PROGRESS_STEPS = [
    "Booked",
    "Paid",
    "Approved",
    "On trip",
    "Completed",
];

const STATUS_STEP = {
    Pending: 0,
    "Payment Received": 1,
    Approved: 2,
    Ongoing: 3,
    Completed: 4,
};

/*
 * How far along the happy path the booking got. A booking that ended early
 * (cancelled, rejected, expired, no-show) shows the steps it actually
 * reached, then its end state in place of the rest.
 */
const getProgress = (booking, hasRental) => {
    const status = booking?.status;

    if (status in STATUS_STEP) {
        return { reached: STATUS_STEP[status], terminal: null };
    }

    return {
        reached: hasRental ? 3 : booking?.approvedAt ? 2 : 0,
        terminal: status ?? "Unknown",
    };
};

const ProgressTrack = ({ booking, hasRental, tone }) => {
    const { reached, terminal } = getProgress(booking, hasRental);
    const terminalTone = TONES[STATUS_TONE[terminal] ?? "gray"];

    const steps = terminal
        ? [
              ...PROGRESS_STEPS.slice(0, reached + 1).map((label) => ({
                  label,
                  state: "done",
              })),
              { label: terminal, state: "terminal" },
          ]
        : PROGRESS_STEPS.map((label, index) => ({
              label,
              state:
                  index < reached || (index === reached && index === PROGRESS_STEPS.length - 1)
                      ? "done"
                      : index === reached
                        ? "current"
                        : "upcoming",
          }));

    return (
        <ol className="flex items-start" aria-label="Booking progress">
            {steps.map((step, index) => {
                const isLast = index === steps.length - 1;
                const lineDone =
                    !isLast &&
                    (step.state === "done") &&
                    steps[index + 1].state !== "upcoming";

                return (
                    <li
                        key={step.label}
                        className="relative flex flex-1 flex-col items-center"
                        aria-current={step.state === "current" ? "step" : undefined}
                    >
                        {!isLast && (
                            <span
                                aria-hidden="true"
                                className={`absolute left-1/2 top-[11px] h-0.5 w-full ${
                                    lineDone
                                        ? steps[index + 1].state === "terminal"
                                            ? terminalTone.line
                                            : tone.line
                                        : "bg-gray-200 dark:bg-gray-800"
                                }`}
                            />
                        )}

                        <span
                            className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                step.state === "done"
                                    ? tone.step
                                    : step.state === "terminal"
                                      ? terminalTone.step
                                      : step.state === "current"
                                        ? `bg-white ring-2 ${tone.ring} dark:bg-gray-950`
                                        : "bg-white ring-1 ring-gray-200 dark:bg-gray-950 dark:ring-gray-800"
                            }`}
                        >
                            {step.state === "done" ? (
                                <Check size={13} strokeWidth={3} />
                            ) : step.state === "terminal" ? (
                                <Ban size={12} strokeWidth={2.5} />
                            ) : step.state === "current" ? (
                                <span
                                    className={`h-2 w-2 animate-pulse rounded-full ${tone.accent}`}
                                />
                            ) : null}
                        </span>

                        <span
                            className={`mt-1.5 px-0.5 text-center text-[10px] font-semibold leading-tight ${
                                step.state === "upcoming"
                                    ? "text-gray-400 dark:text-gray-600"
                                    : "text-gray-700 dark:text-gray-200"
                            }`}
                        >
                            {step.label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
};

/*
 * A card in the drawer body. `sectionKey` makes it a target of the section
 * bar under the header (jump + scroll-spy).
 */
const DetailSection = ({ sectionKey, title, icon, badge, children }) => (
    <section
        data-section={sectionKey}
        className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-gray-800 dark:bg-gray-900"
    >
        <header className="mb-4 flex items-center gap-2.5">
            {icon && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white dark:bg-white dark:text-gray-900">
                    {icon}
                </span>
            )}

            <h3 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
                {title}
            </h3>

            {badge && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {badge}
                </span>
            )}
        </header>
        {children}
    </section>
);

// Customer photo, or their initials on a brand-green tile.
const Monogram = ({ src, name }) => {
    const initials = name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("");

    return (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-base font-bold text-white shadow-sm">
            {src ? (
                <img
                    src={src}
                    alt={name || "Customer"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                />
            ) : (
                initials || <UserRound size={20} />
            )}
        </div>
    );
};

// Label-over-value, for the two-column grids in request cards.
const Field = ({ label, value }) => (
    <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {label}
        </p>
        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
            {value || "—"}
        </p>
    </div>
);

// A receipt line with a dotted leader between the label and the amount.
const ReceiptRow = ({ label, value, muted = false, accent = false }) => (
    <div className="flex items-baseline gap-2 py-1 text-sm">
        <span
            className={
                muted
                    ? "text-gray-400 dark:text-gray-500"
                    : "text-gray-600 dark:text-gray-300"
            }
        >
            {label}
        </span>
        <span
            aria-hidden="true"
            className="min-w-4 flex-1 translate-y-[-3px] border-b border-dotted border-gray-300 dark:border-gray-700"
        />
        <span
            className={`text-right font-medium tabular-nums ${
                accent
                    ? "text-red-600 dark:text-red-400"
                    : muted
                      ? "text-gray-400 dark:text-gray-500"
                      : "text-gray-900 dark:text-white"
            }`}
        >
            {value || "—"}
        </span>
    </div>
);

// One of the in-trip tools (charge, damage, deposit, ...).
const ToolTile = ({ icon, label, onClick, highlight = false }) => (
    <button
        type="button"
        onClick={onClick}
        className={`group flex items-center gap-2.5 rounded-xl border p-2.5 text-left text-sm font-medium transition hover:-translate-y-0.5 hover:shadow-sm ${
            highlight
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-200 dark:hover:border-gray-600"
        }`}
    >
        <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                highlight
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-gray-600 ring-1 ring-gray-200 group-hover:bg-gray-900 group-hover:text-white group-hover:ring-gray-900 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:group-hover:bg-white dark:group-hover:text-gray-900"
            }`}
        >
            {icon}
        </span>
        <span className="leading-tight">{label}</span>
    </button>
);

const AdminBookingDetailModal = ({
    isOpen,
    onClose,
    booking,
    loading,
    onApprove,
    onReject,
    onCancel,
    onExpire,
    onMarkNoShow,
    noShowGraceHours,
    now = 0,
    onVerifyValidId,
    onUnverifyValidId,
    onApproveExtension,
    onRejectExtension,
    onCancelExtension,
    onApproveReschedule,
    onRejectReschedule,
    onReschedule,
    onWaivePenalty,
    onAdjustPenalty,
    onAddPenaltyNote,
    onApplyPenalty,
    onRecordRefund,
    rentalDetail,
    rentalLoading,
    onPickup,
    onReturn,
    onReassignDriver,
    onDamageIssue,
    onCharge,
    onAdjustment,
    onPayment,
    onSecurityDeposit,
    onVehicleOutcome,
    onComplete,
    onRetryRental,
    // Refreshes the booking after a maintenance-conflict action.
    onMaintenanceConflictChanged,
    // Refreshes the booking after a driver change (or request decision).
    onDriverChanged,
}) => {
    const navigate = useNavigate();

    const { drivers, getDrivers } = useDriver();

    const { enabled: proofOfBillingEnabled } =
        useProofOfBillingEnabled();

    const [selectedDriverId, setSelectedDriverId] = useState("");
    const [driverError, setDriverError] = useState("");

    // Section highlighted in the jump bar, scoped to the booking it was
    // picked on so switching bookings starts back at the top.
    const [activeSection, setActiveSection] = useState({
        bookingId: null,
        key: null,
    });
    const bodyRef = useRef(null);

    const bookingStart = booking?.startDate;
    const bookingEnd = booking?.endDate;

    const fetchAvailableDrivers = useCallback(async () => {
        // BOOKABLE also includes drivers who are out on a rental right now:
        // they can take a later booking. With the booking's dates, drivers
        // already booked then come back marked busy, and ones whose license
        // runs out first are left out.
        await getDrivers({
            status: "ACTIVE",
            availability: "BOOKABLE",
            ...(bookingStart && bookingEnd
                ? { startDate: bookingStart, endDate: bookingEnd }
                : {}),
        });
    }, [getDrivers, bookingStart, bookingEnd]);

    const driverOptions = useMemo(() => {
        if (!drivers || drivers.length === 0) {
            return [];
        }

        return drivers.map((driver) => {
            const name =
                `${driver.firstName ?? ""} ${driver.lastName ?? ""}`.trim() ||
                driver.name ||
                "Driver";

            return {
                label: driver.busy ? `${name} — booked on these dates` : name,
                value: driver._id ?? driver.id,
                disabled: Boolean(driver.busy),
            };
        });
    }, [drivers]);

    const needsDriverAssignment =
        ["Pending", "Payment Received"].includes(
            booking?.status
        ) &&
        booking?.driverOption === "With Driver" &&
        !booking?.driver;

    const handleApproveWithDriver = () => {
        if (needsDriverAssignment && !selectedDriverId) {
            setDriverError(
                "Please select a driver before approving this booking."
            );
            return;
        }

        setDriverError("");

        const driverId = needsDriverAssignment ? selectedDriverId : undefined;
        onApprove?.(booking._id, driverId);
    };

    useEffect(() => {
        if (isOpen && booking) {
            fetchAvailableDrivers();
        }
    }, [isOpen, booking, fetchAvailableDrivers]);

    // A different booking opened in the same drawer starts at the top.
    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
    }, [booking?._id]);

    const setActiveKey = useCallback(
        (key) =>
            setActiveSection((previous) =>
                previous.key === key &&
                previous.bookingId === booking?._id
                    ? previous
                    : { bookingId: booking?._id, key }
            ),
        [booking?._id]
    );

    // Scroll-spy: the last section whose top has passed the bar.
    const handleBodyScroll = (event) => {
        const container = event.currentTarget;
        const marks = [
            ...container.querySelectorAll("[data-section]"),
        ];

        if (marks.length === 0) {
            return;
        }

        const atBottom =
            container.scrollTop + container.clientHeight >=
            container.scrollHeight - 4;

        const current = atBottom
            ? marks[marks.length - 1]
            : marks.reduce(
                  (found, mark) =>
                      mark.offsetTop - container.scrollTop <= 96
                          ? mark
                          : found,
                  marks[0]
              );

        setActiveKey(current.dataset.section);
    };

    const jumpToSection = (key) => {
        const container = bodyRef.current;
        const target = container?.querySelector(
            `[data-section="${key}"]`
        );

        if (!target) {
            return;
        }

        container.scrollTo({
            top: target.offsetTop - 16,
            behavior: "smooth",
        });
        setActiveKey(key);
    };

    if (!isOpen) {
        return null;
    }

    if (!booking) {
        return null;
    }

    const customer = booking.customer ?? {};
    const vehicle = booking.vehicle ?? {};
    const driver = booking.driver ?? {};
    const pricing = booking.pricing ?? {};
    const rental = booking.rental ?? {};
    const lateReturn = rental.lateReturn ?? {};
    const earlyReturn = rental.earlyReturn ?? {};

    const extensions = Array.isArray(booking.extensions)
        ? booking.extensions
        : [];

    const reschedules = Array.isArray(booking.reschedules)
        ? booking.reschedules
        : [];

    const pendingReschedule = reschedules.find(
        (reschedule) => reschedule?.status === "Pending"
    );

    const vehicleImage = getVehicleImage(vehicle);

    const hasLateReturn =
        (lateReturn.lateDurationMinutes ?? 0) > 0;

    /*
     * The return has already been evaluated for lateness (auto-apply on
     * return, or a prior manual apply). When it was on time this is set
     * with a zero duration, so the "not applied yet" prompt must not show.
     */
    const lateReturnEvaluated = Boolean(
        lateReturn.confirmedAt
    );

    const pendingExtensions = extensions.filter(
        (extension) => extension?.status === "Pending"
    );

    const hasRental = Boolean(booking.rental?._id);
    const rentalStatus = rental.status;
    const isRentalOngoing = rentalStatus === "Ongoing";
    const canProcessPickup =
        booking.status === "Approved" && !hasRental;
    const depositRequired = Boolean(
        rentalDetail?.securityDeposit?.required
    );

    const tone = TONES[STATUS_TONE[booking.status] ?? "gray"];

    const isWithDriver = booking.driverOption === "With Driver";
    const showRentalSection = canProcessPickup || hasRental;
    const showReschedule =
        reschedules.length > 0 ||
        (isReschedulable(booking) && !pendingReschedule);

    const returnLabel = booking.rental?.return?.date
        ? "Returned"
        : booking.scheduledStartDate
          ? "Due back"
          : "Return";
    const returnAt = booking.rental?.return?.date ?? booking.endDate;
    const rentalDays = pricing.rentalDays;

    const sections = [
        { key: "trip", label: "Trip" },
        { key: "customer", label: "Customer" },
        isWithDriver && {
            key: "driver",
            label: "Driver",
            alert:
                needsDriverAssignment ||
                Boolean(getDriverIssue(booking)) ||
                Boolean(getPendingDriverChangeRequest(booking)),
        },
        { key: "pricing", label: "Pricing" },
        showRentalSection && { key: "rental", label: "Rental" },
        extensions.length > 0 && {
            key: "extensions",
            label: "Extensions",
            alert: pendingExtensions.length > 0,
        },
        showReschedule && {
            key: "reschedule",
            label: "Reschedule",
            alert: Boolean(pendingReschedule),
        },
        booking.customerNotes && { key: "notes", label: "Notes" },
        { key: "terms", label: "Terms" },
    ].filter(Boolean);

    const currentSection =
        activeSection.bookingId === booking._id &&
        sections.some((section) => section.key === activeSection.key)
            ? activeSection.key
            : sections[0].key;

    const bookingActions = [];

    if (
        ["Pending", "Payment Received"].includes(
            booking.status
        )
    ) {
        bookingActions.push(
            <Button
                key="reject"
                type="button"
                size="sm"
                variant="danger"
                onClick={() =>
                    onReject?.(booking._id)
                }
            >
                Reject
            </Button>,
            <Button
                key="approve"
                type="button"
                size="sm"
                variant="success"
                onClick={handleApproveWithDriver}
            >
                Approve
            </Button>
        );
    }

    if (
        [
            "Payment Received",
            "Approved",
            "Ongoing",
        ].includes(booking.status)
    ) {
        bookingActions.push(
            <Button
                key="cancel"
                type="button"
                size="sm"
                variant="danger"
                onClick={() =>
                    onCancel?.(booking._id)
                }
            >
                Cancel
            </Button>
        );
    }

    if (
        onMarkNoShow &&
        canMarkNoShow(booking, noShowGraceHours, now)
    ) {
        bookingActions.push(
            <Button
                key="no-show"
                type="button"
                size="sm"
                variant="danger"
                onClick={() =>
                    onMarkNoShow(booking._id)
                }
            >
                Mark as No-Show
            </Button>
        );
    }

    // Approved bookings that weren't picked up are no-shows, not expiries.
    // The server only expires unapproved ones whose rental period has ended.
    if (
        ["Pending", "Payment Received"].includes(booking.status) &&
        new Date(booking.endDate) <= now
    ) {
        bookingActions.push(
            <Button
                key="expire"
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                    onExpire?.(booking._id)
                }
            >
                Expire
            </Button>
        );
    }

    return (
        <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label={`Booking ${booking.bookingCode ?? ""}`}
        >
            {/* Backdrop */}
            <button
                type="button"
                aria-label="Close booking details"
                onClick={onClose}
                className="animate-fade-in absolute inset-0 h-full w-full cursor-default bg-gray-950/40 backdrop-blur-[2px]"
            />

            {/* Right-side drawer */}
            <aside
                className="
                    animate-drawer-in
                    absolute
                    right-0
                    top-0
                    flex
                    h-full
                    w-full
                    max-w-[640px]
                    flex-col
                    overflow-hidden
                    bg-gray-50
                    shadow-[-24px_0_60px_-20px_rgba(15,23,42,0.35)]
                    sm:rounded-l-3xl
                    dark:bg-gray-950
                "
            >
                {/* Header — tinted by the booking's status */}
                <div
                    className={`relative shrink-0 bg-gradient-to-b ${tone.hero} via-white to-white px-5 pb-4 pt-5 dark:via-gray-950 dark:to-gray-950`}
                >
                    <span
                        aria-hidden="true"
                        className={`absolute inset-x-0 top-0 h-1 ${tone.accent}`}
                    />

                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                                Booking
                            </p>

                            <div className="mt-1 flex flex-wrap items-center gap-2.5">
                                <h2 className="truncate font-mono text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                    {booking.bookingCode ??
                                        "Booking"}
                                </h2>

                                <StatusChip
                                    status={
                                        booking.status ??
                                        "Unknown"
                                    }
                                    size="sm"
                                />
                            </div>

                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                Booked on{" "}
                                {formatDate(
                                    booking.createdAt,
                                    true
                                )}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                bg-white/70
                                text-gray-500
                                ring-1
                                ring-gray-200
                                transition
                                hover:rotate-90
                                hover:bg-white
                                hover:text-gray-900
                                dark:bg-gray-900/70
                                dark:text-gray-400
                                dark:ring-gray-800
                                dark:hover:bg-gray-900
                                dark:hover:text-white
                            "
                            aria-label="Close"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Vehicle + total */}
                    <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/80 p-3 sm:gap-4 ring-1 ring-gray-200/80 dark:bg-gray-900/70 dark:ring-gray-800">
                        <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-800 sm:h-[72px] sm:w-28">
                            {vehicleImage ? (
                                <img
                                    src={vehicleImage}
                                    alt={getVehicleName(vehicle)}
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <CarFront
                                    size={30}
                                    className="text-gray-400"
                                />
                            )}
                        </div>

                        <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900 dark:text-white sm:truncate sm:text-base">
                                {getVehicleName(vehicle)}
                            </p>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-md border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200">
                                    {vehicle.plateNumber ||
                                        vehicle.vehicleCode ||
                                        "Vehicle"}
                                </span>

                                {booking.driverOption && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                        <User size={11} />
                                        {booking.driverOption}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="shrink-0 border-l border-dashed border-gray-200 pl-3 text-right dark:border-gray-700 sm:pl-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                Total
                            </p>
                            <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900 dark:text-white sm:text-lg">
                                {formatCurrency(pricing.totalAmount)}
                            </p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                        <ProgressTrack
                            booking={booking}
                            hasRental={hasRental}
                            tone={tone}
                        />
                    </div>
                </div>

                {/* Section jump bar */}
                {!loading && (
                    <nav
                        aria-label="Booking sections"
                        className="scrollbar-hide flex shrink-0 gap-1 overflow-x-auto border-y border-gray-200 bg-white px-4 py-2 dark:border-gray-800 dark:bg-gray-950"
                    >
                        {sections.map((section) => {
                            const isActive =
                                section.key === currentSection;

                            return (
                                <button
                                    key={section.key}
                                    type="button"
                                    onClick={() =>
                                        jumpToSection(section.key)
                                    }
                                    aria-current={
                                        isActive ? "true" : undefined
                                    }
                                    className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                        isActive
                                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                                            : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                                    }`}
                                >
                                    {section.label}

                                    {section.alert && (
                                        <span
                                            aria-label="needs attention"
                                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                )}

                {/* Drawer body */}
                <div
                    ref={bodyRef}
                    onScroll={handleBodyScroll}
                    className="relative min-h-0 flex-1 overflow-y-auto"
                >
                    {loading ? (
                        <div className="flex min-h-[420px] items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
                        </div>
                    ) : (
                        <div className="space-y-4 p-4 sm:p-5">
                            {/* Its vehicle won't be ready: maintenance or a late return */}
                            <MaintenanceConflictAdminPanel
                                booking={booking}
                                onChanged={onMaintenanceConflictChanged}
                            />

                            {/* This booking's own late return hit later bookings */}
                            {booking.rental && (
                                <LateReturnImpactPanel
                                    bookingId={booking._id}
                                    refreshKey={booking.updatedAt}
                                />
                            )}

                            {/* Trip — boarding-pass layout */}
                            <DetailSection
                                sectionKey="trip"
                                title="Trip"
                                icon={<CalendarDays size={14} />}
                            >
                                <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/40">
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3">
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                                Pickup
                                            </p>
                                            <p className="mt-1 text-base font-bold leading-tight text-gray-900 dark:text-white sm:text-lg">
                                                {formatDay(booking.startDate)}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {formatYearTime(booking.startDate)}
                                            </p>
                                            {booking.pickupTime && (
                                                <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700">
                                                    <CalendarClock size={11} />
                                                    Preferred {booking.pickupTime}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-center pt-4">
                                            <div className="flex items-center gap-1 text-gray-300 dark:text-gray-600">
                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                <span className="w-5 border-t-2 border-dashed border-current sm:w-8" />
                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700">
                                                    <CarFront size={15} />
                                                </span>
                                                <span className="w-5 border-t-2 border-dashed border-current sm:w-8" />
                                                <span className="h-1.5 w-1.5 rounded-full bg-gray-900 dark:bg-white" />
                                            </div>
                                            {rentalDays != null && (
                                                <span className="mt-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                                    {rentalDays}{" "}
                                                    {rentalDays === 1
                                                        ? "day"
                                                        : "days"}
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-w-0 text-right">
                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                                {returnLabel}
                                            </p>
                                            <p className="mt-1 text-base font-bold leading-tight text-gray-900 dark:text-white sm:text-lg">
                                                {formatDay(returnAt)}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                                                {formatYearTime(returnAt)}
                                            </p>
                                        </div>
                                    </div>

                                    {booking.rental?.return?.date &&
                                        getDueBackAt(booking) && (
                                            <div className="mt-3 flex justify-end">
                                                <ReturnTimingNote
                                                    dueBackAt={getDueBackAt(booking)}
                                                    returnedAt={booking.rental.return.date}
                                                    dueBackLabel={formatDate(
                                                        getDueBackAt(booking),
                                                        true
                                                    )}
                                                />
                                            </div>
                                        )}
                                </div>

                                {booking.scheduledStartDate && (
                                    <p className="mt-3 rounded-lg border-l-2 border-sky-400 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
                                        Booked schedule:{" "}
                                        {formatDate(
                                            booking.scheduledStartDate,
                                            true
                                        )}{" "}
                                        –{" "}
                                        {formatDate(
                                            booking.scheduledEndDate,
                                            true
                                        )}
                                        . The rental period runs from the
                                        actual pickup.
                                        {booking.rental?.bookingPeriod
                                            ?.returnCapped &&
                                            " The due-back time was shortened so it ends before the next booking for this vehicle or driver."}
                                    </p>
                                )}

                                {/* Route */}
                                <ol className="relative mt-4 space-y-4 pl-7">
                                    <span
                                        aria-hidden="true"
                                        className="absolute bottom-3 left-[7px] top-3 border-l-2 border-dashed border-gray-200 dark:border-gray-700"
                                    />

                                    <li className="relative">
                                        <span className="absolute -left-7 top-0.5 h-4 w-4 rounded-full border-4 border-emerald-500 bg-white dark:bg-gray-900" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            Pickup location
                                        </p>
                                        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                                            {booking.pickupLocation
                                                ?.address ?? "—"}
                                        </p>
                                    </li>

                                    <li className="relative">
                                        <span className="absolute -left-7 top-0.5 h-4 w-4 rounded-[5px] border-4 border-gray-900 bg-white dark:border-white dark:bg-gray-900" />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                            Return location
                                        </p>
                                        <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                                            {booking.returnLocation
                                                ?.address ?? "—"}
                                        </p>
                                    </li>
                                </ol>
                            </DetailSection>

                            {/* Customer */}
                            <DetailSection
                                sectionKey="customer"
                                title="Customer"
                                icon={<UserRound size={14} />}
                            >
                                <div className="flex items-start gap-3">
                                    <Monogram
                                        src={customer.profileImage || null}
                                        name={getName(customer, "")}
                                    />

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <p className="truncate font-semibold text-gray-900 dark:text-white">
                                                {getName(customer)}
                                            </p>

                                            {customer.isVerified && (
                                                <CheckCircle2
                                                    size={16}
                                                    aria-label="Verified"
                                                    className="shrink-0 text-blue-600 dark:text-blue-400"
                                                />
                                            )}
                                        </div>

                                        <div className="mt-1.5 space-y-1">
                                            <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                <Mail
                                                    size={13}
                                                    className="shrink-0 text-gray-400"
                                                />
                                                <span className="truncate">
                                                    {customer.email ||
                                                        "No email"}
                                                </span>
                                            </p>

                                            {customer.phoneNumber && (
                                                <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                    <Phone
                                                        size={13}
                                                        className="shrink-0 text-gray-400"
                                                    />
                                                    {customer.phoneNumber}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {(customer._id ?? customer.id) && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                navigate(
                                                    `/admin/users?userId=${
                                                        customer._id ??
                                                        customer.id
                                                    }`
                                                )
                                            }
                                            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 dark:border-gray-700 dark:text-gray-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
                                        >
                                            Profile
                                            <ArrowUpRight size={13} />
                                        </button>
                                    )}
                                </div>

                                {customer.validIdType && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2.5 dark:bg-gray-800/40">
                                            <IdCard
                                                size={16}
                                                className="text-gray-500 dark:text-gray-400"
                                            />
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                {customer.validIdType}
                                            </span>

                                            {customer.isVerified ? (
                                                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                                                    <ShieldCheck size={12} />
                                                    Verified
                                                </span>
                                            ) : customer.validIdExpired ? (
                                                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                                                    <ShieldAlert size={12} />
                                                    ID expired
                                                </span>
                                            ) : (
                                                <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                                                    <ShieldAlert size={12} />
                                                    Not verified
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 p-3">
                                            {customer.validIdImage && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    leftIcon={<Eye size={14} />}
                                                    onClick={() =>
                                                        window.open(
                                                            customer.validIdImage,
                                                            "_blank",
                                                            "noopener,noreferrer"
                                                        )
                                                    }
                                                >
                                                    Front
                                                </Button>
                                            )}

                                            {customer.validIdBack && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    leftIcon={<Eye size={14} />}
                                                    onClick={() =>
                                                        window.open(
                                                            customer.validIdBack,
                                                            "_blank",
                                                            "noopener,noreferrer"
                                                        )
                                                    }
                                                >
                                                    Back
                                                </Button>
                                            )}

                                            {customer._id &&
                                                (customer.isVerified ? (
                                                    <button
                                                        type="button"
                                                        className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                                        onClick={() =>
                                                            onUnverifyValidId?.(
                                                                customer._id
                                                            )
                                                        }
                                                    >
                                                        Unverify ID
                                                    </button>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="success"
                                                        className="ml-auto"
                                                        leftIcon={<ShieldCheck size={14} />}
                                                        onClick={() =>
                                                            onVerifyValidId?.(
                                                                customer._id
                                                            )
                                                        }
                                                    >
                                                        Verify ID
                                                    </Button>
                                                ))}
                                        </div>
                                    </div>
                                )}

                                {/* Always right below the valid ID. */}
                                {proofOfBillingEnabled && (
                                    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2.5 dark:bg-gray-800/40">
                                            <ReceiptText
                                                size={16}
                                                className="text-gray-500 dark:text-gray-400"
                                            />
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                                Proof of billing address
                                            </span>

                                            {!customer.proofOfBillingImage && (
                                                <span className="ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                    Not provided
                                                </span>
                                            )}
                                        </div>

                                        <div className="p-3">
                                            {customer.proofOfBillingImage ? (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        window.open(
                                                            customer.proofOfBillingImage,
                                                            "_blank",
                                                            "noopener,noreferrer"
                                                        )
                                                    }
                                                    className="group relative block h-36 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
                                                >
                                                    <img
                                                        src={customer.proofOfBillingImage}
                                                        alt="Proof of billing address"
                                                        className="h-full w-full object-cover transition group-hover:opacity-80"
                                                    />

                                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/0 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                                                        <Eye size={14} />
                                                        Open full size
                                                    </span>
                                                </button>
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    This customer hasn't uploaded one. Booking isn't affected.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </DetailSection>

                            {isWithDriver && (
                                <DetailSection
                                    sectionKey="driver"
                                    title="Driver"
                                    icon={<User size={14} />}
                                    badge={
                                        needsDriverAssignment
                                            ? "Needs assignment"
                                            : getDriverIssue(booking)
                                              ? "Needs a new driver"
                                              : getPendingDriverChangeRequest(
                                                      booking
                                                  )
                                                ? "Change requested"
                                                : null
                                    }
                                >
                                    {!needsDriverAssignment ? (
                                        <div className="flex items-center gap-3">
                                            <Avatar
                                                name={getName(driver, "")}
                                                size="sm"
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                    {getName(driver)}
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                                    Assigned driver
                                                    {driver?.phoneNumber
                                                        ? ` · ${driver.phoneNumber}`
                                                        : ""}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <Select
                                                label="Assign Driver"
                                                name="assignDriver"
                                                value={selectedDriverId}
                                                onChange={(e) => {
                                                    setSelectedDriverId(e.target.value);
                                                    setDriverError("");
                                                }}
                                                required
                                                options={driverOptions}
                                                error={driverError}
                                                helperText="Select a driver to assign to this booking"
                                            />
                                            {selectedDriverId && (
                                                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                                    Selected driver: {driverOptions.find(opt => opt.value === selectedDriverId)?.label || "Loading..."}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {!needsDriverAssignment && (
                                        <DriverChangeAdminPanel
                                            booking={booking}
                                            onChanged={onDriverChanged}
                                        />
                                    )}
                                </DetailSection>
                            )}

                            {/* Pricing — receipt */}
                            <DetailSection
                                sectionKey="pricing"
                                title="Pricing"
                                icon={<BadgeDollarSign size={14} />}
                            >
                                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/40">
                                    <div className="px-4 pb-3 pt-3">
                                        <ReceiptRow
                                            label="Daily Rate"
                                            value={
                                                pricing.vehicleDiscount
                                                    ? `${formatCurrency(
                                                          pricing.dailyRate
                                                      )} (was ${formatCurrency(
                                                          pricing.originalDailyRate
                                                      )})`
                                                    : formatCurrency(
                                                          pricing.dailyRate
                                                      )
                                            }
                                        />
                                        {pricing.vehicleDiscount && (
                                            <ReceiptRow
                                                label="Vehicle Discount"
                                                value={`${
                                                    pricing.vehicleDiscount.name ||
                                                    getDiscountBadgeText(
                                                        pricing.vehicleDiscount
                                                    )
                                                } (−${formatCurrency(
                                                    pricing.vehicleDiscount.amountPerDay
                                                )}/day)`}
                                            />
                                        )}
                                        <ReceiptRow
                                            label="Rental Days"
                                            value={`${pricing.rentalDays ?? "—"} ${
                                                pricing.rentalDays === 1
                                                    ? "day"
                                                    : "days"
                                            }`}
                                        />
                                        <ReceiptRow
                                            label="Subtotal"
                                            value={formatCurrency(
                                                pricing.subtotal
                                            )}
                                        />
                                        <ReceiptRow
                                            label="Reservation Fee"
                                            value={formatCurrency(
                                                pricing.reservationFee
                                            )}
                                        />
                                        <ReceiptRow
                                            label="Pickup Distance Fee"
                                            value={formatCurrency(
                                                pricing.pickupDistanceFee
                                            )}
                                            muted={!Number(pricing.pickupDistanceFee)}
                                        />
                                        <ReceiptRow
                                            label="Return Distance Fee"
                                            value={formatCurrency(
                                                pricing.returnDistanceFee
                                            )}
                                            muted={!Number(pricing.returnDistanceFee)}
                                        />

                                        {(rental.financial
                                            ?.lateCharges ?? 0) > 0 && (
                                            <ReceiptRow
                                                label="Late Return Charge"
                                                value={formatCurrency(
                                                    rental.financial
                                                        .lateCharges
                                                )}
                                                accent
                                            />
                                        )}
                                    </div>

                                    {/* Perforation with ticket notches */}
                                    <div
                                        aria-hidden="true"
                                        className="relative h-4"
                                    >
                                        <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white dark:bg-gray-900" />
                                        <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-gray-200 dark:border-gray-700" />
                                        <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white dark:bg-gray-900" />
                                    </div>

                                    <div className="flex items-end justify-between px-4 pb-4 pt-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            Total
                                        </span>
                                        <span className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
                                            {formatCurrency(
                                                pricing.totalAmount
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </DetailSection>

                            {/* Rental operations — pickup through completion,
                                with the recorded history visible alongside
                                the actions, without leaving this drawer */}
                            {showRentalSection && (
                                <DetailSection
                                    sectionKey="rental"
                                    title="Rental"
                                    icon={<CarFront size={14} />}
                                >
                                    <div className="space-y-3">
                                        {canProcessPickup && (
                                            <RentalPickupPanel
                                                rental={{
                                                    booking,
                                                }}
                                                onPickup={() =>
                                                    onPickup?.(
                                                        booking
                                                    )
                                                }
                                            />
                                        )}

                                        {hasRental &&
                                            rentalLoading && (
                                                <div className="flex items-center gap-2 py-1 text-sm text-gray-500 dark:text-gray-400">
                                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                                    Loading rental details...
                                                </div>
                                            )}

                                        {hasRental &&
                                            !rentalLoading &&
                                            !rentalDetail && (
                                                <div className="flex items-center gap-3 py-1 text-sm text-red-600 dark:text-red-400">
                                                    Couldn't load rental details.
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            onRetryRental?.()
                                                        }
                                                    >
                                                        Retry
                                                    </Button>
                                                </div>
                                            )}

                                        {hasRental &&
                                            !rentalLoading &&
                                            rentalDetail && (
                                                <>
                                                    <RentalPickupPanel
                                                        rental={
                                                            rentalDetail
                                                        }
                                                        onPickup={() =>
                                                            onPickup?.(
                                                                booking
                                                            )
                                                        }
                                                    />

                                                    <RentalReturnPanel
                                                        rental={
                                                            rentalDetail
                                                        }
                                                        onReturn={() =>
                                                            onReturn?.(
                                                                rentalDetail
                                                            )
                                                        }
                                                        onVehicleOutcome={
                                                            onVehicleOutcome
                                                        }
                                                    />

                                                    {rentalDetail.vehicleOutcome && (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Vehicle outcome:{" "}
                                                            <span className="font-medium text-gray-900 dark:text-white">
                                                                {
                                                                    rentalDetail.vehicleOutcome
                                                                }
                                                            </span>
                                                        </p>
                                                    )}

                                                    {isRentalOngoing && (
                                                        <div className="space-y-2">
                                                            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                                                                Trip tools
                                                            </p>

                                                            <div className="grid grid-cols-2 gap-2">
                                                                <ToolTile
                                                                    icon={<Repeat2 size={15} />}
                                                                    label="Reassign Driver"
                                                                    onClick={() =>
                                                                        onReassignDriver?.(
                                                                            rentalDetail
                                                                        )
                                                                    }
                                                                />

                                                                <ToolTile
                                                                    icon={<TriangleAlert size={15} />}
                                                                    label="Log Damage"
                                                                    onClick={() =>
                                                                        onDamageIssue?.(
                                                                            rentalDetail
                                                                        )
                                                                    }
                                                                />

                                                                <ToolTile
                                                                    icon={<Plus size={15} />}
                                                                    label="Add Charge"
                                                                    onClick={() =>
                                                                        onCharge?.(
                                                                            rentalDetail
                                                                        )
                                                                    }
                                                                />

                                                                <ToolTile
                                                                    icon={<SlidersHorizontal size={15} />}
                                                                    label="Add Adjustment"
                                                                    onClick={() =>
                                                                        onAdjustment?.(
                                                                            rentalDetail
                                                                        )
                                                                    }
                                                                />

                                                                {Number(
                                                                    rentalDetail
                                                                        ?.financial
                                                                        ?.balance
                                                                ) > 0 && (
                                                                    <ToolTile
                                                                        icon={<Wallet size={15} />}
                                                                        label="Record Payment"
                                                                        highlight
                                                                        onClick={() =>
                                                                            onPayment?.(
                                                                                rentalDetail
                                                                            )
                                                                        }
                                                                    />
                                                                )}

                                                                {depositRequired && (
                                                                    <ToolTile
                                                                        icon={<ShieldCheck size={15} />}
                                                                        label="Security Deposit"
                                                                        onClick={() =>
                                                                            onSecurityDeposit?.(
                                                                                rentalDetail
                                                                            )
                                                                        }
                                                                    />
                                                                )}

                                                                <ToolTile
                                                                    icon={<CarFront size={15} />}
                                                                    label="Vehicle Outcome"
                                                                    onClick={() =>
                                                                        onVehicleOutcome?.(
                                                                            rentalDetail
                                                                        )
                                                                    }
                                                                />
                                                            </div>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="dark"
                                                                fullWidth
                                                                leftIcon={<Flag size={14} />}
                                                                onClick={() =>
                                                                    onComplete?.(
                                                                        rentalDetail
                                                                    )
                                                                }
                                                            >
                                                                Complete Rental
                                                            </Button>
                                                        </div>
                                                    )}

                                                    <RentalFinancialSummary
                                                        rental={
                                                            rentalDetail
                                                        }
                                                    />
                                                </>
                                            )}
                                    </div>
                                </DetailSection>
                            )}

                            {/* Late return / penalty */}
                            {rentalDetail?.return?.date &&
                                !hasLateReturn &&
                                !lateReturnEvaluated &&
                                rental._id && (
                                    <section className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                                                <TriangleAlert size={15} />
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                                    Late Return Penalty
                                                </h3>
                                                <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/70">
                                                    A penalty has not been applied yet.
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="warning"
                                            onClick={() =>
                                                onApplyPenalty?.(
                                                    rental._id
                                                )
                                            }
                                        >
                                            Apply
                                        </Button>
                                    </section>
                                )}

                            {hasLateReturn && (
                                <section className="overflow-hidden rounded-2xl border border-red-200 bg-white dark:border-red-900/40 dark:bg-gray-900">
                                    <div className="flex items-center justify-between gap-3 bg-red-50 px-4 py-3 dark:bg-red-950/30">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-300">
                                            <TriangleAlert size={15} />
                                            Late Return
                                        </h3>
                                        <span className="text-lg font-bold tabular-nums text-red-700 dark:text-red-300">
                                            {formatCurrency(
                                                lateReturn.amount
                                            )}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
                                        <Field
                                            label="Expected"
                                            value={formatDate(
                                                lateReturn.expectedReturnAt,
                                                true
                                            )}
                                        />
                                        <Field
                                            label="Actual"
                                            value={formatDate(
                                                lateReturn.actualReturnAt,
                                                true
                                            )}
                                        />
                                        <Field
                                            label="Duration"
                                            value={`${lateReturn.lateDurationMinutes ?? 0} minutes`}
                                        />
                                        <Field
                                            label="Charged Units"
                                            value={`${lateReturn.chargedUnits ?? 0} ${
                                                lateReturn.chargingUnit?.toLowerCase() ??
                                                "hours"
                                            }`}
                                        />
                                    </div>

                                    <PolicySourceNote
                                        audience="admin"
                                        source={lateReturn.policySource}
                                        version={lateReturn.termsVersion}
                                        className="px-4 pb-3"
                                    />

                                    {rental._id && (
                                        <div className="flex flex-wrap gap-2 border-t border-red-100 px-4 py-3 dark:border-red-900/40">
                                            {(lateReturn.amount ??
                                                0) > 0 && (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="danger"
                                                    onClick={() =>
                                                        onWaivePenalty?.(
                                                            rental._id
                                                        )
                                                    }
                                                >
                                                    Waive
                                                </Button>
                                            )}

                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    onAdjustPenalty?.(
                                                        rental._id
                                                    )
                                                }
                                            >
                                                Adjust
                                            </Button>

                                            {(lateReturn.amount ??
                                                0) > 0 &&
                                                Number(
                                                    rentalDetail
                                                        ?.financial
                                                        ?.balance
                                                ) > 0 && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="success"
                                                        onClick={() =>
                                                            onPayment?.(
                                                                rentalDetail
                                                            )
                                                        }
                                                    >
                                                        Confirm Paid
                                                    </Button>
                                                )}

                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                onClick={() =>
                                                    onAddPenaltyNote?.(
                                                        rental._id
                                                    )
                                                }
                                            >
                                                Add Note
                                            </Button>

                                            {rentalDetail
                                                ?.financial
                                                ?.amountPaid >
                                                0 &&
                                                (rentalDetail
                                                    .financial
                                                    .refunds ??
                                                    0) <
                                                    rentalDetail
                                                        .financial
                                                        .amountPaid && (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        leftIcon={
                                                            <BadgeDollarSign
                                                                size={14}
                                                            />
                                                        }
                                                        onClick={() =>
                                                            onRecordRefund?.(
                                                                booking
                                                            )
                                                        }
                                                    >
                                                        Refund
                                                    </Button>
                                                )}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Early return credit — discovery only; the
                                actual approve/reject action lives on the
                                Financials → Early Returns queue, since the
                                admin is expected to inspect the vehicle
                                before approving. */}
                            {earlyReturn?.detected === true &&
                                earlyReturn?.status === "Pending" && (
                                    <section className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                                        <div className="flex items-start gap-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                                                <CalendarClock size={15} />
                                            </span>
                                            <div>
                                                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                                    Early Return Detected
                                                </h3>
                                                <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/70">
                                                    Returned{" "}
                                                    {earlyReturn.unusedFullDays}{" "}
                                                    day(s) early — a credit of{" "}
                                                    {formatCurrency(
                                                        earlyReturn.creditAmount
                                                    )}{" "}
                                                    is awaiting review. Inspect
                                                    the vehicle, then approve or
                                                    reject it from the Early
                                                    Returns queue.
                                                </p>
                                                <PolicySourceNote
                                                    audience="admin"
                                                    source={earlyReturn.policySource}
                                                    version={earlyReturn.termsVersion}
                                                    inheritColor
                                                    className="mt-1 text-amber-700/80 dark:text-amber-300/70"
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="warning"
                                            onClick={() =>
                                                navigate(
                                                    "/admin/payments?tab=early-returns"
                                                )
                                            }
                                        >
                                            Review
                                        </Button>
                                    </section>
                                )}

                            {/* Extensions */}
                            {extensions.length > 0 && (
                                <DetailSection
                                    sectionKey="extensions"
                                    title="Extensions"
                                    icon={<CalendarDays size={14} />}
                                    badge={
                                        pendingExtensions.length
                                            ? `${pendingExtensions.length} pending`
                                            : null
                                    }
                                >
                                    <div className="space-y-3">
                                        {extensions.map(
                                            (extension, index) => (
                                                <div
                                                    key={
                                                        extension._id ??
                                                        index
                                                    }
                                                    className={`relative overflow-hidden rounded-xl border border-gray-200 py-3 pl-4 pr-3 before:absolute before:inset-y-0 before:left-0 before:w-1 dark:border-gray-800 ${getRequestStripeClass(
                                                        extension.status
                                                    )}`}
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                            Request #{index + 1}
                                                        </p>

                                                        <span
                                                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getExtensionStatusClass(
                                                                extension.status
                                                            )}`}
                                                        >
                                                            {extension.status ??
                                                                "Unknown"}
                                                        </span>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                                        <Field
                                                            label="Previous Return"
                                                            value={formatDate(
                                                                extension.previousEndDate,
                                                                true
                                                            )}
                                                        />
                                                        <Field
                                                            label="Requested Return"
                                                            value={formatDate(
                                                                extension.requestedEndDate,
                                                                true
                                                            )}
                                                        />
                                                        <Field
                                                            label="Additional Time"
                                                            value={`${extension.additionalHours ?? 0} hour${
                                                                extension.additionalHours ===
                                                                1
                                                                    ? ""
                                                                    : "s"
                                                            }`}
                                                        />
                                                        <Field
                                                            label="Cost"
                                                            value={formatCurrency(
                                                                extension
                                                                    .pricing
                                                                    ?.amount
                                                            )}
                                                        />
                                                    </div>

                                                    {extension.reason && (
                                                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                                            Reason:{" "}
                                                            {extension.reason}
                                                        </p>
                                                    )}

                                                    {extension.status ===
                                                        "Pending" && (
                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="success"
                                                                onClick={() =>
                                                                    onApproveExtension?.(
                                                                        extension._id
                                                                    )
                                                                }
                                                            >
                                                                Approve
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="danger"
                                                                onClick={() =>
                                                                    onRejectExtension?.(
                                                                        extension._id
                                                                    )
                                                                }
                                                            >
                                                                Reject
                                                            </Button>

                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    onCancelExtension?.(
                                                                        extension._id
                                                                    )
                                                                }
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {extension.approvedAt && (
                                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                            Approved{" "}
                                                            {formatDate(
                                                                extension.approvedAt,
                                                                true
                                                            )}
                                                        </p>
                                                    )}

                                                    {extension.status ===
                                                        "Approved" &&
                                                        booking.extensionPaymentStatus && (
                                                            <p className="mt-2 flex items-center gap-1.5 text-xs">
                                                                <span className="font-medium text-gray-500 dark:text-gray-400">
                                                                    Extension fee:
                                                                </span>
                                                                <span
                                                                    className={
                                                                        booking.extensionPaymentStatus ===
                                                                        "VERIFIED"
                                                                            ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                                                            : booking.extensionPaymentStatus ===
                                                                                "PENDING"
                                                                              ? "font-semibold text-amber-600 dark:text-amber-400"
                                                                              : "font-semibold text-gray-500 dark:text-gray-400"
                                                                    }
                                                                >
                                                                    {booking.extensionPaymentStatus ===
                                                                    "VERIFIED"
                                                                        ? "Paid"
                                                                        : booking.extensionPaymentStatus ===
                                                                            "PENDING"
                                                                          ? booking.extensionPaymentMethod ===
                                                                            "GCASH"
                                                                              ? "Pending online payment"
                                                                              : "Due at pickup (cash)"
                                                                          : booking.extensionPaymentStatus}
                                                                </span>
                                                            </p>
                                                        )}

                                                    {extension.rejectionReason && (
                                                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                            Rejection reason:{" "}
                                                            {extension.rejectionReason}
                                                        </p>
                                                    )}

                                                    {extension.cancellationReason && (
                                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                            Cancellation reason:{" "}
                                                            {extension.cancellationReason}
                                                        </p>
                                                    )}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </DetailSection>
                            )}

                            {/* Reschedule */}
                            {showReschedule && (
                                <DetailSection
                                    sectionKey="reschedule"
                                    title="Reschedule"
                                    icon={<CalendarClock size={14} />}
                                    badge={
                                        pendingReschedule
                                            ? "Awaiting review"
                                            : null
                                    }
                                >
                                    <div className="space-y-3">
                                        {reschedules.map((item, index) => (
                                            <div
                                                key={item._id ?? index}
                                                className={`relative overflow-hidden rounded-xl border border-gray-200 py-3 pl-4 pr-3 before:absolute before:inset-y-0 before:left-0 before:w-1 dark:border-gray-800 ${getRequestStripeClass(
                                                    item.status
                                                )}`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        {item.requestedByAdmin
                                                            ? "Moved by admin"
                                                            : `Customer request #${index + 1}`}
                                                    </p>
                                                    <span
                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${getExtensionStatusClass(
                                                            item.status
                                                        )}`}
                                                    >
                                                        {item.status ?? "Unknown"}
                                                    </span>
                                                </div>

                                                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                                                    <Field
                                                        label="From"
                                                        value={`${formatDate(item.previousStartDate, true)} – ${formatDate(item.previousEndDate, true)}`}
                                                    />
                                                    <Field
                                                        label="To"
                                                        value={`${formatDate(item.requestedStartDate, true)} – ${formatDate(item.requestedEndDate, true)}`}
                                                    />
                                                    <Field
                                                        label="New total"
                                                        value={formatCurrency(item.pricing?.totalAmount)}
                                                    />
                                                    <Field
                                                        label="Difference"
                                                        value={`${
                                                            Number(item.pricing?.difference) > 0
                                                                ? "+"
                                                                : Number(item.pricing?.difference) < 0
                                                                  ? "−"
                                                                  : ""
                                                        }${formatCurrency(Math.abs(Number(item.pricing?.difference) || 0))}`}
                                                    />
                                                </div>

                                                {item.reason && (
                                                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                                        Reason: {item.reason}
                                                    </p>
                                                )}

                                                {item.status === "Approved" &&
                                                    item.settlement?.kind &&
                                                    item.settlement.kind !== "none" && (
                                                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                                                            {item.settlement.kind === "charge"
                                                                ? `${formatCurrency(item.settlement.amount)} charged as an online payment${
                                                                      booking.extensionPaymentPurpose === "reschedule" &&
                                                                      booking.extensionPaymentStatus
                                                                          ? ` (${booking.extensionPaymentStatus === "VERIFIED" ? "paid" : booking.extensionPaymentStatus.toLowerCase()})`
                                                                          : ""
                                                                  }.`
                                                                : `${formatCurrency(item.settlement.amount)} refund ${
                                                                      item.settlement.manual
                                                                          ? "needs manual action (see Financials)."
                                                                          : "sent through PayMongo."
                                                                  }`}
                                                        </p>
                                                    )}

                                                {item.status === "Pending" && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="success"
                                                            onClick={() =>
                                                                onApproveReschedule?.(item._id)
                                                            }
                                                        >
                                                            Approve
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() =>
                                                                onRejectReschedule?.(item._id)
                                                            }
                                                        >
                                                            Reject
                                                        </Button>
                                                    </div>
                                                )}

                                                {item.rejectionReason && (
                                                    <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                                                        Rejection reason: {item.rejectionReason}
                                                    </p>
                                                )}

                                                {item.cancellationReason && (
                                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                        Closed: {item.cancellationReason}
                                                    </p>
                                                )}
                                            </div>
                                        ))}

                                        {isReschedulable(booking) &&
                                            !pendingReschedule && (
                                                <button
                                                    type="button"
                                                    onClick={() => onReschedule?.()}
                                                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-3 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
                                                >
                                                    <CalendarDays size={15} />
                                                    Reschedule booking
                                                </button>
                                            )}
                                    </div>
                                </DetailSection>
                            )}

                            {/* Notes */}
                            {booking.customerNotes && (
                                <DetailSection
                                    sectionKey="notes"
                                    title="Customer notes"
                                    icon={<StickyNote size={14} />}
                                >
                                    <blockquote className="rounded-xl border-l-4 border-yellow-400 bg-yellow-50 px-4 py-3 text-sm italic text-gray-700 dark:bg-yellow-500/10 dark:text-gray-200">
                                        {booking.customerNotes}
                                    </blockquote>
                                </DetailSection>
                            )}

                            {/* The Terms & Conditions version the customer accepted. */}
                            <DetailSection
                                sectionKey="terms"
                                title="Terms accepted"
                                icon={<FileCheck2 size={14} />}
                            >
                                <AcceptedTerms
                                    acceptance={booking.termsAcceptance}
                                    legacyText="Not recorded — this booking was made before Terms & Conditions versions were tracked."
                                />

                                {booking.noShowOutcome && (
                                    <div className="mt-3 space-y-1 rounded-xl border border-gray-200 px-4 py-3 text-sm dark:border-gray-800">
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            No-show settlement
                                        </p>
                                        <p className="text-gray-600 dark:text-gray-300">
                                            Kept{" "}
                                            {formatCurrency(
                                                booking.noShowOutcome.keptAmount
                                            )}
                                            , refunded{" "}
                                            {formatCurrency(
                                                booking.noShowOutcome.refundAmount
                                            )}{" "}
                                            ({booking.noShowOutcome.refundPercent}% of
                                            the reservation fee back).
                                        </p>
                                        <PolicySourceNote
                                            audience="admin"
                                            source={booking.noShowOutcome.policySource}
                                            version={booking.noShowOutcome.termsVersion}
                                        />
                                    </div>
                                )}
                            </DetailSection>
                        </div>
                    )}
                </div>

                {/* Drawer footer */}
                <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-950">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap gap-2">
                            {bookingActions.length > 0 ? (
                                bookingActions
                            ) : (
                                <p className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                                    <CheckCircle2 size={14} />
                                    No actions needed
                                </p>
                            )}
                        </div>

                        <div className="flex shrink-0 gap-2">
                            {booking?._id && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    title="Charges, payments and refunds with their receipts (opens in a new tab)"
                                    onClick={() =>
                                        window.open(
                                            `/documents/statements/${booking._id}`,
                                            "_blank",
                                            "noopener"
                                        )
                                    }
                                    leftIcon={<ReceiptText size={15} />}
                                >
                                    Statement
                                </Button>
                            )}

                            <Button
                                type="button"
                                size="sm"
                                variant="dark"
                                onClick={onClose}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default AdminBookingDetailModal;
