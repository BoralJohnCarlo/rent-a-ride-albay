import {
    ArrowRight,
    BarChart3,
    CalendarCheck,
    Car,
    CheckCircle2,
    Clock3,
    LayoutGrid,
    PhilippinePeso,
    RefreshCw,
    Sparkles,
    TicketCheck,
    Users,
} from "lucide-react";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Bar,
    BarChart,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import { useNavigate } from "react-router-dom";

import FleetSummary from "../../../components/dashboard/FleetSummary";
import QuickStats from "../../../components/dashboard/QuickStats";
import RecentBookingsCard from "../../../components/dashboard/RecentBookingsCard";
import RecentPayments from "../../../components/dashboard/RecentPayments";
import RevenueWidget from "../../../components/dashboard/RevenueWidget";
import VehicleLeaderboard from "../../../components/dashboard/VehicleLeaderboard";
import AnimatedCounter from "../../../components/dashboard/AnimatedCounter";
import Select from "../../../components/common/Select";

import Welcome from "../../../assets/images/AdminDashboard/Welcome.png";
import MorePossibilities from "../../../assets/images/AdminDashboard/MorePossibilities.png";

import { getDashboardData } from "../../../store/dashboard";
import useStatistics from "../../../hooks/statistics/useStatistics";
import useAuth from "../../../hooks/auth/useAuth";
import { useIsDarkTheme } from "../../../hooks/theme";

const PERIOD_OPTIONS = [
    {
        value: "7d",
        label: "Last 7 Days",
    },
    {
        value: "30d",
        label: "Last 30 Days",
    },
    {
        value: "month",
        label: "This Month",
    },
    {
        value: "year",
        label: "This Year",
    },
];

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

const formatCompactCurrency = (value) => {
    const amount = Number(value);

    if (Number.isNaN(amount)) {
        return "₱0";
    }

    return `₱${amount.toLocaleString("en-PH")}`;
};

/* Y-axis money ticks: exact under ₱1k (so small amounts don't all read
   "₱0k"), then compact k / M. */
const formatAxisCurrency = (value) => {
    const amount = Number(value) || 0;
    const abs = Math.abs(amount);

    if (abs >= 1_000_000) {
        return `₱${+(amount / 1_000_000).toFixed(1)}M`;
    }

    if (abs >= 1_000) {
        return `₱${+(amount / 1_000).toFixed(1)}k`;
    }

    return `₱${Math.round(amount)}`;
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

const formatRelativeTime = (date) => {
    if (!date) {
        return "not yet";
    }

    const seconds = Math.floor(
        (Date.now() - date.getTime()) / 1000
    );

    if (seconds < 10) {
        return "just now";
    }

    if (seconds < 60) {
        return `${seconds}s ago`;
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    return `${hours}h ago`;
};

const CHART_COLORS = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
];

const STAT_ROUTES = {
    users: "/admin/users",
    vehicles: "/admin/vehicles",
    bookings: "/admin/bookings",
    revenue: "/admin/payments",
};

const INSIGHT_TONES = {
    blue: "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/40",
    emerald:
        "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/40",
    amber: "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40",
    rose: "bg-rose-50 text-rose-600 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/40",
    violet: "bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900/40",
    sky: "bg-sky-50 text-sky-600 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/40",
};

/* ----------------------------------------------------------------------------
   Motion presets
---------------------------------------------------------------------------- */
const EASE_OUT = [0.22, 1, 0.36, 1];

const containerVariants = {
    hidden: {},
    show: {
        transition: {
            staggerChildren: 0.07,
            delayChildren: 0.04,
        },
    },
};

const fadeUpVariants = {
    hidden: {
        opacity: 0,
        y: 18,
    },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            ease: EASE_OUT,
        },
    },
};

/* ----------------------------------------------------------------------------
   Small building blocks
---------------------------------------------------------------------------- */
const SectionCard = ({
    children,
    className = "",
    interactive = true,
    ...rest
}) => (
    <motion.section
        variants={fadeUpVariants}
        whileHover={
            interactive
                ? {
                      y: -3,
                      boxShadow:
                          "0 22px 45px rgba(15, 23, 42, 0.10)",
                  }
                : undefined
        }
        transition={{
            duration: 0.25,
            ease: EASE_OUT,
        }}
        className={`
            rounded-2xl
            border
            border-gray-200/80
            bg-white
            shadow-sm
            dark:border-gray-800
            dark:bg-gray-900
            ${className}
        `}
        {...rest}
    >
        {children}
    </motion.section>
);

const CardHeading = ({
    icon: Icon,
    tone = "blue",
    title,
    subtitle,
    action,
}) => (
    <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
            <div
                className={`
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    ${INSIGHT_TONES[tone] || INSIGHT_TONES.blue}
                    ring-1
                `}
            >
                <Icon size={19} />
            </div>

            <div>
                <h3 className="font-bold text-gray-900 dark:text-white">
                    {title}
                </h3>

                {subtitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {subtitle}
                    </p>
                )}
            </div>
        </div>

        {action}
    </div>
);

const ChartSkeleton = ({ height = 300 }) => (
    <div
        className="w-full animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
        style={{ height }}
    />
);

const ErrorBanner = ({ message, onRetry }) => (
    <motion.div
        variants={fadeUpVariants}
        className="
            flex
            flex-wrap
            items-center
            justify-between
            gap-3
            rounded-2xl
            border
            border-red-200
            bg-red-50
            px-4
            py-3
            text-sm
            font-medium
            text-red-700
            dark:border-red-900/50
            dark:bg-red-950/30
            dark:text-red-400
        "
    >
        <span>{message}</span>

        {onRetry && (
            <button
                type="button"
                onClick={onRetry}
                className="
                    inline-flex
                    items-center
                    gap-1.5
                    rounded-lg
                    bg-red-600
                    px-3
                    py-1.5
                    text-xs
                    font-semibold
                    text-white
                    transition
                    hover:bg-red-700
                "
            >
                <RefreshCw size={13} />
                Retry
            </button>
        )}
    </motion.div>
);

/* ----------------------------------------------------------------------------
   Dashboard
---------------------------------------------------------------------------- */
const Dashboard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useAuth();
    const isDark = useIsDarkTheme();

    const {
        stats = [],
        fleetSummary = {
            available: 0,
            reserved: 0,
            rented: 0,
            maintenance: 0,
            expiredRegistration: 0,
        },
        recentBookings = [],
        recentPayments = [],
        loading = false,
        error = null,
    } = useSelector((state) => state.dashboard);

    const {
        data: statisticsData,
        loading: statisticsLoading,
        error: statisticsError,
        fetchStats,
    } = useStatistics();

    const [period, setPeriod] = useState("30d");
    const [lastUpdated, setLastUpdated] = useState(null);

    /* Bumped by a manual refresh so the leaderboard (which loads its own
       data) reloads along with everything else. */
    const [reloadSignal, setReloadSignal] = useState(0);

    /* Re-render the "updated Xs ago" label without refetching. */
    const [, setClockTick] = useState(0);

    const periodLabel = useMemo(
        () =>
            PERIOD_OPTIONS.find(
                (option) => option.value === period
            )?.label ?? "Last 30 Days",
        [period]
    );

    /* Manual refresh ("r", Refresh buttons): reload everything. */
    const loadAll = useCallback(async () => {
        setReloadSignal((signal) => signal + 1);

        await Promise.all([
            dispatch(getDashboardData()),
            fetchStats(period),
        ]);

        setLastUpdated(new Date());
    }, [dispatch, fetchStats, period]);

    /* The quick stats, fleet and recent tables don't depend on the reporting
       period — load them once, not again on every period change (which used
       to flash all of them back to skeletons). */
    useEffect(() => {
        dispatch(getDashboardData());
    }, [dispatch]);

    useEffect(() => {
        fetchStats(period).then(() => setLastUpdated(new Date()));
    }, [fetchStats, period]);

    /* Keep the relative timestamp fresh. */
    useEffect(() => {
        const id = window.setInterval(
            () => setClockTick((tick) => tick + 1),
            15_000
        );

        return () => window.clearInterval(id);
    }, []);

    /* Press "r" to refresh (ignored while typing). */
    useEffect(() => {
        const handleKey = (event) => {
            const tag = event.target?.tagName;

            if (
                event.key?.toLowerCase() === "r" &&
                !event.metaKey &&
                !event.ctrlKey &&
                tag !== "INPUT" &&
                tag !== "TEXTAREA" &&
                tag !== "SELECT"
            ) {
                loadAll();
            }
        };

        window.addEventListener("keydown", handleKey);

        return () =>
            window.removeEventListener("keydown", handleKey);
    }, [loadAll]);

    const dashboardStats = stats.map((stat) => {
        const numericValue = Number(stat.value);

        const isNumeric = Number.isFinite(numericValue);

        const animatedValue = isNumeric ? (
            <AnimatedCounter
                value={numericValue}
                format={
                    stat.key === "revenue"
                        ? formatCompactCurrency
                        : undefined
                }
            />
        ) : (
            stat.value
        );

        switch (stat.key) {
            case "users":
                return {
                    ...stat,
                    value: animatedValue,
                    icon: (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/25">
                            <Users size={24} />
                        </div>
                    ),
                };

            case "vehicles":
                return {
                    ...stat,
                    value: animatedValue,
                    icon: (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/25">
                            <Car size={25} />
                        </div>
                    ),
                };

            case "bookings":
                return {
                    ...stat,
                    value: animatedValue,
                    icon: (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/25">
                            <CalendarCheck size={25} />
                        </div>
                    ),
                };

            case "revenue":
                return {
                    ...stat,
                    value: animatedValue,
                    icon: (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500 text-white shadow-lg shadow-purple-500/25">
                            <PhilippinePeso size={25} />
                        </div>
                    ),
                };

            default:
                return {
                    ...stat,
                    value: animatedValue,
                    icon: null,
                };
        }
    });

    const hasDashboardData = stats.length > 0;
    const dashboardFirstLoad = !hasDashboardData && !error;
    const statsFirstLoad = !statisticsData && !statisticsError;
    const statsRefreshing = statisticsLoading && Boolean(statisticsData);
    const isRefreshing =
        (loading && hasDashboardData) || statsRefreshing;

    const revenueTrend = statisticsData?.revenueTrend ?? [];
    const bookingStatus = statisticsData?.bookingStatus ?? [];
    const paymentMethods = statisticsData?.paymentMethods ?? [];
    const vehicleStatus = statisticsData?.vehicleStatus ?? [];

    const overview = useMemo(
        () => statisticsData?.overview ?? {},
        [statisticsData]
    );

    const insightItems = useMemo(
        () => [
            {
                key: "customers",
                label: "Customers",
                value: overview.totalCustomers,
                hint: "All time",
                icon: Users,
                tone: "blue",
                to: "/admin/users",
            },
            {
                key: "period-bookings",
                label: "Bookings",
                value: overview.totalBookings,
                hint: periodLabel,
                icon: CalendarCheck,
                tone: "amber",
                to: "/admin/bookings",
            },
            {
                key: "rentals",
                label: "Rentals",
                value: overview.totalRentals,
                hint: periodLabel,
                icon: LayoutGrid,
                tone: "emerald",
                to: "/admin/bookings",
            },
            {
                key: "pending-payments",
                label: "Pending Payments",
                value: overview.pendingPayments,
                hint: "Awaiting review",
                icon: Clock3,
                tone: "rose",
                to: "/admin/payments",
            },
            {
                key: "verified-payments",
                label: "Verified Payments",
                value: overview.verifiedPayments,
                hint: periodLabel,
                icon: CheckCircle2,
                tone: "violet",
                to: "/admin/payments",
            },
            {
                key: "reserved-units",
                label: "Reserved Units",
                value: fleetSummary.reserved,
                hint: "Held for pickup",
                icon: TicketCheck,
                tone: "sky",
                to: "/admin/vehicles",
            },
        ],
        [overview, fleetSummary.reserved, periodLabel]
    );

    const hasInsightData = insightItems.some(
        (item) => Number(item.value) > 0
    );

    /* The trend has a point for every day (zeros included), so "has
       revenue" means some day actually moved money. Vehicle usage is the
       current fleet, not period activity, so it doesn't count here. */
    const hasRevenueData = revenueTrend.some(
        (day) => Number(day.revenue) !== 0
    );

    const hasPeriodData =
        hasRevenueData ||
        bookingStatus.length > 0 ||
        paymentMethods.length > 0;

    const chartTooltipStyle = isDark
        ? {
              borderRadius: 14,
              border: "1px solid #1f2937",
              backgroundColor: "#111827",
              color: "#f3f4f6",
              boxShadow: "0 15px 35px rgba(0,0,0,0.45)",
          }
        : {
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
              color: "#111827",
              boxShadow: "0 15px 35px rgba(15,23,42,0.12)",
          };

    const chartTooltipItemStyle = {
        color: isDark ? "#e5e7eb" : "#374151",
    };

    return (
        <>
            <style>{`
                @keyframes dashboardFloat {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-6px); }
                }

                @keyframes dashboardPulseRing {
                    0% { transform: scale(0.9); opacity: 0.7; }
                    70% { transform: scale(1.6); opacity: 0; }
                    100% { opacity: 0; }
                }

                .dashboard-float {
                    animation: dashboardFloat 5s ease-in-out infinite;
                }

                .dashboard-live-dot::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    border-radius: 9999px;
                    background: currentColor;
                    animation: dashboardPulseRing 1.8s ease-out infinite;
                }
            `}</style>

            {/* =========================================================
                HERO
            ========================================================== */}
            {/* data-own-entrance: this page runs its own entrance, so the
                layout's shared page entrance skips it. */}
            <motion.section
                data-own-entrance
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: EASE_OUT }}
                className="relative overflow-hidden rounded-2xl"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                        backgroundImage: `url(${Welcome})`,
                    }}
                />

                <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/55 to-transparent dark:from-gray-950/90 dark:via-gray-950/70 dark:to-gray-950/20" />

                <motion.div
                    className="dashboard-float pointer-events-none absolute -right-16 top-6 h-52 w-52 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/20"
                    aria-hidden="true"
                />

                <div className="relative mx-auto max-w-[1600px] px-5 py-10 sm:px-8 lg:px-10">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.55,
                                ease: EASE_OUT,
                                delay: 0.05,
                            }}
                            className="max-w-[680px]"
                        >
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                                <Sparkles size={13} />
                                Rent-A-Ride Albay
                            </span>

                            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0b1b41] sm:text-4xl lg:text-[42px] dark:text-white">
                                Welcome back
                                {user?.firstName
                                    ? `, ${user.firstName}`
                                    : ""}
                                !
                            </h1>

                            <p className="mt-2 text-base text-[#38527e] sm:text-lg dark:text-gray-300">
                                Here's what's happening with your car
                                rental business today.
                            </p>

                            <p className="mt-4 text-sm font-medium italic text-[#405b89] dark:text-gray-400">
                                "More Journeys. Brighter Destinations."
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate("/admin/vehicles")
                                    }
                                    className="dashboard-primary-button inline-flex items-center gap-2 rounded-xl bg-[#0b1b41] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:bg-[#13275c] dark:bg-blue-600 dark:hover:bg-blue-500"
                                >
                                    <Car size={16} />
                                    Manage Fleet
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navigate("/admin/bookings")
                                    }
                                    className="inline-flex items-center gap-2 rounded-xl border border-[#0b1b41]/15 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#0b1b41] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                >
                                    <CalendarCheck size={16} />
                                    Review Bookings
                                </button>
                            </div>
                        </motion.div>

                        {/* Control panel */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.55,
                                ease: EASE_OUT,
                                delay: 0.12,
                            }}
                            className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xl shadow-blue-900/10 backdrop-blur-md dark:border-gray-700/70 dark:bg-gray-900/85"
                        >
                            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                                {isRefreshing ? (
                                    <>
                                        <RefreshCw
                                            size={12}
                                            className="animate-spin text-blue-500"
                                        />
                                        Updating…
                                    </>
                                ) : (
                                    <>
                                        <span className="relative inline-flex h-2 w-2 text-emerald-500 dashboard-live-dot">
                                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                        </span>
                                        Updated {formatRelativeTime(lastUpdated)}
                                    </>
                                )}
                            </div>

                            <div className="mt-3 space-y-2">
                                <label
                                    htmlFor="dashboard-period"
                                    className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                                >
                                    Reporting Period
                                </label>

                                <Select
                                    bare
                                    id="dashboard-period"
                                    wrapperClassName=""
                                    value={period}
                                    onChange={(event) => setPeriod(event.target.value)}
                                    options={PERIOD_OPTIONS}
                                    leftIcon={
                                        <CalendarCheck
                                            size={16}
                                            className="text-blue-600 dark:text-blue-400"
                                        />
                                    }
                                    className="w-full gap-2.5 rounded-xl border border-gray-200 bg-white py-2.5 pl-3.5 pr-3 text-sm font-semibold text-gray-800 transition hover:border-blue-300 focus-visible:border-blue-400 focus-visible:ring-4 focus-visible:ring-blue-500/15 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                                />
                            </div>
                        </motion.div>
                    </div>
                </div>
            </motion.section>

            {/* =========================================================
                MAIN CONTENT
            ========================================================== */}
            <motion.main
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="mx-auto max-w-[1600px] space-y-6 px-5 pt-6 sm:px-8 lg:px-10"
            >
                {error && (
                    <ErrorBanner
                        message={
                            typeof error === "string"
                                ? error
                                : "Unable to load dashboard data."
                        }
                        onRetry={() =>
                            dispatch(getDashboardData())
                        }
                    />
                )}

                {statisticsError && (
                    <ErrorBanner
                        message={
                            typeof statisticsError === "string"
                                ? statisticsError
                                : "Unable to load statistics."
                        }
                        onRetry={() => fetchStats(period)}
                    />
                )}

                {/* QUICK STATS */}
                <motion.div variants={fadeUpVariants}>
                    <QuickStats
                        stats={
                            hasDashboardData
                                ? dashboardStats
                                : undefined
                        }
                        loading={dashboardFirstLoad}
                        onCardClick={(stat) => {
                            const target =
                                STAT_ROUTES[stat.key];

                            if (target) {
                                navigate(target);
                            }
                        }}
                    />
                </motion.div>

                {/* INSIGHTS STRIP */}
                {(statsFirstLoad || hasInsightData) && (
                    <motion.div
                        variants={fadeUpVariants}
                        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
                    >
                        {statsFirstLoad
                            ? Array.from({ length: 6 }).map(
                                  (_, index) => (
                                      <div
                                          key={index}
                                          className="h-[92px] animate-pulse rounded-2xl border border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900"
                                      />
                                  )
                              )
                            : insightItems.map((item) => {
                                  const Icon = item.icon;

                                  return (
                                      <motion.button
                                          key={item.key}
                                          type="button"
                                          onClick={() =>
                                              item.to &&
                                              navigate(item.to)
                                          }
                                          variants={fadeUpVariants}
                                          whileHover={{ y: -3 }}
                                          whileTap={{ scale: 0.97 }}
                                          className="group flex flex-col gap-1.5 rounded-2xl border border-gray-200/80 bg-white p-3.5 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-900/60"
                                      >
                                          <span
                                              className={`
                                                  inline-flex
                                                  h-8
                                                  w-8
                                                  items-center
                                                  justify-center
                                                  rounded-lg
                                                  ring-1
                                                  ${
                                                      INSIGHT_TONES[
                                                          item.tone
                                                      ]
                                                  }
                                              `}
                                          >
                                              <Icon size={15} />
                                          </span>

                                          <AnimatedCounter
                                              value={Number(
                                                  item.value || 0
                                              )}
                                              className="text-xl font-bold text-gray-900 dark:text-white"
                                          />

                                          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                                              {item.label}
                                          </span>

                                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                              {item.hint}
                                          </span>
                                      </motion.button>
                                  );
                              })}
                    </motion.div>
                )}

                {/* REVENUE + FLEET */}
                <motion.div
                    variants={fadeUpVariants}
                    className="grid gap-6 xl:grid-cols-[1.55fr_0.8fr]"
                >
                    <motion.div
                        whileHover={{ y: -3 }}
                        transition={{
                            duration: 0.25,
                            ease: EASE_OUT,
                        }}
                        className="min-w-0 max-w-full overflow-hidden rounded-2xl"
                    >
                        <RevenueWidget
                            revenue={
                                statisticsData?.overview
                                    ?.totalRevenue ?? 0
                            }
                            growth={
                                statisticsData?.overview
                                    ?.revenueGrowth ?? 0
                            }
                            period={periodLabel}
                            trendData={revenueTrend}
                            loading={statsFirstLoad}
                        />
                    </motion.div>

                    <motion.div
                        whileHover={{ y: -3 }}
                        transition={{
                            duration: 0.25,
                            ease: EASE_OUT,
                        }}
                        className="min-w-0 max-w-full overflow-hidden rounded-2xl"
                    >
                        <FleetSummary
                            summary={fleetSummary}
                            loading={dashboardFirstLoad}
                        />
                    </motion.div>
                </motion.div>

                {/* ANALYTICS */}
                <motion.section
                    variants={fadeUpVariants}
                    className="space-y-5"
                >
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                                Business Insights
                            </p>

                            <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                                Performance Analytics
                            </h2>
                        </div>

                        <span className="hidden rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 shadow-sm ring-1 ring-gray-200/80 sm:inline-block dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">
                            {periodLabel}
                        </span>
                    </div>

                    <div
                        className={`transition-opacity duration-300 ${
                            statsRefreshing
                                ? "pointer-events-none opacity-60"
                                : ""
                        }`}
                    >
                    <AnimatePresence mode="wait">
                        {statsFirstLoad ? (
                            <motion.div
                                key="analytics-skeleton"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                <SectionCard
                                    interactive={false}
                                    className="p-5"
                                >
                                    <ChartSkeleton height={300} />
                                </SectionCard>

                                <div className="grid gap-6 lg:grid-cols-3">
                                    {[0, 1, 2].map((item) => (
                                        <SectionCard
                                            key={item}
                                            interactive={false}
                                            className="p-5"
                                        >
                                            <ChartSkeleton
                                                height={260}
                                            />
                                        </SectionCard>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="analytics-content"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="space-y-6"
                            >
                                {statisticsData &&
                                    !hasPeriodData && (
                                        <SectionCard
                                            interactive={false}
                                            className="p-10 text-center"
                                        >
                                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                                                <BarChart3 size={28} />
                                            </div>

                                            <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-gray-200">
                                                No bookings or revenue in{" "}
                                                {periodLabel.toLowerCase()}
                                            </p>

                                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                Try a longer reporting period.
                                            </p>

                                            <button
                                                type="button"
                                                onClick={() => loadAll()}
                                                className="dashboard-primary-button mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                                            >
                                                <RefreshCw size={13} />
                                                Refresh data
                                            </button>
                                        </SectionCard>
                                    )}

                                {/* Revenue Trend */}
                                {statisticsData &&
                                    hasRevenueData && (
                                        <SectionCard className="p-5">
                                            <CardHeading
                                                icon={BarChart3}
                                                tone="blue"
                                                title="Revenue Trend"
                                                subtitle="Daily verified revenue for the selected period."
                                            />

                                            <div className="mt-5 h-[300px]">
                                                <ResponsiveContainer
                                                    width="100%"
                                                    height="100%"
                                                >
                                                    <LineChart
                                                        data={
                                                            revenueTrend
                                                        }
                                                        margin={{
                                                            top: 10,
                                                            right: 15,
                                                            left: 5,
                                                            bottom: 5,
                                                        }}
                                                    >
                                                        <defs>
                                                            <linearGradient
                                                                id="adminRevenueLine"
                                                                x1="0"
                                                                y1="0"
                                                                x2="1"
                                                                y2="0"
                                                            >
                                                                <stop
                                                                    offset="0%"
                                                                    stopColor="#2563eb"
                                                                />
                                                                <stop
                                                                    offset="100%"
                                                                    stopColor="#38bdf8"
                                                                />
                                                            </linearGradient>
                                                        </defs>

                                                        <XAxis
                                                            dataKey="date"
                                                            axisLine={
                                                                false
                                                            }
                                                            tickLine={
                                                                false
                                                            }
                                                            tick={{
                                                                fontSize: 11,
                                                                fill: "#64748b",
                                                            }}
                                                            tickFormatter={(
                                                                value
                                                            ) => {
                                                                const date =
                                                                    new Date(
                                                                        value
                                                                    );

                                                                return date.toLocaleDateString(
                                                                    "en-PH",
                                                                    {
                                                                        month: "short",
                                                                        day: "numeric",
                                                                    }
                                                                );
                                                            }}
                                                        />

                                                        <YAxis
                                                            axisLine={
                                                                false
                                                            }
                                                            tickLine={
                                                                false
                                                            }
                                                            tick={{
                                                                fontSize: 11,
                                                                fill: "#64748b",
                                                            }}
                                                            tickFormatter={
                                                                formatAxisCurrency
                                                            }
                                                            width={56}
                                                        />

                                                        <Tooltip
                                                            formatter={(
                                                                value
                                                            ) => [
                                                                formatCurrency(
                                                                    value
                                                                ),
                                                                "Revenue",
                                                            ]}
                                                            labelFormatter={(
                                                                label
                                                            ) =>
                                                                formatDate(
                                                                    label
                                                                )
                                                            }
                                                            contentStyle={
                                                                chartTooltipStyle
                                                            }
                                                            itemStyle={
                                                                chartTooltipItemStyle
                                                            }
                                                        />

                                                        <Line
                                                            type="monotone"
                                                            dataKey="revenue"
                                                            stroke="url(#adminRevenueLine)"
                                                            strokeWidth={
                                                                3
                                                            }
                                                            dot={false}
                                                            activeDot={{
                                                                r: 7,
                                                                stroke: "#3b82f6",
                                                                strokeWidth: 2,
                                                            }}
                                                            isAnimationActive={
                                                                false
                                                            }
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </SectionCard>
                                    )}

                                {/* BOOKING / PAYMENT / VEHICLE */}
                                <div className="grid gap-6 lg:grid-cols-3">
                                    {statisticsData &&
                                        bookingStatus.length >
                                            0 && (
                                            <SectionCard className="p-5">
                                                <CardHeading
                                                    icon={
                                                        CalendarCheck
                                                    }
                                                    tone="blue"
                                                    title="Booking Status"
                                                    subtitle="Distribution by status"
                                                />

                                                <div className="mt-4 h-[260px]">
                                                    <ResponsiveContainer
                                                        width="100%"
                                                        height="100%"
                                                    >
                                                        <PieChart>
                                                            <Pie
                                                                data={
                                                                    bookingStatus
                                                                }
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={
                                                                    58
                                                                }
                                                                outerRadius={
                                                                    88
                                                                }
                                                                paddingAngle={
                                                                    3
                                                                }
                                                                dataKey="value"
                                                                isAnimationActive
                                                                animationDuration={
                                                                    900
                                                                }
                                                            >
                                                                {bookingStatus.map(
                                                                    (
                                                                        _,
                                                                        index
                                                                    ) => (
                                                                        <Cell
                                                                            key={
                                                                                index
                                                                            }
                                                                            fill={
                                                                                CHART_COLORS[
                                                                                    index %
                                                                                        CHART_COLORS.length
                                                                                ]
                                                                            }
                                                                        />
                                                                    )
                                                                )}
                                                            </Pie>

                                                            <Tooltip
                                                                contentStyle={
                                                                    chartTooltipStyle
                                                                }
                                                                itemStyle={
                                                                    chartTooltipItemStyle
                                                                }
                                                            />

                                                            <Legend
                                                                verticalAlign="bottom"
                                                                iconType="circle"
                                                                wrapperStyle={{
                                                                    fontSize:
                                                                        "11px",
                                                                }}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </SectionCard>
                                        )}

                                    {statisticsData &&
                                        paymentMethods.length >
                                            0 && (
                                            <SectionCard className="p-5">
                                                <CardHeading
                                                    icon={
                                                        PhilippinePeso
                                                    }
                                                    tone="violet"
                                                    title="Payment Methods"
                                                    subtitle="Verified payments by method"
                                                />

                                                <div className="mt-4 h-[260px]">
                                                    <ResponsiveContainer
                                                        width="100%"
                                                        height="100%"
                                                    >
                                                        <PieChart>
                                                            <Pie
                                                                data={
                                                                    paymentMethods
                                                                }
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={
                                                                    58
                                                                }
                                                                outerRadius={
                                                                    88
                                                                }
                                                                paddingAngle={
                                                                    3
                                                                }
                                                                dataKey="value"
                                                                isAnimationActive
                                                                animationDuration={
                                                                    900
                                                                }
                                                            >
                                                                {paymentMethods.map(
                                                                    (
                                                                        _,
                                                                        index
                                                                    ) => (
                                                                        <Cell
                                                                            key={
                                                                                index
                                                                            }
                                                                            fill={
                                                                                CHART_COLORS[
                                                                                    index %
                                                                                        CHART_COLORS.length
                                                                                ]
                                                                            }
                                                                        />
                                                                    )
                                                                )}
                                                            </Pie>

                                                            <Tooltip
                                                                formatter={(
                                                                    value,
                                                                    name
                                                                ) => [
                                                                    value,
                                                                    name,
                                                                ]}
                                                                contentStyle={
                                                                    chartTooltipStyle
                                                                }
                                                                itemStyle={
                                                                    chartTooltipItemStyle
                                                                }
                                                            />

                                                            <Legend
                                                                verticalAlign="bottom"
                                                                iconType="circle"
                                                                wrapperStyle={{
                                                                    fontSize:
                                                                        "11px",
                                                                }}
                                                            />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </SectionCard>
                                        )}

                                    {statisticsData &&
                                        vehicleStatus.length >
                                            0 && (
                                            <SectionCard className="p-5">
                                                <CardHeading
                                                    icon={Car}
                                                    tone="emerald"
                                                    title="Vehicle Usage"
                                                    subtitle="Current fleet status"
                                                />

                                                <div className="mt-4 h-[260px]">
                                                    <ResponsiveContainer
                                                        width="100%"
                                                        height="100%"
                                                    >
                                                        <BarChart
                                                            data={
                                                                vehicleStatus
                                                            }
                                                        >
                                                            <XAxis
                                                                dataKey="name"
                                                                axisLine={
                                                                    false
                                                                }
                                                                tickLine={
                                                                    false
                                                                }
                                                                tick={{
                                                                    fontSize: 11,
                                                                    fill: "#64748b",
                                                                }}
                                                            />

                                                            <YAxis
                                                                axisLine={
                                                                    false
                                                                }
                                                                tickLine={
                                                                    false
                                                                }
                                                                tick={{
                                                                    fontSize: 11,
                                                                    fill: "#64748b",
                                                                }}
                                                            />

                                                            <Tooltip
                                                                contentStyle={
                                                                    chartTooltipStyle
                                                                }
                                                                itemStyle={
                                                                    chartTooltipItemStyle
                                                                }
                                                                cursor={{
                                                                    fill: isDark
                                                                        ? "rgba(255,255,255,0.04)"
                                                                        : "#f8fafc",
                                                                }}
                                                            />

                                                            <Bar
                                                                dataKey="value"
                                                                radius={[
                                                                    8,
                                                                    8,
                                                                    0,
                                                                    0,
                                                                ]}
                                                                isAnimationActive
                                                                animationDuration={
                                                                    900
                                                                }
                                                            >
                                                                {vehicleStatus.map(
                                                                    (
                                                                        _,
                                                                        index
                                                                    ) => (
                                                                        <Cell
                                                                            key={
                                                                                index
                                                                            }
                                                                            fill={
                                                                                CHART_COLORS[
                                                                                    index %
                                                                                        CHART_COLORS.length
                                                                                ]
                                                                            }
                                                                        />
                                                                    )
                                                                )}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </SectionCard>
                                        )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    </div>
                </motion.section>

                {/* LOWER DASHBOARD */}
                <div className="space-y-6">
                    <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
                        {/* VEHICLE LEADERBOARD - top performing (period) and
                            most rated (all-time) vehicles. Always holds its
                            column so Recent Payments never sits beside a gap. */}
                        <motion.div
                            variants={fadeUpVariants}
                            className="min-w-0"
                        >
                            <VehicleLeaderboard
                                period={period}
                                periodLabel={periodLabel}
                                reloadSignal={reloadSignal}
                            />
                        </motion.div>

                        {/* RECENT PAYMENTS */}
                        <motion.div
                            variants={fadeUpVariants}
                            whileHover={{ y: -3 }}
                            transition={{
                                duration: 0.25,
                                ease: EASE_OUT,
                            }}
                            className="min-w-0 max-w-full overflow-hidden rounded-2xl"
                        >
                            <RecentPayments
                                transactions={recentPayments}
                                loading={dashboardFirstLoad}
                                onViewAll={() =>
                                    navigate("/admin/payments")
                                }
                            />
                        </motion.div>
                    </div>

                    {/* RECENT BOOKINGS */}
                    <motion.div
                        variants={fadeUpVariants}
                        whileHover={{ y: -3 }}
                        transition={{
                            duration: 0.25,
                            ease: EASE_OUT,
                        }}
                        className="min-w-0 max-w-full overflow-hidden rounded-2xl"
                    >
                        <RecentBookingsCard
                            bookings={recentBookings}
                            loading={dashboardFirstLoad}
                            onViewAll={() =>
                                navigate("/admin/bookings")
                            }
                        />
                    </motion.div>

                    {/* PROMO BANNER */}
                    <motion.section
                        variants={fadeUpVariants}
                        className="relative min-h-[250px] w-full overflow-hidden rounded-2xl bg-cover bg-center shadow-lg"
                        style={{
                            backgroundImage: `url(${MorePossibilities})`,
                        }}
                    >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

                        <div className="relative flex h-full min-h-[250px] flex-col justify-end gap-3 p-6 sm:p-8">
                            <h3 className="max-w-md text-2xl font-extrabold text-white drop-shadow-md">
                                More possibilities across Albay &amp;
                                beyond
                            </h3>

                            <button
                                type="button"
                                onClick={() =>
                                    navigate("/admin/vehicles")
                                }
                                className="inline-flex w-fit items-center gap-2 rounded-xl bg-white/95 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
                            >
                                Explore the Fleet
                                <ArrowRight size={15} />
                            </button>
                        </div>

                        <p
                            className="pointer-events-none absolute right-6 top-3 hidden text-xl text-white/85 drop-shadow-md sm:right-8 sm:block"
                            style={{
                                fontFamily:
                                    "'Brush Script MT', cursive",
                            }}
                        >
                            Albay{" "}
                            <span className="not-italic">
                                &amp;
                            </span>{" "}
                            Beyond
                        </p>
                    </motion.section>
                </div>

            </motion.main>
        </>
    );
};

export default Dashboard;
