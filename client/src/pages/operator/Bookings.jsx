import {
    ArrowRight,
    CalendarClock,
    CarFront,
    CheckCircle2,
    ClipboardList,
    ImageOff,
    RefreshCw,
    UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import useBooking from "../../hooks/bookings/useBooking";
import OperatorBookingDetailModal from "../../components/modals/OperatorBookingDetailModal";
import EmptyState from "../../components/common/EmptyState";
import PillSearch from "../../components/common/PillSearch";
import PillTabs from "../../components/common/PillTabs";
import StatusChip from "../../components/common/StatusChip";
import getVehicleCardData from "../../utils/getVehicleCardData";

import {
    formatDateRange,
    formatDuration,
    getRenterName,
    peso,
} from "../../utils/operatorBookingFormat";

/*
 * A partner's read-only view of bookings on their vehicles: when each
 * vehicle is out, who has it, how the rental went, and what the partner
 * earns from it. The server sends an allowlisted booking for partners (see
 * toOperatorBookingView) - nothing here to approve, cancel or refund; the
 * platform (admin) runs the booking end to end.
 *
 * Statuses are grouped the way a vehicle owner thinks about them rather
 * than the nine raw booking states.
 */
const STATUS_GROUPS = {
    upcoming: ["Pending", "Payment Received", "Approved"],
    ongoing: ["Ongoing"],
    completed: ["Completed"],
    cancelled: ["Cancelled", "Rejected", "Expired", "No Show"],
};

const TABS = [
    { value: "active", label: "Active" },
    { value: "upcoming", label: "Upcoming" },
    { value: "ongoing", label: "On the road" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "all", label: "All" },
];

const inTab = (booking, tab) => {
    if (tab === "all") return true;
    if (tab === "active") {
        return (
            STATUS_GROUPS.upcoming.includes(booking.status) ||
            STATUS_GROUPS.ongoing.includes(booking.status)
        );
    }
    return STATUS_GROUPS[tab]?.includes(booking.status) ?? false;
};

const KPI_TONES = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    emerald:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
};

const KpiCard = ({ label, value, hint, icon: Icon, tone, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="group flex w-full flex-col rounded-2xl border border-gray-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
    >
        <span className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {label}
            </span>
            <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${KPI_TONES[tone]}`}
            >
                <Icon size={17} />
            </span>
        </span>
        <span className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">
            {value}
        </span>
        <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {hint}
        </span>
    </button>
);

/* What the right-hand side of a booking row says about the partner's money. */
const EarningsCell = ({ booking }) => {
    if (booking.earnings) {
        return (
            <>
                <span className="block text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {peso(booking.earnings.amount)}
                </span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                    {booking.earnings.payoutStatus === "PAID"
                        ? "Paid out"
                        : "Payout scheduled"}
                </span>
            </>
        );
    }

    if (STATUS_GROUPS.cancelled.includes(booking.status)) {
        return (
            <span className="text-xs text-gray-400 dark:text-gray-500">
                No earnings
            </span>
        );
    }

    return (
        <span className="text-xs text-gray-500 dark:text-gray-400">
            {booking.status === "Completed"
                ? "Payout pending"
                : "After the trip"}
        </span>
    );
};

const BookingRow = ({ booking, onOpen, index }) => {
    const image = getVehicleCardData(booking.vehicle ?? {}).image;

    return (
        <motion.li
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index, 8) * 0.03 }}
        >
            <button
                type="button"
                onClick={() => onOpen(booking)}
                className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left transition hover:bg-gray-50 sm:px-5 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto] dark:hover:bg-gray-800/50"
            >
                {/* Vehicle */}
                <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                    {image ? (
                        <img src={image} alt="" className="h-full w-full object-cover" />
                    ) : (
                        <ImageOff size={18} className="text-gray-400" />
                    )}
                </span>

                <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {[booking.vehicle?.brand, booking.vehicle?.model]
                            .filter(Boolean)
                            .join(" ") || "Your vehicle"}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                        {booking.bookingCode}
                        {booking.vehicle?.plateNumber
                            ? ` · ${booking.vehicle.plateNumber}`
                            : ""}
                    </span>
                    {/* Dates fold under the name on small screens. */}
                    <span className="mt-1 block truncate text-xs text-gray-600 lg:hidden dark:text-gray-300">
                        {formatDateRange(booking.startDate, booking.endDate)}
                    </span>
                </span>

                {/* Dates */}
                <span className="hidden min-w-0 lg:block">
                    <span className="block truncate text-sm text-gray-800 dark:text-gray-200">
                        {formatDateRange(booking.startDate, booking.endDate)}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {formatDuration(booking.rentalDays)}
                        {booking.extensionCount > 0 && (
                            <span className="ml-1.5 font-medium text-blue-600 dark:text-blue-400">
                                · Extended
                            </span>
                        )}
                    </span>
                </span>

                {/* Renter */}
                <span className="hidden min-w-0 items-center gap-1.5 truncate text-sm text-gray-600 lg:flex dark:text-gray-300">
                    <UserRound size={14} className="shrink-0 text-gray-400" />
                    <span className="truncate">{getRenterName(booking.customer)}</span>
                </span>

                {/* Status */}
                <span className="justify-self-end lg:justify-self-center">
                    <StatusChip status={booking.status} size="sm" />
                </span>

                {/* Earnings */}
                <span className="col-span-3 flex items-center justify-between gap-3 border-t border-dashed border-gray-100 pt-2 text-right lg:col-span-1 lg:block lg:min-w-28 lg:border-0 lg:pt-0 dark:border-gray-800">
                    <span className="text-xs text-gray-500 lg:hidden dark:text-gray-400">
                        Your earnings
                    </span>
                    <span>
                        <EarningsCell booking={booking} />
                    </span>
                </span>
            </button>
        </motion.li>
    );
};

const Bookings = () => {
    const {
        bookings = [],
        loading = false,
        error = null,
        fetchBookings,
        fetchBookingById,
    } = useBooking();

    const [search, setSearch] = useState("");
    const [tab, setTab] = useState("active");
    const [detail, setDetail] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    const load = () => fetchBookings({ role: "operator" });

    useEffect(() => {
        fetchBookings({ role: "operator" });
    }, [fetchBookings]);

    const counts = useMemo(
        () =>
            Object.fromEntries(
                TABS.map(({ value }) => [
                    value,
                    bookings.filter((booking) => inTab(booking, value)).length,
                ])
            ),
        [bookings]
    );

    const completedEarnings = useMemo(
        () =>
            bookings.reduce(
                (sum, booking) => sum + (Number(booking.earnings?.amount) || 0),
                0
            ),
        [bookings]
    );

    const visible = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return bookings.filter((booking) => {
            if (!inTab(booking, tab)) return false;
            if (!keyword) return true;

            return [
                booking.bookingCode,
                booking.rental?.rentalCode,
                booking.vehicle?.brand,
                booking.vehicle?.model,
                booking.vehicle?.plateNumber,
                booking.vehicle?.vehicleCode,
                booking.customer?.firstName,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });
    }, [bookings, tab, search]);

    const openDetail = async (booking) => {
        setDetail(booking);
        setDetailOpen(true);
        setDetailLoading(true);

        try {
            const result = await fetchBookingById(booking._id);
            const fresh = result?.payload?.data ?? result?.data;

            if (fresh) {
                setDetail(fresh);
            }
        } catch {
            // Keep showing the list row's copy - it's the same view.
        } finally {
            setDetailLoading(false);
        }
    };

    const closeDetail = () => {
        setDetailOpen(false);
        setDetail(null);
    };

    const kpis = [
        {
            key: "ongoing",
            label: "On the road",
            value: counts.ongoing,
            hint: "Vehicles out with a renter now",
            icon: CarFront,
            tone: "blue",
        },
        {
            key: "upcoming",
            label: "Upcoming",
            value: counts.upcoming,
            hint: "Booked, not yet picked up",
            icon: CalendarClock,
            tone: "amber",
        },
        {
            key: "completed",
            label: "Completed",
            value: counts.completed,
            hint:
                completedEarnings > 0
                    ? `${peso(completedEarnings)} earned`
                    : "Finished rentals",
            icon: CheckCircle2,
            tone: "emerald",
        },
    ];

    return (
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
            {/* Controls: search → status, centred like the other pages. */}
            <div className="flex flex-col items-center gap-3">
                <PillSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search by booking code, vehicle, plate, or renter..."
                    label="Search bookings"
                />

                <PillTabs
                    label="Booking status"
                    size="sm"
                    layoutId="operator-bookings-status"
                    value={tab}
                    onChange={setTab}
                    countTone="muted"
                    options={TABS.map((option) => ({
                        ...option,
                        count: counts[option.value],
                    }))}
                />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {kpis.map(({ key, ...kpi }) => (
                    <KpiCard key={key} {...kpi} onClick={() => setTab(key)} />
                ))}
            </div>

            {error && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                    <span>
                        {typeof error === "string" ? error : "Unable to load bookings."}
                    </span>
                    <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"
                    >
                        <RefreshCw size={14} />
                        Retry
                    </button>
                </div>
            )}

            <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                {/* Column labels (desktop) */}
                <div className="hidden grid-cols-[4rem_minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto] gap-x-4 border-b border-gray-100 bg-gray-50/70 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 lg:grid dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500">
                    <span />
                    <span>Vehicle</span>
                    <span>Dates</span>
                    <span>Renter</span>
                    <span className="text-center">Status</span>
                    <span className="min-w-28 text-right">Your earnings</span>
                </div>

                {loading && bookings.length === 0 ? (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        {[0, 1, 2, 3].map((item) => (
                            <li key={item} className="flex items-center gap-4 px-5 py-4">
                                <span className="h-12 w-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                                <span className="h-4 flex-1 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                            </li>
                        ))}
                    </ul>
                ) : visible.length === 0 ? (
                    <EmptyState
                        icon={ClipboardList}
                        title={
                            bookings.length === 0
                                ? "No bookings yet"
                                : "No bookings found"
                        }
                        description={
                            bookings.length === 0
                                ? "Bookings for your vehicles will show up here."
                                : search.trim()
                                  ? "No bookings match your search."
                                  : "Nothing in this group right now."
                        }
                    />
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                        <AnimatePresence initial={false}>
                            {visible.map((booking, index) => (
                                <BookingRow
                                    key={booking._id}
                                    booking={booking}
                                    index={index}
                                    onOpen={openDetail}
                                />
                            ))}
                        </AnimatePresence>
                    </ul>
                )}
            </section>

            {visible.length > 0 && (
                <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    Select a booking to see the trip and your earnings
                    <ArrowRight size={12} />
                </p>
            )}

            <OperatorBookingDetailModal
                isOpen={detailOpen}
                onClose={closeDetail}
                booking={detail}
                loading={detailLoading && !detail}
            />
        </div>
    );
};

export default Bookings;
