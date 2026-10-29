import {
    AlertTriangle,
    ArrowRight,
    BarChart3,
    CalendarCheck,
    Car,
    ClipboardList,
    FileCheck2,
    ImageOff,
    Sparkles,
    Trophy,
    TrendingDown,
    TrendingUp,
    Wallet,
    Banknote,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import AnimatedCounter from "../../components/dashboard/AnimatedCounter";
import BookingTable from "../../components/tables/BookingTable";
import Select from "../../components/common/Select";

import { getDashboardData } from "../../store/dashboard";
import useStatistics from "../../hooks/statistics/useStatistics";
import { usePayouts } from "../../hooks/payouts/usePayouts";
import useWallet from "../../hooks/wallets/useWallet";
import useAuth from "../../hooks/auth/useAuth";
import getVehicleCardData from "../../utils/getVehicleCardData";

import Welcome from "../../assets/images/AdminDashboard/Welcome.png";

/*
 * A partner's dashboard: only their own vehicles, bookings and money.
 *
 * "Earnings" here are the partner's share - payouts and wallet - never the
 * platform's cash flow. The one gross figure (what customers paid for the
 * partner's vehicles) is labelled as such, since it's before commission.
 * Customer payment records, customer counts and the payment-verification
 * queue are admin concerns and aren't requested for partners at all (the
 * server strips them for the operator role).
 */

const PERIOD_OPTIONS = [
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "month", label: "This Month" },
    { value: "year", label: "This Year" },
];

const PERIOD_LABELS = {
    "7d": "the last 7 days",
    "30d": "the last 30 days",
    month: "this month",
    year: "this year",
};

/* Fleet states in lifecycle order, each with its status colour. */
const FLEET_STATES = [
    { key: "available", label: "Available", bar: "bg-emerald-500" },
    { key: "reserved", label: "Reserved", bar: "bg-amber-500" },
    { key: "pickupInProgress", label: "Pickup in progress", bar: "bg-sky-500" },
    { key: "rented", label: "Rented", bar: "bg-blue-600" },
    { key: "maintenance", label: "Maintenance", bar: "bg-gray-400" },
    { key: "expiredRegistration", label: "Registration expired", bar: "bg-rose-500" },
];

const EASE_OUT = [0.22, 1, 0.36, 1];

const HERO_FLOAT_CSS = `
    @keyframes operatorHeroFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
    }

    .operator-hero-float {
        animation: operatorHeroFloat 5s ease-in-out infinite;
    }
`;

const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: EASE_OUT },
    },
};

const peso = (value, fractionDigits = 0) =>
    `₱${(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    })}`;

const shortDate = (value) => {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
          });
};

const greeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
};

/* ------------------------------------------------------------------------- */

const Card = ({ children, className = "" }) => (
    <motion.section
        variants={fadeUp}
        className={`rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 ${className}`}
    >
        {children}
    </motion.section>
);

const CardHeader = ({ title, subtitle, action }) => (
    <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white">
                {title}
            </h2>
            {subtitle && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {subtitle}
                </p>
            )}
        </div>
        {action}
    </div>
);

const LinkButton = ({ onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10"
    >
        {children}
        <ArrowRight
            size={13}
            className="transition-transform group-hover:translate-x-0.5"
        />
    </button>
);

const Skeleton = ({ className = "" }) => (
    <div
        className={`animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 ${className}`}
    />
);

const KPI_TONES = {
    emerald:
        "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    violet:
        "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
};

const KpiCard = ({ label, value, format, hint, icon: Icon, tone, loading, onClick }) => (
    <motion.button
        type="button"
        variants={fadeUp}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className="group flex w-full flex-col rounded-2xl border border-gray-200/80 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
    >
        <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {label}
            </span>
            <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${KPI_TONES[tone]}`}
            >
                <Icon size={17} />
            </span>
        </div>

        {loading ? (
            <Skeleton className="mt-3 h-8 w-28" />
        ) : (
            <AnimatedCounter
                value={Number(value) || 0}
                format={format}
                className="mt-3 text-2xl font-black tracking-tight text-gray-900 dark:text-white"
            />
        )}

        <span className="mt-1 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="truncate">{hint}</span>
            <ArrowRight
                size={13}
                className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600"
            />
        </span>
    </motion.button>
);

/* Crosshair tooltip for the revenue line - Tailwind-styled so it follows
   the light/dark theme, which recharts' inline contentStyle can't. */
const RevenueTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {new Date(label).toLocaleDateString("en-PH", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                })}
            </p>
            <p className="text-sm font-bold text-gray-900 dark:text-white">
                {peso(payload[0].value, 2)}
            </p>
        </div>
    );
};

/* A labelled horizontal bar list - reads better than a pie for a handful of
   categories, and every value is printed, so colour is never the only cue. */
const BarList = ({ items, total, emptyText }) => {
    if (!items.length || total === 0) {
        return (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {emptyText}
            </p>
        );
    }

    return (
        <ul className="space-y-3.5">
            {items.map((item, index) => {
                const pct = total > 0 ? (item.value / total) * 100 : 0;

                return (
                    <li key={item.key ?? item.label}>
                        <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                                {item.label}
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">
                                {item.value}
                                <span className="ml-1.5 text-xs font-normal text-gray-400 dark:text-gray-500">
                                    {Math.round(pct)}%
                                </span>
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <motion.div
                                className={`h-full rounded-full ${item.bar ?? "bg-blue-600 dark:bg-blue-500"}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{
                                    delay: 0.1 + index * 0.05,
                                    duration: 0.8,
                                    ease: EASE_OUT,
                                }}
                            />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
};

/* ------------------------------------------------------------------------- */

const Dashboard = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useAuth();

    const {
        stats = [],
        fleetSummary = {},
        recentBookings = [],
        loading = false,
        error = null,
    } = useSelector((state) => state.dashboard);

    const {
        data: statisticsData,
        loading: statisticsLoading,
        error: statisticsError,
        fetchStats,
    } = useStatistics();

    const { summary: payoutSummary, loadOperatorPayoutSummary } =
        usePayouts();

    const { wallet, fetchMyWallet } = useWallet();

    const [period, setPeriod] = useState("30d");
    const [earningsLoaded, setEarningsLoaded] = useState(false);

    useEffect(() => {
        dispatch(getDashboardData());

        Promise.allSettled([
            loadOperatorPayoutSummary(),
            fetchMyWallet({}),
        ]).finally(() => setEarningsLoaded(true));
    }, [dispatch, loadOperatorPayoutSummary, fetchMyWallet]);

    useEffect(() => {
        fetchStats(period);
    }, [fetchStats, period]);

    const statValue = useCallback(
        (key) => Number(stats.find((stat) => stat.key === key)?.value) || 0,
        [stats]
    );

    const overview = statisticsData?.overview ?? {};
    const revenueTrend = useMemo(
        () => statisticsData?.revenueTrend ?? [],
        [statisticsData]
    );
    const topVehicles = statisticsData?.topVehicles ?? [];
    const growth = Number(overview.revenueGrowth) || 0;

    const bookingStatusItems = useMemo(
        () =>
            [...(statisticsData?.bookingStatus ?? [])]
                .sort((a, b) => b.value - a.value)
                .map((item) => ({ label: item.name, value: item.value })),
        [statisticsData]
    );

    const bookingStatusTotal = bookingStatusItems.reduce(
        (sum, item) => sum + item.value,
        0
    );

    const fleetItems = FLEET_STATES.map((state) => ({
        ...state,
        value: Number(fleetSummary[state.key]) || 0,
    })).filter((item) => item.value > 0);

    const fleetTotal = fleetItems.reduce((sum, item) => sum + item.value, 0);

    const expiredRegistrations = Number(fleetSummary.expiredRegistration) || 0;

    const maxTopBookings = Math.max(
        1,
        ...topVehicles.map((item) => Number(item.bookings) || 0)
    );

    const statsLoading = statisticsLoading && !statisticsData;
    const periodLabel = PERIOD_LABELS[period];
    const firstName = user?.firstName?.trim();

    const kpis = [
        {
            key: "wallet",
            label: "Wallet balance",
            value: wallet?.balance ?? 0,
            format: (v) => peso(v),
            hint: "Available to withdraw",
            icon: Wallet,
            tone: "emerald",
            loading: !earningsLoaded,
            to: "/operator/earnings",
        },
        {
            key: "earned",
            label: "Total earned",
            value: payoutSummary?.totalEarned ?? 0,
            format: (v) => peso(v),
            hint:
                Number(payoutSummary?.totalScheduled) > 0
                    ? `${peso(payoutSummary.totalScheduled)} scheduled for release`
                    : "Your share, after commission",
            icon: Banknote,
            tone: "violet",
            loading: !earningsLoaded,
            to: "/operator/earnings",
        },
        {
            key: "bookings",
            label: "Active bookings",
            value: statValue("bookings"),
            hint: "Pending, approved or on the road",
            icon: CalendarCheck,
            tone: "amber",
            loading: loading && stats.length === 0,
            to: "/operator/bookings",
        },
        {
            key: "vehicles",
            label: "My vehicles",
            value: statValue("vehicles"),
            hint: `${Number(fleetSummary.available) || 0} available now`,
            icon: Car,
            tone: "blue",
            loading: loading && stats.length === 0,
            to: "/operator/vehicles",
        },
    ];

    const errorMessage =
        (error &&
            (typeof error === "string"
                ? error
                : "Unable to load your dashboard.")) ||
        (statisticsError &&
            (typeof statisticsError === "string"
                ? statisticsError
                : "Unable to load your statistics."));

    return (
        // data-own-entrance: this page staggers its own sections, so the
        // layout's shared page entrance skips it.
        <motion.div
            data-own-entrance
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            initial="hidden"
            animate="show"
            className="mx-auto w-full max-w-[1600px] space-y-6"
        >
            <style>{HERO_FLOAT_CSS}</style>

            {/* HERO - same look as the admin dashboard's welcome banner. */}
            <motion.section
                variants={fadeUp}
                className="relative overflow-hidden rounded-2xl"
            >
                <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${Welcome})` }}
                />

                <div className="absolute inset-0 bg-linear-to-r from-white/85 via-white/55 to-transparent dark:from-gray-950/90 dark:via-gray-950/70 dark:to-gray-950/20" />

                <div
                    aria-hidden="true"
                    className="operator-hero-float pointer-events-none absolute -right-16 top-6 h-52 w-52 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/20"
                />

                <div className="relative px-5 py-10 sm:px-8 lg:px-10">
                    <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-170">
                            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                                <Sparkles size={13} />
                                Rent-A-Ride Albay Partner
                            </span>

                            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0b1b41] sm:text-4xl lg:text-[42px] dark:text-white">
                                {greeting()}
                                {firstName ? `, ${firstName}` : ""}!
                            </h1>

                            <p className="mt-2 text-base text-[#38527e] sm:text-lg dark:text-gray-300">
                                Here's how your vehicles are doing.
                            </p>

                            <p className="mt-4 text-sm font-medium italic text-[#405b89] dark:text-gray-400">
                                "More Journeys. Brighter Destinations."
                            </p>

                            <div className="mt-6 flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate("/operator/vehicles")}
                                    className="dashboard-primary-button inline-flex items-center gap-2 rounded-xl bg-[#0b1b41] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/20 transition hover:-translate-y-0.5 hover:bg-[#13275c] dark:bg-blue-600 dark:hover:bg-blue-500"
                                >
                                    <Car size={16} />
                                    My Vehicles
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/operator/bookings")}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[#0b1b41]/15 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#0b1b41] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                >
                                    <ClipboardList size={16} />
                                    Bookings
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navigate("/operator/consignments")}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[#0b1b41]/15 bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#0b1b41] backdrop-blur transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                                >
                                    <FileCheck2 size={16} />
                                    Consignments
                                </button>
                            </div>
                        </div>

                        {/* Control panel */}
                        <div className="w-full max-w-sm rounded-2xl border border-white/70 bg-white/85 p-4 shadow-xl shadow-blue-900/10 backdrop-blur-md dark:border-gray-700/70 dark:bg-gray-900/85">
                            <label
                                htmlFor="operator-dashboard-period"
                                className="text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500"
                            >
                                Reporting Period
                            </label>

                            <Select
                                bare
                                id="operator-dashboard-period"
                                wrapperClassName="mt-2"
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
                    </div>
                </div>
            </motion.section>

            {errorMessage && (
                <motion.div
                    variants={fadeUp}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                >
                    {errorMessage}
                </motion.div>
            )}

            {expiredRegistrations > 0 && (
                <motion.button
                    type="button"
                    variants={fadeUp}
                    onClick={() => navigate("/operator/vehicles")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-800 transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                >
                    <AlertTriangle size={18} className="shrink-0" />
                    <span className="flex-1">
                        <strong className="font-semibold">
                            {expiredRegistrations}{" "}
                            {expiredRegistrations === 1
                                ? "vehicle has"
                                : "vehicles have"}{" "}
                            an expired registration
                        </strong>{" "}
                        and can't be booked until it's renewed.
                    </span>
                    <ArrowRight size={15} className="shrink-0" />
                </motion.button>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {kpis.map(({ key, to, ...kpi }) => (
                    <KpiCard
                        key={key}
                        {...kpi}
                        onClick={() => navigate(to)}
                    />
                ))}
            </div>

            {/* REVENUE + FLEET */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
                <Card className="p-5 sm:p-6">
                    <CardHeader
                        title="Booking revenue"
                        subtitle={`What customers paid for your vehicles over ${periodLabel}, before the platform's commission.`}
                    />

                    {statsLoading ? (
                        <>
                            <Skeleton className="mt-5 h-9 w-40" />
                            <Skeleton className="mt-5 h-65 w-full" />
                        </>
                    ) : (
                        <>
                            <div className="mt-4 flex flex-wrap items-end gap-3">
                                <AnimatedCounter
                                    value={Number(overview.totalRevenue) || 0}
                                    format={(v) => peso(v)}
                                    className="text-3xl font-black tracking-tight text-gray-900 dark:text-white"
                                />
                                <span
                                    className={`mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        growth >= 0
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                            : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400"
                                    }`}
                                >
                                    {growth >= 0 ? (
                                        <TrendingUp size={13} />
                                    ) : (
                                        <TrendingDown size={13} />
                                    )}
                                    {growth >= 0 ? "+" : ""}
                                    {growth}% vs previous period
                                </span>
                            </div>

                            <div className="mt-5 h-65 text-gray-400 dark:text-gray-500">
                                {revenueTrend.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart
                                            data={revenueTrend}
                                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid
                                                vertical={false}
                                                stroke="currentColor"
                                                strokeOpacity={0.25}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                minTickGap={24}
                                                tick={{ fontSize: 11, fill: "currentColor" }}
                                                tickFormatter={shortDate}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                width={52}
                                                tick={{ fontSize: 11, fill: "currentColor" }}
                                                tickFormatter={(value) =>
                                                    Math.abs(value) >= 1000
                                                        ? `₱${Math.round(value / 1000)}k`
                                                        : `₱${value}`
                                                }
                                            />
                                            <Tooltip
                                                content={<RevenueTooltip />}
                                                cursor={{
                                                    stroke: "currentColor",
                                                    strokeDasharray: "4 4",
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="revenue"
                                                stroke="#2563eb"
                                                strokeWidth={2}
                                                dot={false}
                                                activeDot={{
                                                    r: 5,
                                                    fill: "#2563eb",
                                                    stroke: "#fff",
                                                    strokeWidth: 2,
                                                }}
                                                isAnimationActive={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                                        <BarChart3 size={28} />
                                        <p className="text-sm">
                                            No booking revenue in {periodLabel} yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </Card>

                <Card className="p-5 sm:p-6">
                    <CardHeader
                        title="Fleet status"
                        subtitle="Where your vehicles are right now."
                        action={
                            <LinkButton onClick={() => navigate("/operator/vehicles")}>
                                View
                            </LinkButton>
                        }
                    />

                    <div className="mt-5">
                        {loading && fleetTotal === 0 ? (
                            <div className="space-y-4">
                                {[0, 1, 2, 3].map((item) => (
                                    <Skeleton key={item} className="h-8 w-full" />
                                ))}
                            </div>
                        ) : (
                            <BarList
                                items={fleetItems}
                                total={fleetTotal}
                                emptyText="No vehicles yet - approved consignments show up here."
                            />
                        )}
                    </div>
                </Card>
            </div>

            {/* TOP VEHICLES + BOOKING STATUS */}
            <div className="grid gap-6 xl:grid-cols-2">
                <Card className="overflow-hidden">
                    <div className="p-5 pb-3 sm:p-6 sm:pb-3">
                        <CardHeader
                            title="Top vehicles"
                            subtitle={`Your most-booked vehicles over ${periodLabel}.`}
                            action={
                                <LinkButton onClick={() => navigate("/operator/vehicles")}>
                                    All vehicles
                                </LinkButton>
                            }
                        />
                    </div>

                    {statsLoading ? (
                        <div className="space-y-3 px-5 pb-5 sm:px-6">
                            {[0, 1, 2].map((item) => (
                                <Skeleton key={item} className="h-14 w-full" />
                            ))}
                        </div>
                    ) : topVehicles.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-6 pb-8 pt-4 text-center text-gray-400 dark:text-gray-500">
                            <Trophy size={28} />
                            <p className="text-sm">
                                No bookings for your vehicles in {periodLabel}.
                            </p>
                        </div>
                    ) : (
                        <ul className="px-2 pb-3 sm:px-3">
                            {topVehicles.map((item, index) => {
                                const image = getVehicleCardData(item.vehicle ?? {}).image;
                                const bookings = Number(item.bookings) || 0;

                                return (
                                    <li key={item._id}>
                                        <button
                                            type="button"
                                            onClick={() => navigate("/operator/vehicles")}
                                            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                                        >
                                            <span
                                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                                    index === 0
                                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                                                }`}
                                            >
                                                {index + 1}
                                            </span>

                                            <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                                                {image ? (
                                                    <img
                                                        src={image}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <ImageOff size={18} className="text-gray-400" />
                                                )}
                                            </span>

                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                    {[item.vehicle?.brand, item.vehicle?.model]
                                                        .filter(Boolean)
                                                        .join(" ") || "Vehicle"}
                                                </span>
                                                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                                    <motion.span
                                                        className="block h-full rounded-full bg-blue-600 dark:bg-blue-500"
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: `${(bookings / maxTopBookings) * 100}%`,
                                                        }}
                                                        transition={{
                                                            delay: 0.1 + index * 0.05,
                                                            duration: 0.8,
                                                            ease: EASE_OUT,
                                                        }}
                                                    />
                                                </span>
                                            </span>

                                            <span className="shrink-0 text-right">
                                                <span className="block text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                                    {bookings}
                                                </span>
                                                <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                                                    {bookings === 1 ? "booking" : "bookings"}
                                                </span>
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>

                <Card className="p-5 sm:p-6">
                    <CardHeader
                        title="Booking outcomes"
                        subtitle={`Bookings made for your vehicles over ${periodLabel}, by status.`}
                    />

                    <div className="mt-5">
                        {statsLoading ? (
                            <div className="space-y-4">
                                {[0, 1, 2, 3].map((item) => (
                                    <Skeleton key={item} className="h-8 w-full" />
                                ))}
                            </div>
                        ) : (
                            <BarList
                                items={bookingStatusItems}
                                total={bookingStatusTotal}
                                emptyText={`No bookings in ${periodLabel}.`}
                            />
                        )}
                    </div>
                </Card>
            </div>

            {/* RECENT BOOKINGS */}
            <Card className="overflow-hidden">
                <div className="p-5 pb-4 sm:p-6 sm:pb-4">
                    <CardHeader
                        title="Recent bookings"
                        subtitle="The latest bookings for your vehicles."
                        action={
                            <LinkButton onClick={() => navigate("/operator/bookings")}>
                                View all
                            </LinkButton>
                        }
                    />
                </div>

                {!loading && recentBookings.length === 0 ? (
                    <p className="px-6 pb-8 pt-2 text-center text-sm text-gray-500 dark:text-gray-400">
                        No bookings for your vehicles yet.
                    </p>
                ) : (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                        <BookingTable
                            bookings={recentBookings}
                            loading={loading}
                            viewOnly
                            onView={() => navigate("/operator/bookings")}
                        />
                    </div>
                )}
            </Card>
        </motion.div>
    );
};

export default Dashboard;
