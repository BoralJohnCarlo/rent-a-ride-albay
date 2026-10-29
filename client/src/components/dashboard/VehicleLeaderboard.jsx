import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    AnimatePresence,
    motion,
} from "framer-motion";

import {
    ArrowRight,
    Car,
    ImageOff,
    Medal,
    RefreshCw,
    Star,
    TrendingUp,
    Trophy,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { getVehicleLeaderboard } from "../../api/statisticsApi";

/*
 * Admin dashboard leaderboard. "Top Performing" follows the dashboard's
 * reporting period (bookings that became trips); "Most Rated" is all-time
 * customer reviews. Data comes from GET /statistics/vehicle-leaderboard.
 */

const EASE_OUT = [0.22, 1, 0.36, 1];

const TABS = [
    {
        key: "performance",
        label: "Top Performing",
        icon: TrendingUp,
        sorts: [
            {
                key: "topByBookingValue",
                label: "Booking value",
            },
            {
                key: "topByBookings",
                label: "Bookings",
            },
        ],
    },
    {
        key: "ratings",
        label: "Most Rated",
        icon: Star,
        sorts: [
            {
                key: "highestRated",
                label: "Highest rated",
            },
            {
                key: "mostReviewed",
                label: "Most reviews",
            },
        ],
    },
];

const RANK_STYLES = [
    "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-amber-500/30",
    "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800 shadow-slate-400/30",
    "bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950 shadow-orange-500/30",
];

const BAR_STYLES = {
    performance: "from-emerald-500 to-emerald-400",
    ratings: "from-amber-400 to-yellow-300",
};

// Statuses worth flagging on a leaderboard row; the rest read as normal.
const FLAGGED_STATUSES = {
    Maintenance: {
        label: "Maintenance",
        className:
            "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    },
    RegistrationExpired: {
        label: "Reg. expired",
        className:
            "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    },
    Archived: {
        label: "Archived",
        className:
            "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    },
};

const formatPeso = (value) =>
    `₱${(Number(value) || 0).toLocaleString("en-PH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    })}`;

const plural = (count, word) =>
    `${count} ${count === 1 ? word : `${word}s`}`;

const getVehicleName = (vehicle) =>
    [vehicle?.brand, vehicle?.model].filter(Boolean).join(" ") ||
    "Vehicle";

/* What each sort shows as the headline number, the line under it, and how
   full its bar is (0–1) relative to the leader. */
const describeRow = (sortKey, row, leader) => {
    switch (sortKey) {
        case "topByBookings":
            return {
                value: row.bookings,
                unit: row.bookings === 1 ? "booking" : "bookings",
                detail: `${formatPeso(row.bookingValue)} booked · ${row.completedTrips} completed`,
                fill: leader?.bookings
                    ? row.bookings / leader.bookings
                    : 0,
            };

        case "highestRated":
            return {
                value: row.averageRating.toFixed(1),
                unit: "/ 5",
                star: true,
                detail: `${plural(row.reviewCount, "review")} · ${row.fiveStarCount} five-star`,
                fill: row.averageRating / 5,
            };

        case "mostReviewed":
            return {
                value: row.reviewCount,
                unit: row.reviewCount === 1 ? "review" : "reviews",
                detail: `${row.averageRating.toFixed(1)} average · ${row.fiveStarCount} five-star`,
                fill: leader?.reviewCount
                    ? row.reviewCount / leader.reviewCount
                    : 0,
            };

        case "topByBookingValue":
        default:
            return {
                value: formatPeso(row.bookingValue),
                unit: "",
                detail: `${plural(row.bookings, "booking")} · ${row.completedTrips} completed`,
                fill: leader?.bookingValue
                    ? row.bookingValue / leader.bookingValue
                    : 0,
            };
    }
};

const RankBadge = ({ rank }) =>
    rank <= 3 ? (
        <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-md ${RANK_STYLES[rank - 1]}`}
            aria-label={`Rank ${rank}`}
        >
            {rank === 1 ? (
                <Trophy size={15} strokeWidth={2.4} />
            ) : (
                <Medal size={15} strokeWidth={2.4} />
            )}
        </div>
    ) : (
        <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            aria-label={`Rank ${rank}`}
        >
            {rank}
        </div>
    );

const Thumbnail = ({ vehicle }) => (
    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50 ring-1 ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700/60">
        {vehicle?.image ? (
            <img
                src={vehicle.image}
                alt={getVehicleName(vehicle)}
                loading="lazy"
                className="h-full w-full object-cover"
            />
        ) : (
            <ImageOff
                size={20}
                className="text-gray-300 dark:text-gray-600"
            />
        )}
    </div>
);

const SkeletonRows = () => (
    <div className="space-y-3 py-4">
        {[0, 1, 2, 3, 4].map((row) => (
            <div
                key={row}
                className="h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/70"
            />
        ))}
    </div>
);

const VehicleLeaderboard = ({
    period = "30d",
    periodLabel = "Last 30 Days",
    reloadSignal = 0,
}) => {
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [tabKey, setTabKey] = useState("performance");
    const [sortBy, setSortBy] = useState({
        performance: "topByBookingValue",
        ratings: "highestRated",
    });

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await getVehicleLeaderboard({
                period,
                limit: 5,
            });

            setData(response?.data ?? null);
        } catch (requestError) {
            setError(
                requestError?.response?.data?.message ||
                    "Unable to load the vehicle leaderboard."
            );
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        load();
    }, [load, reloadSignal]);

    const tab = TABS.find((item) => item.key === tabKey) ?? TABS[0];
    const sortKey = sortBy[tab.key];

    const rows = useMemo(
        () => data?.[sortKey] ?? [],
        [data, sortKey]
    );

    const leader = rows[0];
    const firstLoad = loading && !data;
    const refreshing = loading && Boolean(data);

    const openVehicle = (vehicle) => {
        const params = new URLSearchParams();

        if (vehicle?.plateNumber) {
            params.set("search", vehicle.plateNumber);
        }

        if (vehicle?.status === "Archived") {
            params.set("tab", "archived");
        }

        const query = params.toString();

        navigate(`/admin/vehicles${query ? `?${query}` : ""}`);
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 pt-4 pb-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/40">
                        <Trophy size={19} />
                    </div>

                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">
                            Vehicle Leaderboard
                        </h3>

                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {tab.key === "performance"
                                ? `Bookings that became trips · ${periodLabel}`
                                : "Customer reviews · All time"}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {refreshing && (
                        <RefreshCw
                            size={14}
                            className="animate-spin text-blue-500"
                            aria-label="Updating"
                        />
                    )}

                    <button
                        type="button"
                        onClick={() => navigate("/admin/vehicles")}
                        className="group inline-flex items-center gap-1.5 rounded-xl bg-gray-50 px-3.5 py-2 text-xs font-semibold text-gray-700 transition hover:bg-blue-600 hover:text-white dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-blue-600"
                    >
                        View Fleet
                        <ArrowRight
                            size={14}
                            className="transition-transform group-hover:translate-x-0.5"
                        />
                    </button>
                </div>

                {/* Tabs */}
                <div
                    role="tablist"
                    aria-label="Leaderboard"
                    className="flex w-full gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/80"
                >
                    {TABS.map((item) => {
                        const Icon = item.icon;
                        const active = item.key === tab.key;

                        return (
                            <button
                                key={item.key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setTabKey(item.key)}
                                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                    active
                                        ? "text-gray-900 dark:text-white"
                                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                }`}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="leaderboard-tab"
                                        className="absolute inset-0 rounded-lg bg-white shadow-sm dark:bg-gray-700"
                                        transition={{
                                            duration: 0.3,
                                            ease: EASE_OUT,
                                        }}
                                    />
                                )}

                                <span className="relative inline-flex items-center gap-1.5">
                                    <Icon size={14} />
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Sort */}
                <div className="flex w-full flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Rank by
                    </span>

                    {tab.sorts.map((sort) => {
                        const active = sort.key === sortKey;

                        return (
                            <button
                                key={sort.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() =>
                                    setSortBy((current) => ({
                                        ...current,
                                        [tab.key]: sort.key,
                                    }))
                                }
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                    active
                                        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                                        : "bg-gray-50 text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
                                }`}
                            >
                                {sort.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Body */}
            <div
                className={`px-5 transition-opacity duration-300 ${
                    refreshing ? "opacity-60" : ""
                }`}
            >
                {error && data && (
                    <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        Couldn't refresh. Showing the last loaded results.
                        <button
                            type="button"
                            onClick={load}
                            className="font-semibold underline underline-offset-2"
                        >
                            Retry
                        </button>
                    </p>
                )}

                {firstLoad ? (
                    <SkeletonRows />
                ) : error && !data ? (
                    <div className="flex flex-col items-center py-10 text-center">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={load}
                            className="dashboard-primary-button mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                        >
                            <RefreshCw size={13} />
                            Retry
                        </button>
                    </div>
                ) : rows.length === 0 ? (
                    <div className="my-5 flex flex-col items-center rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center dark:border-gray-800">
                        {tab.key === "performance" ? (
                            <Car
                                size={28}
                                className="text-gray-300 dark:text-gray-600"
                            />
                        ) : (
                            <Star
                                size={28}
                                className="text-gray-300 dark:text-gray-600"
                            />
                        )}

                        <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                            {tab.key === "performance"
                                ? `No bookings in ${periodLabel.toLowerCase()} yet.`
                                : "No vehicle reviews yet."}
                        </p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.ol
                            key={`${tab.key}-${sortKey}-${period}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                        >
                            {rows.map((row, index) => {
                                const rank = index + 1;
                                const vehicle = row.vehicle;
                                const info = describeRow(
                                    sortKey,
                                    row,
                                    leader
                                );
                                const fillPct = Math.max(
                                    4,
                                    Math.min(100, info.fill * 100)
                                );

                                return (
                                    <motion.li
                                        key={vehicle?._id ?? index}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay: index * 0.05,
                                            duration: 0.35,
                                            ease: EASE_OUT,
                                        }}
                                        className="border-b border-gray-100 last:border-b-0 dark:border-gray-800"
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                openVehicle(vehicle)
                                            }
                                            className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                                        >
                                            <RankBadge rank={rank} />

                                            <Thumbnail vehicle={vehicle} />

                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">
                                                    {getVehicleName(
                                                        vehicle
                                                    )}
                                                </p>

                                                <div className="flex min-w-0 items-center gap-1.5">
                                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                                        {[
                                                            vehicle?.plateNumber,
                                                            vehicle?.vehicleCode,
                                                        ]
                                                            .filter(Boolean)
                                                            .join(" · ") ||
                                                            "—"}
                                                    </p>

                                                    {FLAGGED_STATUSES[
                                                        vehicle?.status
                                                    ] && (
                                                        <span
                                                            className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${
                                                                FLAGGED_STATUSES[
                                                                    vehicle
                                                                        .status
                                                                ].className
                                                            }`}
                                                        >
                                                            {
                                                                FLAGGED_STATUSES[
                                                                    vehicle
                                                                        .status
                                                                ].label
                                                            }
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                                    <motion.div
                                                        className={`h-full rounded-full bg-gradient-to-r ${BAR_STYLES[tab.key]}`}
                                                        initial={{
                                                            width: 0,
                                                        }}
                                                        animate={{
                                                            width: `${fillPct}%`,
                                                        }}
                                                        transition={{
                                                            delay:
                                                                0.15 +
                                                                index *
                                                                    0.05,
                                                            duration: 0.8,
                                                            ease: EASE_OUT,
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            <div className="shrink-0 text-right">
                                                <p className="inline-flex items-baseline gap-1 text-sm font-extrabold text-gray-900 dark:text-white">
                                                    {info.star && (
                                                        <Star
                                                            size={13}
                                                            className="self-center fill-amber-400 text-amber-400"
                                                        />
                                                    )}
                                                    {info.value}
                                                    {info.unit && (
                                                        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
                                                            {info.unit}
                                                        </span>
                                                    )}
                                                </p>

                                                <p className="mt-0.5 max-w-[11rem] truncate text-[11px] text-gray-500 dark:text-gray-400">
                                                    {info.detail}
                                                </p>

                                                {tab.key ===
                                                    "performance" &&
                                                    row.reviewCount >
                                                        0 && (
                                                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                                            <Star
                                                                size={11}
                                                                className="fill-amber-400 text-amber-400"
                                                            />
                                                            {row.averageRating.toFixed(
                                                                1
                                                            )}
                                                            <span className="font-normal text-gray-400 dark:text-gray-500">
                                                                (
                                                                {
                                                                    row.reviewCount
                                                                }
                                                                )
                                                            </span>
                                                        </p>
                                                    )}
                                            </div>
                                        </button>
                                    </motion.li>
                                );
                            })}
                        </motion.ol>
                    </AnimatePresence>
                )}
            </div>
        </section>
    );
};

export default VehicleLeaderboard;
