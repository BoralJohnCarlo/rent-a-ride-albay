import {
    Ban,
    CalendarX,
    CarFront,
    CheckCircle2,
    ChevronRight,
    Clock3,
    Search,
    SlidersHorizontal,
    Wallet,
    X,
    UserX,
    Wrench,
    XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";

import Button from "../../../components/common/Button";
import Modal from "../../../components/common/Modal";
import Select from "../../../components/common/Select";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import Textarea from "../../../components/common/Textarea";
import AdminBookingTable from "../../../components/tables/AdminBookingTable";
import AdminBookingDetailModal from "../../../components/modals/AdminBookingDetailModal";
import VerifyValidIdDialog from "../../../components/admin/VerifyValidIdDialog";
import RefundModal from "../../../components/modals/RefundModal";
import PenaltyActionModal from "../../../components/modals/PenaltyActionModal";
import { getBookingPenaltyCap } from "../../../utils/lockedTerms";
import RentalActionModal from "../../../components/modals/RentalActionModal";
import BookingFilters from "../../../components/filters/BookingFilters";
import EmptyState from "../../../components/common/EmptyState";
import ExportExcelPill from "../../../components/common/ExportExcelPill";
import Pagination from "../../../components/common/Pagination";

import { DEFAULT_NO_SHOW_GRACE_HOURS } from "../../../constants/bookingStatus";
import RescheduleModal from "../../../components/modals/RescheduleModal";
import {
    approveBookingReschedule,
    rejectBookingReschedule,
} from "../../../api/bookingApi";
import {
    exportBookingsToExcel,
    getExportErrorMessage,
} from "../../../api/exportApi";
import {
    downloadBlob,
    manilaDateStamp,
    toFileSlug,
} from "../../../utils/downloadFile";
import useBooking from "../../../hooks/bookings/useBooking";
import useUser from "../../../hooks/users/useUser";
import useRental from "../../../hooks/rentals/useRental";
import useDriver from "../../../hooks/drivers/useDriver";
import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

import {
    RENTAL_PAYMENT_STATUS,
    RENTAL_PAYMENT_TYPE,
} from "../../../constants/rentalConstants";
import { hasOpenMaintenanceConflict } from "../../../constants/maintenanceConflict";
import {
    getDriverIssue,
    getPendingDriverChangeRequest,
} from "../../../utils/driverChange";

/* Pending, Payment Received, and Approved bookings stay in the default
   management list. Ongoing and Completed have dedicated cards and take
   over when a booking moves into those stages. */
const MANAGED_BOOKING_STATUSES = [
    "Pending",
    "Payment Received",
    "Approved",
];

/*
 * A booking with a pending extension request is always Approved or Ongoing
 * (see validateExtensionBookingStatus in bookingService.js) - never Pending
 * or Payment Received - so it would otherwise never surface on the default
 * "Awaiting review" tab the admin lands on. Folding it into that same KPI
 * and filter keeps every booking that needs a decision in one place.
 */
const hasPendingExtension = (booking) =>
    /* Requests left pending on a booking that has since ended (from before
       the server started closing them) need no decision. */
    ["Approved", "Ongoing"].includes(booking?.status) &&
    Array.isArray(booking?.extensions) &&
    booking.extensions.some(
        (extension) => extension?.status === "Pending"
    );

/*
 * Mirrors hasPendingExtension above: a rental with a detected-but-unreviewed
 * early return also needs an admin decision, so it's folded into the same
 * "Awaiting review" bucket even though the booking itself may already be
 * Ongoing or Completed. booking.rental is the lightweight rental projection
 * the booking list/detail endpoints already embed (see bookingService.js).
 */
/*
 * So does a customer's request for a different driver, and a booking whose
 * driver can't take the trip any more (pickup would be refused).
 */
const needsDriverAttention = (booking) =>
    Boolean(getPendingDriverChangeRequest(booking)) ||
    Boolean(getDriverIssue(booking));

/* A customer's reschedule request waits on an admin decision too. */
const hasPendingReschedule = (booking) =>
    ["Pending", "Payment Received", "Approved"].includes(booking?.status) &&
    (booking?.reschedules || []).some(
        (reschedule) => reschedule?.status === "Pending"
    );

const hasPendingEarlyReturnCredit = (booking) =>
    booking?.rental?.earlyReturn?.detected === true &&
    booking?.rental?.earlyReturn?.status === "Pending";

const STATUS_DISPLAY_LABELS = {
    AwaitingReview: "Bookings to manage",
    MaintenanceConflicts: "Vehicle conflicts",
};

const PAYMENT_FILTER_LABELS = {
    VERIFIED: "Fee paid",
    PENDING: "Awaiting payment",
};

const PAGE_SIZE = 20;

// Server cap per export (see MAX_EXPORT_BOOKINGS in exportService.js).
const MAX_EXPORT_BOOKINGS = 3000;

const SORT_OPTIONS = [
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
    { value: "amount-desc", label: "Amount: high to low" },
    { value: "amount-asc", label: "Amount: low to high" },
    { value: "customer", label: "Customer name (A–Z)" },
];

const RENTAL_ACTION_SUCCESS = {
    pickup: "Pickup recorded — the rental is now ongoing.",
    return: "Return recorded.",
    charge: "Charge added.",
    adjustment: "Adjustment applied.",
    reassign: "Driver reassigned.",
    complete: "Rental completed.",
    outcome: "Vehicle outcome saved.",
    damage: "Damage issue logged.",
    deposit: "Security deposit updated.",
    payment: "Payment confirmed.",
};

const getCustomerText = (customer) =>
    [
        customer?.firstName,
        customer?.lastName,
        customer?.fullName,
        customer?.name,
        customer?.email,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

const getVehicleText = (vehicle) =>
    [
        vehicle?.vehicleCode,
        vehicle?.brand,
        vehicle?.model,
        vehicle?.plateNumber,
        vehicle?.name,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

const settled = (result) =>
    result?.meta?.requestStatus === "fulfilled";

const failMessage = (result, fallback) =>
    typeof result?.payload === "string"
        ? result.payload
        : fallback;

const peso = (value) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "₱0";
    }

    return `₱${amount.toLocaleString("en-PH", {
        maximumFractionDigits: 0,
    })}`;
};

/* stub: the coloured ticket stub; active: the card while its filter is on;
   label: the label's colour while active. */
const KPI_TONES = {
    amber: {
        stub: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
        active: "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/5",
        label: "text-amber-600 dark:text-amber-400",
    },
    blue: {
        stub: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
        active: "border-blue-300 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/5",
        label: "text-blue-600 dark:text-blue-400",
    },
    emerald: {
        stub: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
        active: "border-emerald-300 bg-emerald-50/60 dark:border-emerald-500/40 dark:bg-emerald-500/5",
        label: "text-emerald-600 dark:text-emerald-400",
    },
    indigo: {
        stub: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
        active: "border-indigo-300 bg-indigo-50/60 dark:border-indigo-500/40 dark:bg-indigo-500/5",
        label: "text-indigo-600 dark:text-indigo-400",
    },
    rose: {
        stub: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
        active: "border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/5",
        label: "text-rose-600 dark:text-rose-400",
    },
    orange: {
        stub: "bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400",
        active: "border-orange-300 bg-orange-50/60 dark:border-orange-500/40 dark:bg-orange-500/5",
        label: "text-orange-600 dark:text-orange-400",
    },
    slate: {
        stub: "bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400",
        active: "border-slate-300 bg-slate-50 dark:border-slate-500/40 dark:bg-slate-500/5",
        label: "text-slate-600 dark:text-slate-300",
    },
};

/*
 * A small notched ticket — coloured stub | dashed tear | numbers — echoing
 * the booking tickets below. `featured` cards (the second row) are wider,
 * with the value on the right and a "go" chevron; `alert` pulses the stub.
 * Doubles as a quick filter when onClick is given — the card itself is the
 * filter control, so there's no separate tab duplicating its count.
 */
const KpiCard = ({
    label,
    value,
    hint,
    icon: Icon,
    tone,
    onClick,
    active,
    featured = false,
    alert = false,
}) => {
    const Tag = onClick ? "button" : "div";
    const colors = KPI_TONES[tone] ?? KPI_TONES.blue;
    const stubWidth = featured ? "4.25rem" : "3rem";

    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            aria-pressed={onClick ? Boolean(active) : undefined}
            title={hint}
            className={`group block w-full rounded-2xl text-left drop-shadow-sm transition-[filter,translate] duration-200 ${
                onClick
                    ? "cursor-pointer hover:-translate-y-0.5 hover:drop-shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    : ""
            }`}
        >
            <div
                style={{ "--notch-x": `calc(${stubWidth} + 2px)` }}
                className={`kpi-ticket flex h-21 overflow-hidden rounded-2xl border ${
                    active
                        ? colors.active
                        : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                }`}
            >
                <div
                    style={{ width: stubWidth }}
                    className={`relative flex shrink-0 items-center justify-center ${colors.stub}`}
                >
                    <Icon
                        size={featured ? 22 : 18}
                        strokeWidth={2.2}
                        className="transition-transform duration-200 group-hover:scale-110"
                    />
                    {alert && (
                        <span className="absolute top-3 right-2.5 flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                        </span>
                    )}
                </div>

                <div
                    className={`flex min-w-0 flex-1 items-center gap-3 border-l-2 border-dashed border-gray-200 dark:border-gray-700 ${
                        featured ? "px-4" : "px-3"
                    }`}
                >
                    <div className="min-w-0 flex-1">
                        <p
                            className={`truncate text-[10px] font-bold uppercase tracking-[0.14em] ${
                                active
                                    ? colors.label
                                    : "text-gray-400 dark:text-gray-500"
                            }`}
                        >
                            {label}
                        </p>
                        {!featured && (
                            <p className="mt-0.5 text-xl font-black leading-tight tracking-tight text-gray-900 tabular-nums dark:text-white">
                                {value}
                            </p>
                        )}
                        {hint && (
                            <p
                                className={`text-[11px] text-gray-500 dark:text-gray-400 ${
                                    featured
                                        ? "mt-1 line-clamp-2 leading-snug"
                                        : "truncate"
                                }`}
                            >
                                {hint}
                            </p>
                        )}
                    </div>

                    {featured && (
                        <div className="flex shrink-0 items-center gap-1.5">
                            <p className="text-3xl font-black tracking-tight text-gray-900 tabular-nums dark:text-white">
                                {value}
                            </p>
                            {onClick && (
                                <ChevronRight
                                    size={18}
                                    className="text-gray-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600 dark:group-hover:text-gray-400"
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Tag>
    );
};

const Bookings = () => {
    const {
        bookings = [],
        loading = false,
        error = null,
        fetchBookings,
        clearError,
        approveExistingBooking,
        rejectExistingBooking,
        cancelExistingBooking,
        expireExistingBooking,
        markExistingBookingNoShow,
        fetchBookingById,
        approveExistingBookingExtension,
        rejectExistingBookingExtension,
        cancelExistingBookingExtension,
    } = useBooking();

    const { verifyValidId, unverifyValidId } = useUser();

    // The customer whose ID the Verify dialog is open for.
    const [verifyIdTarget, setVerifyIdTarget] = useState(null);
    const [verifyIdSubmitting, setVerifyIdSubmitting] = useState(false);

    const {
        waivePenalty,
        adjustPenalty,
        addPenaltyNote,
        applyPenalty,
        recordRefund,
        fetchRentalById,
        addRental,
        processPickup,
        processReturn,
        reassignDriver,
        addDamageIssue,
        addCharge,
        addAdjustment,
        holdSecurityDeposit,
        deductSecurityDeposit,
        releaseSecurityDeposit,
        updateVehicleOutcome,
        completeExistingRental,
        recordPayment,
        verifyPayment,
    } = useRental();

    const { drivers = [], getDrivers } = useDriver();

    const { settings, getSettings } = useSettings();

    const toast = useToast();

    const noShowGraceHours =
        settings?.refundSettings?.noShowGraceHours ??
        DEFAULT_NO_SHOW_GRACE_HOURS;

    const [search, setSearch] = useState("");
    /*
     * Lands on the management list so newly approved bookings remain
     * visible until they move to Ongoing or Completed.
     */
    const [activeStatus, setActiveStatus] = useState("AwaitingReview");
    const [detailBooking, setDetailBooking] = useState(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [selectedRentalForRefund, setSelectedRentalForRefund] =
        useState(null);
    const [penaltyModal, setPenaltyModal] = useState({
        open: false,
        mode: "adjust",
        rentalId: null,
    });
    const [penaltySubmitting, setPenaltySubmitting] = useState(false);
    const [hydratedRental, setHydratedRental] = useState(null);
    const [rentalLoading, setRentalLoading] = useState(false);
    const [actionModal, setActionModal] = useState(null);
    const [actionSubmitting, setActionSubmitting] = useState(false);
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [dateRange, setDateRange] = useState({ from: "", to: "" });
    const [driverOptionFilter, setDriverOptionFilter] = useState("");
    const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [page, setPage] = useState(1);
    const [busyId, setBusyId] = useState(null);
    const [reasonModal, setReasonModal] = useState(null);
    const [confirmState, setConfirmState] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [exporting, setExporting] = useState(false);

    const runConfirm = async () => {
        if (!confirmState?.onConfirm) {
            setConfirmState(null);
            return;
        }

        setConfirmBusy(true);

        try {
            const outcome = await confirmState.onConfirm();

            // An action may need a second confirmation (see handleMarkNoShow).
            setConfirmState(outcome?.nextConfirm ?? null);
        } finally {
            setConfirmBusy(false);
        }
    };

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    useEffect(() => {
        getSettings();
    }, [getSettings]);

    /*
     * A clock for time-based actions ("Mark as No-Show" becomes available
     * at a set time), so they appear without a page refresh.
     */
    const [now, setNow] = useState(0);

    useEffect(() => {
        const tick = () => setNow(Date.now());

        tick();

        const timer = setInterval(tick, 60 * 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!detailModalOpen) {
            setDetailBooking(null);
            setDetailLoading(false);
        }
    }, [detailModalOpen]);

    const statusCounts = useMemo(() => {
        const counts = {
            All: bookings.length,
            Pending: 0,
            "Payment Received": 0,
            Approved: 0,
            Ongoing: 0,
            Rejected: 0,
            Cancelled: 0,
            Completed: 0,
            Expired: 0,
            "No Show": 0,
        };

        bookings.forEach((booking) => {
            if (
                Object.prototype.hasOwnProperty.call(
                    counts,
                    booking?.status
                )
            ) {
                counts[booking.status] += 1;
            }
        });

        return counts;
    }, [bookings]);

    /*
     * A single booking can satisfy more than one of these conditions at
     * once (e.g. a pending extension request still unresolved when the
     * vehicle is returned early) — summing separate counts would double
     * count it, so this counts each qualifying booking once, matching
     * exactly what the "AwaitingReview" filter below shows.
     */
    const actionCount = useMemo(
        () =>
            bookings.filter(
                (booking) =>
                    MANAGED_BOOKING_STATUSES.includes(
                        booking?.status
                    ) ||
                    hasPendingExtension(booking) ||
                    hasPendingReschedule(booking) ||
                    needsDriverAttention(booking) ||
                    hasPendingEarlyReturnCredit(
                        booking
                    )
            ).length,
        [bookings]
    );

    const confirmedValue = useMemo(
        () =>
            bookings.reduce((total, booking) => {
                if (
                    [
                        "Approved",
                        "Ongoing",
                        "Completed",
                    ].includes(booking?.status)
                ) {
                    return (
                        total +
                        (Number(
                            booking?.pricing?.totalAmount
                        ) || 0)
                    );
                }

                return total;
            }, 0),
        [bookings]
    );

    const maintenanceConflictCount = useMemo(
        () => bookings.filter(hasOpenMaintenanceConflict).length,
        [bookings]
    );

    // First row: compact status counts. Second row (`featured`, wider):
    // the work queues — always shown, even at zero.
    const kpis = [
        {
            label: "Active now",
            value: statusCounts.Ongoing || 0,
            hint: "Vehicles currently out",
            icon: CarFront,
            tone: "blue",
            onClick: () => setActiveStatus("Ongoing"),
            active: activeStatus === "Ongoing",
        },
        {
            label: "Cancelled",
            value: statusCounts.Cancelled || 0,
            hint: "Cancelled bookings",
            icon: Ban,
            tone: "rose",
            onClick: () => setActiveStatus("Cancelled"),
            active: activeStatus === "Cancelled",
        },
        {
            label: "Rejected",
            value: statusCounts.Rejected || 0,
            hint: "Rejected bookings",
            icon: XCircle,
            tone: "orange",
            onClick: () => setActiveStatus("Rejected"),
            active: activeStatus === "Rejected",
        },
        {
            label: "Expired",
            value: statusCounts.Expired || 0,
            hint: "Expired bookings",
            icon: CalendarX,
            tone: "slate",
            onClick: () => setActiveStatus("Expired"),
            active: activeStatus === "Expired",
        },
        {
            label: "No-shows",
            value: statusCounts["No Show"] || 0,
            hint: "Approved but never picked up",
            icon: UserX,
            tone: "rose",
            onClick: () => setActiveStatus("No Show"),
            active: activeStatus === "No Show",
        },
        {
            label: "Confirmed value",
            value: peso(confirmedValue),
            hint: "Approved, ongoing & completed",
            icon: Wallet,
            tone: "indigo",
        },
        {
            label: "Bookings to manage",
            value: actionCount,
            hint: "Pending, paid, and approved bookings plus open requests",
            icon: Clock3,
            tone: "amber",
            onClick: () => setActiveStatus("AwaitingReview"),
            active: activeStatus === "AwaitingReview",
            featured: true,
        },
        {
            label: "Completed",
            value: statusCounts.Completed || 0,
            hint: "Finished rentals",
            icon: CheckCircle2,
            tone: "emerald",
            onClick: () => setActiveStatus("Completed"),
            active: activeStatus === "Completed",
            featured: true,
        },
        {
            label: "Vehicle conflicts",
            value: maintenanceConflictCount,
            hint:
                maintenanceConflictCount > 0
                    ? "Bookings whose vehicle won't be ready — under maintenance or still out on a late return"
                    : "No bookings are affected by maintenance or late returns",
            icon: Wrench,
            tone: maintenanceConflictCount > 0 ? "rose" : "slate",
            onClick: () => setActiveStatus("MaintenanceConflicts"),
            active: activeStatus === "MaintenanceConflicts",
            featured: true,
            alert: maintenanceConflictCount > 0,
        },
    ];

    const activeFilters = [
        dateRange.from && {
            key: "from",
            label: `From ${dateRange.from}`,
            clear: () =>
                setDateRange((current) => ({
                    ...current,
                    from: "",
                })),
        },
        dateRange.to && {
            key: "to",
            label: `To ${dateRange.to}`,
            clear: () =>
                setDateRange((current) => ({
                    ...current,
                    to: "",
                })),
        },
        driverOptionFilter && {
            key: "driver",
            label: driverOptionFilter,
            clear: () => setDriverOptionFilter(""),
        },
        paymentStatusFilter && {
            key: "payment",
            label:
                PAYMENT_FILTER_LABELS[paymentStatusFilter] ??
                paymentStatusFilter,
            clear: () => setPaymentStatusFilter(""),
        },
    ].filter(Boolean);

    const filterCount = activeFilters.length;

    const activeStatusLabel =
        STATUS_DISPLAY_LABELS[activeStatus] ?? activeStatus;

    const filteredBookings = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            if (activeStatus !== "All") {
                const matchesStatus =
                    activeStatus === "AwaitingReview"
                        ? MANAGED_BOOKING_STATUSES.includes(
                              booking?.status
                          ) ||
                          hasPendingExtension(booking) ||
                          hasPendingReschedule(booking) ||
                          needsDriverAttention(booking) ||
                          hasPendingEarlyReturnCredit(
                              booking
                          )
                        : activeStatus === "MaintenanceConflicts"
                          ? hasOpenMaintenanceConflict(booking)
                          : booking?.status === activeStatus;

                if (!matchesStatus) {
                    return false;
                }
            }

            if (
                dateRange.from &&
                booking?.createdAt &&
                new Date(booking.createdAt) <
                    new Date(dateRange.from)
            ) {
                return false;
            }

            if (
                dateRange.to &&
                booking?.createdAt &&
                new Date(booking.createdAt) >
                    new Date(`${dateRange.to}T23:59:59.999`)
            ) {
                return false;
            }

            if (
                driverOptionFilter &&
                booking?.driverOption !== driverOptionFilter
            ) {
                return false;
            }

            if (
                paymentStatusFilter &&
                booking?.paymentStatus !== paymentStatusFilter
            ) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return [
                booking?.bookingCode,
                booking?.rental?.rentalCode,
                getCustomerText(booking?.customer),
                getVehicleText(booking?.vehicle),
                booking?.driver?.firstName,
                booking?.driver?.lastName,
                booking?.driver?.name,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(normalizedSearch);
        });
    }, [
        bookings,
        activeStatus,
        search,
        dateRange,
        driverOptionFilter,
        paymentStatusFilter,
    ]);

    const sortedBookings = useMemo(() => {
        const list = [...filteredBookings];

        switch (sortBy) {
            case "oldest":
                return list.sort(
                    (a, b) =>
                        new Date(a?.createdAt || 0) -
                        new Date(b?.createdAt || 0)
                );
            case "amount-desc":
                return list.sort(
                    (a, b) =>
                        (Number(b?.pricing?.totalAmount) || 0) -
                        (Number(a?.pricing?.totalAmount) || 0)
                );
            case "amount-asc":
                return list.sort(
                    (a, b) =>
                        (Number(a?.pricing?.totalAmount) || 0) -
                        (Number(b?.pricing?.totalAmount) || 0)
                );
            case "customer":
                return list.sort((a, b) =>
                    getCustomerText(a?.customer).localeCompare(
                        getCustomerText(b?.customer)
                    )
                );
            case "newest":
            default:
                return list.sort(
                    (a, b) =>
                        new Date(b?.createdAt || 0) -
                        new Date(a?.createdAt || 0)
                );
        }
    }, [filteredBookings, sortBy]);

    const totalPages = Math.max(
        1,
        Math.ceil(sortedBookings.length / PAGE_SIZE)
    );

    const pagedBookings = useMemo(
        () =>
            sortedBookings.slice(
                (page - 1) * PAGE_SIZE,
                page * PAGE_SIZE
            ),
        [sortedBookings, page]
    );

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    useEffect(() => {
        setPage(1);
    }, [
        activeStatus,
        search,
        dateRange,
        driverOptionFilter,
        paymentStatusFilter,
        sortBy,
    ]);

    const handleApplyFilters = (filters) => {
        setDateRange(filters.dateRange);
        setDriverOptionFilter(filters.driverOption);
        setPaymentStatusFilter(filters.paymentStatus);
        setFilterModalOpen(false);
    };

    const handleResetFilters = () => {
        setDateRange({ from: "", to: "" });
        setDriverOptionFilter("");
        setPaymentStatusFilter("");
    };

    /* Every row matching the current status, search and filters - not just
       the visible page - in the chosen sort order. */
    const handleExport = async () => {
        const count = sortedBookings.length;

        if (count === 0) {
            toast.warning(
                "No bookings match the current filters.",
                "Nothing to export"
            );
            return;
        }

        if (count > MAX_EXPORT_BOOKINGS) {
            toast.error(
                `That's ${count.toLocaleString()} bookings — export up to ${MAX_EXPORT_BOOKINGS.toLocaleString()} at a time. Narrow the date range and try again.`,
                "Too many to export"
            );
            return;
        }

        setExporting(true);

        try {
            const file = await exportBookingsToExcel(
                sortedBookings.map((booking) => booking._id)
            );

            downloadBlob(
                file,
                `bookings-${toFileSlug(activeStatusLabel)}-${manilaDateStamp()}.xlsx`
            );

            toast.success(
                `${count.toLocaleString()} booking${count === 1 ? "" : "s"} exported.`,
                "Export ready"
            );
        } catch (exportError) {
            toast.error(
                await getExportErrorMessage(exportError),
                "Export failed"
            );
        } finally {
            setExporting(false);
        }
    };

    /* ---- booking actions ---- */
    const runBookingAction = async (
        bookingId,
        verb,
        call,
        successMessage
    ) => {
        setBusyId(bookingId);

        try {
            const result = await call();

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        `Unable to ${verb} booking.`
                    )
                );
            }

            toast.success(successMessage, "Done");
        } catch (actionError) {
            toast.error(
                actionError.message ||
                    `Unable to ${verb} booking.`,
                "Action failed"
            );
        } finally {
            clearError();
            setBusyId(null);
        }
    };

    const handleApprove = async (booking, driverId = null) => {
        if (!booking?._id) return;

        if (
            booking.driverOption === "With Driver" &&
            !booking.driver &&
            !driverId &&
            !detailModalOpen
        ) {
            toast.info(
                "Open the booking to assign a driver before approving.",
                "Driver required"
            );
            handleView(booking);
            return;
        }

        await runBookingAction(
            booking._id,
            "approve",
            () =>
                approveExistingBooking({
                    bookingId: booking._id,
                    driverId,
                }),
            `Booking ${booking.bookingCode ?? ""} approved.`
        );
    };

    const handleReject = (booking) => {
        if (!booking?._id) return;

        setReasonModal({
            kind: "reject-booking",
            title: `Reject booking ${booking.bookingCode ?? ""}`,
            description:
                "The customer will be notified. A reason is optional but recommended.",
            bookingId: booking._id,
            reason: "",
            submitting: false,
            required: false,
        });
    };

    const handleCancel = (booking) => {
        if (!booking?._id) return;

        setConfirmState({
            title: "Cancel Booking",
            message: `Cancel booking ${
                booking.bookingCode ?? ""
            }?`,
            confirmText: "Cancel Booking",
            cancelText: "Keep Booking",
            confirmVariant: "danger",
            onConfirm: () =>
                runBookingAction(
                    booking._id,
                    "cancel",
                    () => cancelExistingBooking(booking._id),
                    `Booking ${
                        booking.bookingCode ?? ""
                    } cancelled.`
                ),
        });
    };

    const handleExpire = (booking) => {
        if (!booking?._id) return;

        setConfirmState({
            title: "Expire Booking",
            message: `Expire booking ${
                booking.bookingCode ?? ""
            }?`,
            confirmText: "Expire Booking",
            cancelText: "Keep Booking",
            confirmVariant: "danger",
            onConfirm: () =>
                runBookingAction(
                    booking._id,
                    "expire",
                    () => expireExistingBooking(booking._id),
                    `Booking ${
                        booking.bookingCode ?? ""
                    } expired.`
                ),
        });
    };

    /*
     * Marks the no-show. If the server finds something on our side that may
     * have stopped the pickup (vehicle not back from the previous rental,
     * dates blocked, ...), nothing happens yet: it returns a second dialog
     * for the admin to confirm the customer didn't come anyway — the usual
     * answer is to cancel instead, which refunds them in full.
     */
    const markNoShow = async (booking, ignorePickupBlocker = false) => {
        const label = booking.bookingCode ?? "";

        setBusyId(booking._id);

        try {
            const result = await markExistingBookingNoShow(booking._id, {
                ignorePickupBlocker,
            });

            if (settled(result)) {
                toast.success(
                    `Booking ${label} marked as a no-show.`,
                    "Done"
                );
                return undefined;
            }

            if (result?.payload?.pickupBlocker && !ignorePickupBlocker) {
                return {
                    nextConfirm: {
                        title: "Pickup May Have Been Blocked",
                        message: result.payload.message,
                        confirmText: "Mark as No-Show Anyway",
                        cancelText: "Go Back",
                        confirmVariant: "danger",
                        onConfirm: () => markNoShow(booking, true),
                    },
                };
            }

            toast.error(
                result?.payload?.message ??
                    failMessage(result, "Unable to mark the booking as a no-show."),
                "Action failed"
            );

            return undefined;
        } finally {
            clearError();
            setBusyId(null);
        }
    };

    /*
     * No undo: the booking ends, the vehicle is released and the refund
     * starts, so the dialog spells out what the customer will lose.
     */
    const handleMarkNoShow = (booking) => {
        if (!booking?._id) return;

        // Settings → Refunds → No-shows.
        const noShowRefundPercent = Math.min(
            100,
            Math.max(0, Number(settings?.refundSettings?.noShowRefundPercent) || 0)
        );
        const keepsDistanceFee =
            settings?.refundSettings?.noShowKeepsDistanceFee !== false;

        const feeText =
            noShowRefundPercent >= 100
                ? "The reservation fee is refunded in full"
                : noShowRefundPercent > 0
                  ? `${noShowRefundPercent}% of the reservation fee is refunded`
                  : "The reservation fee is kept";

        setConfirmState({
            title: "Mark as No-Show",
            message: `Mark booking ${
                booking.bookingCode ?? ""
            } as a no-show? The customer didn't pick up the vehicle. ${feeText} and the pickup distance fee is ${
                keepsDistanceFee ? "kept" : "refunded"
            }; anything else they paid is refunded. Their voucher is not returned, and the vehicle becomes available again. This can't be undone.`,
            confirmText: "Mark as No-Show",
            cancelText: "Keep Booking",
            confirmVariant: "danger",
            onConfirm: () => markNoShow(booking),
        });
    };

    /*
     * booking.rental (from the booking endpoints) is a thin projection —
     * only enough for the late-return/penalty UI. Pickup/return/reassign/
     * deposit/complete need the full Rental document, fetched on demand.
     */
    const hydrateRental = async (rentalId) => {
        if (!rentalId) {
            setHydratedRental(null);
            return;
        }

        setRentalLoading(true);

        try {
            const result = await fetchRentalById(rentalId);
            const fresh =
                result?.payload?.data ?? result?.data ?? null;
            setHydratedRental(fresh);
        } catch {
            setHydratedRental(null);
        } finally {
            setRentalLoading(false);
        }
    };

    const handleView = async (booking) => {
        if (!booking?._id) return;

        try {
            setDetailLoading(true);
            setDetailModalOpen(true);

            const fullBooking = await fetchBookingById(
                booking._id
            );
            const resolved =
                fullBooking?.payload?.data ??
                fullBooking?.data ??
                booking;

            setDetailBooking(resolved);

            if (resolved?.rental?._id) {
                hydrateRental(resolved.rental._id);
            } else {
                setHydratedRental(null);
            }
        } catch {
            setDetailBooking(booking);
        } finally {
            setDetailLoading(false);
        }
    };

    /*
     * ?booking=<id> opens that booking (e.g. from the Drivers page's suspend
     * warning), then drops the parameter so a refresh doesn't reopen it.
     */
    const [searchParams, setSearchParams] = useSearchParams();
    const linkedBookingId = searchParams.get("booking");

    useEffect(() => {
        if (!linkedBookingId) return;

        handleView({ _id: linkedBookingId });

        setSearchParams(
            (previous) => {
                const next = new URLSearchParams(previous);
                next.delete("booking");
                return next;
            },
            { replace: true }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkedBookingId]);

    const closeDetail = () => {
        setDetailModalOpen(false);
        setDetailBooking(null);
        setHydratedRental(null);
    };

    const handleDetailApprove = async (
        bookingId,
        driverId = null
    ) => {
        await handleApprove(
            detailBooking ?? { _id: bookingId },
            driverId
        );
        closeDetail();
    };

    const handleDetailReject = (bookingId) => {
        handleReject(detailBooking ?? { _id: bookingId });
    };

    const handleDetailCancel = async (bookingId) => {
        await handleCancel(detailBooking ?? { _id: bookingId });
        closeDetail();
    };

    const handleDetailExpire = async (bookingId) => {
        await handleExpire(detailBooking ?? { _id: bookingId });
        closeDetail();
    };

    const handleDetailMarkNoShow = async (bookingId) => {
        await handleMarkNoShow(detailBooking ?? { _id: bookingId });
        closeDetail();
    };

    const refreshDetailBooking = async () => {
        if (!detailBooking?._id) return;

        const fullBooking = await fetchBookingById(
            detailBooking._id
        );
        const resolved =
            fullBooking?.payload?.data ??
            fullBooking?.data ??
            detailBooking;

        setDetailBooking(resolved);

        if (resolved?.rental?._id) {
            await hydrateRental(resolved.rental._id);
        } else {
            setHydratedRental(null);
        }
    };

    // Opens the Verify dialog, which also records the ID's expiry date.
    const handleVerifyValidId = (userId) => {
        const customer = detailBooking?.customer;

        if (
            customer &&
            String(customer._id ?? customer.id) === String(userId)
        ) {
            setVerifyIdTarget(customer);
        }
    };

    const confirmVerifyValidId = async (payload) => {
        if (!verifyIdTarget) return;

        setVerifyIdSubmitting(true);

        try {
            await verifyValidId(
                verifyIdTarget._id ?? verifyIdTarget.id,
                payload
            );
            toast.success("Valid ID verified successfully.");
            setVerifyIdTarget(null);
            await refreshDetailBooking();
        } catch (verificationError) {
            toast.error(
                typeof verificationError === "string"
                    ? verificationError
                    : "Unable to verify valid ID."
            );
        } finally {
            setVerifyIdSubmitting(false);
        }
    };

    const handleUnverifyValidId = async (userId) => {
        try {
            await unverifyValidId(userId);
            await refreshDetailBooking();
        } catch (verificationError) {
            console.error(
                "Failed to unverify valid ID:",
                verificationError
            );
        }
    };

    const handleApproveExtension = (extensionId) => {
        if (!detailBooking?._id) return;

        setConfirmState({
            title: "Approve Extension Request",
            message: "Approve this extension request?",
            confirmText: "Approve",
            confirmVariant: "success",
            onConfirm: () => approveExtension(extensionId),
        });
    };

    const approveExtension = async (extensionId) => {
        if (!detailBooking?._id) return;

        setBusyId(detailBooking._id);

        try {
            const result = await approveExistingBookingExtension(
                detailBooking._id,
                extensionId
            );

            if (!settled(result)) {
                throw new Error(
                    failMessage(
                        result,
                        "Unable to approve extension."
                    )
                );
            }

            toast.success("Extension approved.", "Done");
            await refreshDetailBooking();
            fetchBookings();
        } catch (extensionError) {
            toast.error(
                extensionError.message ||
                    "Unable to approve extension.",
                "Action failed"
            );
        } finally {
            setBusyId(null);
        }
    };

    const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);

    const handleApproveReschedule = (rescheduleId) => {
        if (!detailBooking?._id) return;

        setConfirmState({
            title: "Approve Reschedule",
            message:
                "Move this booking to the requested dates? Any price difference is settled automatically - extra is charged online, overpayment is refunded.",
            confirmText: "Approve",
            confirmVariant: "success",
            onConfirm: async () => {
                setBusyId(detailBooking._id);

                try {
                    await approveBookingReschedule(
                        detailBooking._id,
                        rescheduleId
                    );
                    toast.success("Reschedule approved.", "Done");
                    await refreshDetailBooking();
                    fetchBookings();
                } catch (rescheduleError) {
                    toast.error(
                        rescheduleError?.response?.data?.message ||
                            "Unable to approve the reschedule.",
                        "Action failed"
                    );
                } finally {
                    setBusyId(null);
                }
            },
        });
    };

    const handleRejectReschedule = (rescheduleId) => {
        if (!detailBooking?._id) return;

        setReasonModal({
            kind: "reject-reschedule",
            title: "Reject reschedule request",
            description:
                "Let the customer know why their new dates can't be used.",
            bookingId: detailBooking._id,
            rescheduleId,
            reason: "",
            submitting: false,
            required: true,
        });
    };

    const handleRejectExtension = (extensionId) => {
        if (!detailBooking?._id) return;

        setReasonModal({
            kind: "reject-extension",
            title: "Reject extension request",
            description:
                "Let the customer know why this request is being rejected.",
            bookingId: detailBooking._id,
            extensionId,
            reason: "",
            submitting: false,
            required: true,
        });
    };

    const handleCancelExtension = (extensionId) => {
        if (!detailBooking?._id) return;

        setReasonModal({
            kind: "cancel-extension",
            title: "Cancel extension request",
            description:
                "Add a reason for cancelling this extension request.",
            bookingId: detailBooking._id,
            extensionId,
            reason: "",
            submitting: false,
            required: true,
        });
    };

    const submitReason = async () => {
        if (!reasonModal) return;

        const reason = reasonModal.reason.trim();

        if (reasonModal.required && !reason) {
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
            let result;

            if (reasonModal.kind === "reject-reschedule") {
                try {
                    await rejectBookingReschedule(
                        reasonModal.bookingId,
                        reasonModal.rescheduleId,
                        reason
                    );
                    result = { meta: { requestStatus: "fulfilled" } };
                } catch (rescheduleError) {
                    result = {
                        payload:
                            rescheduleError?.response?.data?.message ||
                            "Unable to reject the reschedule.",
                    };
                }
            } else if (reasonModal.kind === "reject-booking") {
                result = await rejectExistingBooking(
                    reasonModal.bookingId,
                    reason
                );
            } else if (
                reasonModal.kind === "reject-extension"
            ) {
                result = await rejectExistingBookingExtension(
                    reasonModal.bookingId,
                    reasonModal.extensionId,
                    reason || "No reason provided"
                );
            } else {
                result = await cancelExistingBookingExtension(
                    reasonModal.bookingId,
                    reasonModal.extensionId,
                    reason || "No reason provided"
                );
            }

            if (!settled(result)) {
                throw new Error(
                    failMessage(result, "Action failed.")
                );
            }

            if (reasonModal.kind === "reject-booking") {
                toast.success("Booking rejected.", "Done");
                clearError();
                fetchBookings();
                if (detailModalOpen) closeDetail();
            } else {
                toast.success(
                    reasonModal.kind === "reject-reschedule"
                        ? "Reschedule rejected."
                        : reasonModal.kind === "reject-extension"
                          ? "Extension rejected."
                          : "Extension cancelled.",
                    "Done"
                );
                await refreshDetailBooking();
                fetchBookings();
            }

            setReasonModal(null);
        } catch (submitError) {
            toast.error(
                submitError.message || "Action failed.",
                "Failed"
            );
            setReasonModal((current) =>
                current
                    ? { ...current, submitting: false }
                    : current
            );
        }
    };

    const handleRecordRefund = (booking) => {
        const rental = booking?.rental;
        if (!rental?._id) return;

        setSelectedRentalForRefund(rental);
        setRefundModalOpen(true);
    };

    const handleSubmitRefund = async (refundData) => {
        if (!selectedRentalForRefund?._id) return;

        try {
            await recordRefund(
                selectedRentalForRefund._id,
                refundData
            );
            toast.success(
                "Refund recorded successfully.",
                "Success"
            );
            setRefundModalOpen(false);
            setSelectedRentalForRefund(null);
            await refreshDetailBooking();
            fetchBookings();
        } catch (refundError) {
            toast.error(
                refundError?.response?.data?.message ||
                    "Unable to record refund.",
                "Error"
            );
        }
    };

    const openPenaltyModal = (mode, rentalId) => {
        if (!rentalId) return;
        setPenaltyModal({ open: true, mode, rentalId });
    };

    const closePenaltyModal = () => {
        setPenaltyModal((prev) => ({ ...prev, open: false }));
    };

    const handleWaivePenalty = (rentalId) =>
        openPenaltyModal("waive", rentalId);

    const handleAdjustPenalty = (rentalId) =>
        openPenaltyModal("adjust", rentalId);

    const handleAddPenaltyNote = (rentalId) =>
        openPenaltyModal("note", rentalId);

    const handleApplyPenalty = (rentalId) =>
        openPenaltyModal("apply", rentalId);

    const handlePenaltySubmit = async ({
        mode,
        rentalId,
        newAmount,
        reason,
    }) => {
        if (!rentalId) return;

        const trimmedReason = reason?.trim() || "";

        setPenaltySubmitting(true);

        try {
            if (mode === "waive") {
                await waivePenalty({
                    rentalId,
                    reason: trimmedReason,
                }).unwrap();
                toast.success(
                    "Penalty waived successfully.",
                    "Success"
                );
            } else if (mode === "adjust") {
                await adjustPenalty({
                    rentalId,
                    newAmount,
                    reason: trimmedReason,
                }).unwrap();
                toast.success(
                    "Penalty adjusted successfully.",
                    "Success"
                );
            } else if (mode === "note") {
                await addPenaltyNote({
                    rentalId,
                    reason: trimmedReason,
                }).unwrap();
                toast.success(
                    "Penalty note added successfully.",
                    "Success"
                );
            } else if (mode === "apply") {
                await applyPenalty({
                    rentalId,
                    reason: trimmedReason,
                }).unwrap();
                toast.success(
                    "Penalty applied successfully.",
                    "Success"
                );
            }

            closePenaltyModal();
            await refreshDetailBooking();
            fetchBookings();
        } catch (penaltyError) {
            toast.error(
                penaltyError || "Unable to update penalty.",
                "Error"
            );
        } finally {
            setPenaltySubmitting(false);
        }
    };

    /*
     * Rental-lifecycle actions (pickup → return → complete, plus reassign/
     * damage/charge/adjustment/deposit/outcome along the way), ported from
     * the standalone Rentals page so a booking never needs a second page.
     *
     * `onPickup` is opened with a *booking* (no rental exists yet); every
     * other action is opened with a *rental*-shaped object — the row's
     * thin `booking.rental` for Return (all it needs), or the hydrated
     * `hydratedRental` for anything opened from the drawer.
     */
    const openAction = (mode, target) => {
        if (!target?._id) return;

        if (mode === "pickup") {
            setActionModal({
                mode,
                booking: target,
                rental: target.rental ?? null,
            });
        } else {
            setActionModal({
                mode,
                booking: null,
                rental: target,
            });
        }

        if (mode === "reassign") {
            getDrivers({
                status: "ACTIVE",
                availability: "AVAILABLE",
            });
        }
    };

    const closeAction = () => {
        if (!actionSubmitting) {
            setActionModal(null);
        }
    };

    const submitAction = async (payload) => {
        if (!actionModal) return;

        const { mode, booking, rental } = actionModal;

        if (mode !== "pickup" && !rental?._id) {
            return;
        }

        // Only creating the rental takes the early-release confirmation.
        const { releaseEarly = false, ...actionPayload } = payload ?? {};
        payload = actionPayload;

        setActionSubmitting(true);

        try {
            let rentalId = rental?._id;

            if (mode === "pickup" && !rentalId) {
                const created = await addRental(booking._id, {
                    releaseEarly,
                });

                if (!settled(created)) {
                    throw new Error(
                        failMessage(
                            created,
                            "Unable to start pickup."
                        )
                    );
                }

                const createdRental =
                    created?.payload?.data ?? created?.data;

                rentalId = createdRental?._id;

                // The rental is timed from now; say so if it had to be
                // shortened to end before the next booking.
                if (createdRental?.bookingPeriod?.returnCapped) {
                    toast.warning(
                        `This rental is due back ${new Date(
                            createdRental.actualEndDate
                        ).toLocaleString("en-PH", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                        })}, earlier than its full booked duration, because the vehicle or driver is booked right after it.`,
                        "Return time shortened"
                    );
                }
            }

            let call;

            if (mode === "pickup") {
                call = () => processPickup(rentalId, payload);
            } else if (mode === "return") {
                call = () => processReturn(rentalId, payload);
            } else if (mode === "charge") {
                call = () => addCharge(rentalId, payload);
            } else if (mode === "adjustment") {
                call = () => addAdjustment(rentalId, payload);
            } else if (mode === "damage") {
                call = () => addDamageIssue(rentalId, payload);
            } else if (mode === "payment") {
                call = async () => {
                    const recorded = await recordPayment(
                        rentalId,
                        {
                            type: RENTAL_PAYMENT_TYPE.ADDITIONAL_PAYMENT,
                            amount: payload.amount,
                            paymentMethod:
                                payload.paymentMethod,
                            reference:
                                payload.reference || "",
                            notes: payload.notes || "",
                        }
                    );

                    if (!settled(recorded)) {
                        return recorded;
                    }

                    const updatedRental =
                        recorded?.payload?.data ??
                        recorded?.data;
                    const newPayment =
                        updatedRental?.payments?.[
                            updatedRental.payments.length - 1
                        ];

                    if (!newPayment?._id) {
                        return recorded;
                    }

                    return verifyPayment(
                        rentalId,
                        newPayment._id,
                        RENTAL_PAYMENT_STATUS.VERIFIED
                    );
                };
            } else if (mode === "outcome") {
                call = () =>
                    updateVehicleOutcome(
                        rentalId,
                        payload.vehicleOutcome,
                        payload.maintenancePlan ?? null
                    );
            } else if (mode === "reassign") {
                call = () =>
                    reassignDriver(
                        rentalId,
                        payload.newDriver,
                        payload.reason || ""
                    );
            } else if (mode === "complete") {
                call = () =>
                    completeExistingRental(
                        rentalId,
                        payload.notes || "",
                        payload.overrideOutstandingBalance ===
                            true
                    );
            } else if (mode === "deposit") {
                if (payload.action === "hold") {
                    call = () =>
                        holdSecurityDeposit(rentalId);
                } else if (payload.action === "release") {
                    call = () =>
                        releaseSecurityDeposit(rentalId);
                } else {
                    call = () =>
                        deductSecurityDeposit(
                            rentalId,
                            payload.amount,
                            payload.reason
                        );
                }
            }

            if (!call) return;

            const result = await call();

            if (!settled(result)) {
                throw new Error(
                    failMessage(result, "Action failed.")
                );
            }

            toast.success(
                RENTAL_ACTION_SUCCESS[mode] ?? "Done.",
                "Success"
            );

            // Maintenance that runs into upcoming bookings flags them.
            const flaggedCount =
                (result?.payload?.data ?? result?.data)
                    ?.maintenanceConflicts?.length ?? 0;

            if (mode === "outcome" && flaggedCount > 0) {
                toast.warning(
                    `${flaggedCount} upcoming booking${
                        flaggedCount === 1 ? "" : "s"
                    } overlap this maintenance. Open ${
                        flaggedCount === 1 ? "it" : "each one"
                    } (filter: Vehicle conflicts) to send the customer their options.`,
                    "Bookings affected"
                );
            }

            clearError();
            await refreshDetailBooking();
            fetchBookings();

            /*
             * The return form no longer collects vehicleOutcome (it has no
             * fields left at all — see RentalActionModal). completeRental
             * still refuses to run without one being set, so rather than
             * leaving that to a separate, easy-to-forget "Set Outcome"
             * action, chain straight into that modal for the same rental
             * the moment a return succeeds.
             */
            if (mode === "return") {
                const returnedRental =
                    result?.payload?.data ??
                    result?.data ??
                    { _id: rentalId };

                setActionModal({
                    mode: "outcome",
                    booking: null,
                    rental: returnedRental,
                });
            } else {
                setActionModal(null);
            }
        } catch (actionError) {
            toast.error(
                actionError.message || "Action failed.",
                "Failed"
            );
        } finally {
            setActionSubmitting(false);
        }
    };

    const handlePickup = (booking) =>
        openAction("pickup", booking);

    const handleReturn = (rental) =>
        openAction("return", rental);

    const handleReassignDriver = (rental) =>
        openAction("reassign", rental);

    const handleDamageIssue = (rental) =>
        openAction("damage", rental);

    const handleCharge = (rental) =>
        openAction("charge", rental);

    const handleAdjustment = (rental) =>
        openAction("adjustment", rental);

    const handlePayment = (rental) =>
        openAction("payment", rental);

    const handleSecurityDeposit = (rental) =>
        openAction("deposit", rental);

    const handleVehicleOutcome = (rental) =>
        openAction("outcome", rental);

    const handleComplete = (rental) =>
        openAction("complete", rental);

    return (
        <div className="w-full">
            {/* Search & filter panel — the status tab row is gone now that
                every status has its own KPI card below; this is just
                search, sort, and the date/driver/payment filters. */}
            <div className="mx-auto mb-6 w-full max-w-3xl">
                <div className="flex items-center gap-2">
                    {/* One pill: search · sort · filters (theme-aware glass) */}
                    <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full border border-gray-200/80 bg-white/80 p-1.5 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
                        <div className="relative min-w-0 flex-1">
                            <Search
                                size={17}
                                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Search bookings..."
                                className="h-10 w-full rounded-full bg-transparent pl-11 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:bg-gray-100/80 dark:text-white dark:placeholder:text-gray-500 dark:focus:bg-gray-800/60"
                            />
                        </div>

                        {/* Phones get sort on its own row below, so the
                            search box keeps its room. */}
                        <span
                            aria-hidden="true"
                            className="hidden h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700 sm:block"
                        />

                        <Select
                            bare
                            wrapperClassName="hidden shrink-0 sm:block"
                            aria-label="Sort bookings"
                            value={sortBy}
                            onChange={(event) =>
                                setSortBy(event.target.value)
                            }
                            options={SORT_OPTIONS}
                            className="h-10 cursor-pointer rounded-full bg-transparent pl-4 pr-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-gray-200 dark:hover:bg-gray-800"
                        />

                        <span
                            aria-hidden="true"
                            className="h-6 w-px shrink-0 bg-gray-200 dark:bg-gray-700"
                        />

                        <button
                            type="button"
                            onClick={() => setFilterModalOpen(true)}
                            className={`relative inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition ${
                                filterCount > 0
                                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/25 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                            }`}
                        >
                            <SlidersHorizontal size={16} />
                            <span className="hidden sm:inline">
                                Filters
                            </span>
                            {filterCount > 0 && (
                                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1 text-xs font-bold text-white">
                                    {filterCount}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Exports exactly the filtered, sorted list (every page). */}
                    <ExportExcelPill
                        size="lg"
                        onClick={handleExport}
                        loading={exporting}
                        disabled={loading || sortedBookings.length === 0}
                    />
                </div>

                <div className="mt-2 flex justify-end px-1 sm:hidden">
                    <Select
                        bare
                        aria-label="Sort bookings"
                        value={sortBy}
                        onChange={(event) =>
                            setSortBy(event.target.value)
                        }
                        options={SORT_OPTIONS}
                        className="h-9 cursor-pointer rounded-full border border-gray-200/80 bg-white/80 pl-4 pr-3.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900/80 dark:text-gray-200 dark:hover:bg-gray-800"
                    />
                </div>

                {activeFilters.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 px-2">
                        {activeFilters.map((filter) => (
                            <button
                                key={filter.key}
                                type="button"
                                onClick={filter.clear}
                                className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 py-1 pl-3 pr-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                                {filter.label}
                                <X size={13} />
                            </button>
                        ))}

                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Clear all
                        </button>
                    </div>
                )}
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
                className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
            >
                {kpis.map((kpi) => (
                    <motion.div
                        key={kpi.label}
                        className={
                            kpi.featured
                                ? "col-span-2 sm:col-span-1 xl:col-span-2"
                                : undefined
                        }
                        variants={{
                            hidden: { opacity: 0, y: 12 },
                            show: { opacity: 1, y: 0 },
                        }}
                    >
                        <KpiCard {...kpi} />
                    </motion.div>
                ))}
            </motion.div>

            {error && bookings.length === 0 && !loading && (
                <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                    <span>
                        {typeof error === "string"
                            ? error
                            : "Unable to load bookings."}
                    </span>
                    <button
                        type="button"
                        onClick={() => fetchBookings()}
                        className="font-semibold underline underline-offset-2"
                    >
                        Try again
                    </button>
                </div>
            )}

            {(loading || filteredBookings.length > 0) && (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <AdminBookingTable
                        bookings={pagedBookings}
                        loading={loading && bookings.length === 0}
                        busyId={busyId}
                        onView={handleView}
                        onApprove={handleApprove}
                        onReject={handleReject}
                        onCancel={handleCancel}
                        onExpire={handleExpire}
                        onMarkNoShow={handleMarkNoShow}
                        noShowGraceHours={noShowGraceHours}
                        now={now}
                        onPickup={handlePickup}
                        onReturn={handleReturn}
                        onVehicleOutcome={handleVehicleOutcome}
                        onPayment={handlePayment}
                    />
                </div>
            )}

            {!loading && filteredBookings.length > 0 && (
                <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                    <p className="text-xs font-medium text-gray-400 dark:text-gray-500">
                        Showing {pagedBookings.length} of{" "}
                        {filteredBookings.length}{" "}
                        {filteredBookings.length === 1
                            ? "booking"
                            : "bookings"}
                        {activeStatus !== "All"
                            ? ` · ${activeStatusLabel}`
                            : ""}
                    </p>

                    {totalPages > 1 && (
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    )}
                </div>
            )}

            {!loading && filteredBookings.length === 0 && (
                <EmptyState
                    title="No bookings found"
                    description={
                        search.trim() || filterCount > 0
                            ? "No bookings match your current filters."
                            : `No bookings in the ${activeStatusLabel} status.`
                    }
                    action={
                        (search.trim() || filterCount > 0) && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setSearch("");
                                    handleResetFilters();
                                }}
                            >
                                Clear filters
                            </Button>
                        )
                    }
                />
            )}

            <VerifyValidIdDialog
                isOpen={Boolean(verifyIdTarget)}
                user={verifyIdTarget}
                loading={verifyIdSubmitting}
                onClose={() => {
                    if (!verifyIdSubmitting) setVerifyIdTarget(null);
                }}
                onConfirm={confirmVerifyValidId}
            />

            <AdminBookingDetailModal
                isOpen={detailModalOpen}
                onClose={closeDetail}
                booking={detailBooking}
                loading={detailLoading}
                onApprove={handleDetailApprove}
                onReject={handleDetailReject}
                onCancel={handleDetailCancel}
                onExpire={handleDetailExpire}
                onMarkNoShow={handleDetailMarkNoShow}
                noShowGraceHours={noShowGraceHours}
                now={now}
                onVerifyValidId={handleVerifyValidId}
                onUnverifyValidId={handleUnverifyValidId}
                onApproveExtension={handleApproveExtension}
                onRejectExtension={handleRejectExtension}
                onCancelExtension={handleCancelExtension}
                onApproveReschedule={handleApproveReschedule}
                onRejectReschedule={handleRejectReschedule}
                onReschedule={() => setRescheduleModalOpen(true)}
                onWaivePenalty={handleWaivePenalty}
                onAdjustPenalty={handleAdjustPenalty}
                onAddPenaltyNote={handleAddPenaltyNote}
                onApplyPenalty={handleApplyPenalty}
                onRecordRefund={handleRecordRefund}
                rentalDetail={hydratedRental}
                rentalLoading={rentalLoading}
                onPickup={handlePickup}
                onReturn={handleReturn}
                onReassignDriver={handleReassignDriver}
                onDamageIssue={handleDamageIssue}
                onCharge={handleCharge}
                onAdjustment={handleAdjustment}
                onPayment={handlePayment}
                onSecurityDeposit={handleSecurityDeposit}
                onVehicleOutcome={handleVehicleOutcome}
                onComplete={handleComplete}
                onRetryRental={refreshDetailBooking}
                onMaintenanceConflictChanged={async () => {
                    await refreshDetailBooking();
                    fetchBookings();
                }}
                onDriverChanged={async () => {
                    await refreshDetailBooking();
                    fetchBookings();
                }}
            />

            <RescheduleModal
                isOpen={rescheduleModalOpen}
                onClose={() => setRescheduleModalOpen(false)}
                booking={detailBooking}
                mode="admin"
                onDone={async () => {
                    await refreshDetailBooking();
                    fetchBookings();
                }}
            />

            <RefundModal
                isOpen={refundModalOpen}
                onClose={() => {
                    setRefundModalOpen(false);
                    setSelectedRentalForRefund(null);
                }}
                onSubmit={handleSubmitRefund}
                loading={loading}
                rental={selectedRentalForRefund}
            />

            <RentalActionModal
                isOpen={Boolean(actionModal)}
                mode={actionModal?.mode}
                rental={actionModal?.rental}
                booking={actionModal?.booking}
                earlyPickupAllowed={
                    settings?.bookingSettings?.earlyPickup?.allowAnytime ===
                    true
                }
                drivers={drivers}
                loading={actionSubmitting}
                onClose={closeAction}
                onSubmit={submitAction}
            />

            <PenaltyActionModal
                isOpen={penaltyModal.open}
                mode={penaltyModal.mode}
                onClose={closePenaltyModal}
                rental={detailBooking?.rental}
                maximumCap={getBookingPenaltyCap(
                    detailBooking,
                    settings?.penaltySettings?.maximumCap
                )}
                loading={penaltySubmitting}
                onSubmit={handlePenaltySubmit}
            />

            {filterModalOpen && (
                <BookingFilters
                    filters={{
                        dateRange,
                        driverOption: driverOptionFilter,
                        paymentStatus: paymentStatusFilter,
                    }}
                    onApply={handleApplyFilters}
                    onReset={handleResetFilters}
                    onClose={() => setFilterModalOpen(false)}
                />
            )}

            <Modal
                isOpen={Boolean(reasonModal)}
                onClose={() => {
                    if (!reasonModal?.submitting) {
                        setReasonModal(null);
                    }
                }}
                title={reasonModal?.title || "Provide a reason"}
                size="sm"
                footer={
                    <>
                        <Button
                            variant="secondary"
                            onClick={() => setReasonModal(null)}
                            disabled={reasonModal?.submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            loading={reasonModal?.submitting}
                            onClick={submitReason}
                        >
                            Confirm
                        </Button>
                    </>
                }
            >
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                    {reasonModal?.description}
                </p>
                <Textarea
                    label="Reason"
                    required={reasonModal?.required}
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
                    placeholder="Add a note for the customer..."
                />
            </Modal>

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
                cancelText={
                    confirmState?.cancelText ?? "Cancel"
                }
                confirmVariant={
                    confirmState?.confirmVariant ?? "danger"
                }
                loading={confirmBusy}
            />
        </div>
    );
};

export default Bookings;
