import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

import Price from "../common/Price";

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

/*
 * Recharts styles its axes/tooltip through props rather than CSS, so the chart
 * needs to know the active theme to stay legible. Track the `data-theme`
 * attribute the ThemeProvider writes onto <html>.
 */
const useIsDarkTheme = () => {
    const [isDark, setIsDark] = useState(
        () =>
            typeof document !== "undefined" &&
            document.documentElement.dataset.theme === "dark"
    );

    useEffect(() => {
        const root = document.documentElement;

        const sync = () => {
            setIsDark(root.dataset.theme === "dark");
        };

        sync();

        const observer = new MutationObserver(sync);

        observer.observe(root, {
            attributes: true,
            attributeFilter: ["data-theme"],
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
};

const RevenueWidget = ({
    revenue = 0,
    growth = 0,
    period = "This Month",
    trendData = [],
    loading = false,
    className = "",
}) => {
    const isPositive = growth > 0;
    const isNeutral = growth === 0;
    const hasTrend = Array.isArray(trendData) && trendData.length > 0;
    const isDark = useIsDarkTheme();

    const axisColor = isDark ? "#93a5c9" : "#94a3b8";
    const strokeColor = isDark ? "#5aa9ff" : "#2563eb";
    const fillStart = isDark ? "#5aa9ff" : "#3b82f6";
    const tooltipBackground = isDark ? "#0f1e3d" : "#ffffff";
    const tooltipText = isDark ? "#ffffff" : "#111827";
    const tooltipLabel = isDark ? "#93a5c9" : "#6b7280";
    const tooltipBorder = isDark ? "none" : "1px solid #e5e7eb";

    if (loading) {
        return (
            <div
                className={`
                    animate-pulse
                    rounded-2xl
                    border
                    border-gray-200
                    bg-white
                    p-5
                    shadow-sm
                    dark:border-gray-800
                    dark:bg-gray-900
                    ${className}
                `}
            >
                <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-800" />

                <div className="mt-2 h-4 w-56 rounded bg-gray-100 dark:bg-gray-800/70" />

                <div className="mt-8 h-12 w-48 rounded bg-gray-300 dark:bg-gray-700" />

                <div className="mt-6 h-56 rounded bg-gray-100 dark:bg-gray-800/70" />
            </div>
        );
    }

    return (
        <section
            className={`
                relative
                overflow-hidden
                rounded-2xl
                border
                border-gray-200
                bg-white
                p-6
                text-gray-900
                shadow-sm
                dark:border-gray-800
                dark:bg-[linear-gradient(160deg,#0f1e3d_0%,#16234a_55%,#1c2c5c_100%)]
                dark:text-white
                ${className}
            `}
        >
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-white/10 dark:text-white">
                        <TrendingUp size={20} />
                    </div>

                    <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                            Revenue Overview
                        </h2>

                        <p className="text-xs text-gray-500 dark:text-blue-200/70">
                            Total revenue and growth for {period.toLowerCase()}.
                        </p>
                    </div>
                </div>

                <div
                    className={`
                        inline-flex
                        items-center
                        gap-1.5
                        rounded-full
                        px-3
                        py-1
                        text-xs
                        font-semibold
                        ${
                            isPositive
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300"
                                : isNeutral
                                    ? "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-300"
                                    : "bg-red-50 text-red-600 dark:bg-red-400/20 dark:text-red-300"
                        }
                    `}
                >
                    {isPositive ? (
                        <TrendingUp size={13} />
                    ) : isNeutral ? (
                        <Minus size={13} />
                    ) : (
                        <TrendingDown size={13} />
                    )}

                    <span>
                        {isPositive ? "+" : ""}
                        {growth}%
                    </span>
                </div>
            </div>

            <div className="mt-6 flex flex-wrap items-end gap-4">
                <Price
                    value={revenue}
                    className="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl"
                />

                <span className="text-xs text-gray-400 dark:text-blue-200/60">
                    vs previous period
                </span>
            </div>

            <div className="mt-4 h-56 sm:h-64">
                {hasTrend ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={trendData}
                            margin={{ left: -18, right: 6, top: 8 }}
                        >
                            <defs>
                                <linearGradient
                                    id="revenueWidgetFill"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="0%"
                                        stopColor={fillStart}
                                        stopOpacity={0.55}
                                    />
                                    <stop
                                        offset="100%"
                                        stopColor={fillStart}
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>

                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 11, fill: axisColor }}
                                axisLine={false}
                                tickLine={false}
                            />

                            <YAxis
                                tick={{ fontSize: 11, fill: axisColor }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) =>
                                    `₱${(value / 1000).toFixed(0)}K`
                                }
                            />

                            <Tooltip
                                formatter={(value) => [
                                    formatCurrency(value),
                                    "Revenue",
                                ]}
                                contentStyle={{
                                    borderRadius: 10,
                                    border: tooltipBorder,
                                    background: tooltipBackground,
                                    color: tooltipText,
                                    fontSize: 12,
                                }}
                                labelStyle={{ color: tooltipLabel }}
                            />

                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke={strokeColor}
                                strokeWidth={2.5}
                                fill="url(#revenueWidgetFill)"
                                dot={false}
                                activeDot={{ r: 5 }}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div
                        className="
                            flex
                            h-full
                            flex-col
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            border
                            border-dashed
                            border-gray-200
                            bg-gray-50
                            text-center
                            dark:border-white/15
                            dark:bg-white/[0.03]
                        "
                    >
                        <TrendingUp
                            size={22}
                            className="text-gray-300 dark:text-blue-200/40"
                        />

                        <p className="px-6 text-sm text-gray-400 dark:text-blue-200/50">
                            Revenue chart will appear here once trend data is
                            connected.
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-white/5">
                <p
                    className={`
                        flex
                        items-center
                        gap-1.5
                        text-sm
                        font-semibold
                        ${
                            isPositive
                                ? "text-emerald-600 dark:text-emerald-300"
                                : isNeutral
                                    ? "text-gray-500 dark:text-gray-300"
                                    : "text-red-600 dark:text-red-300"
                        }
                    `}
                >
                    {isPositive ? (
                        <TrendingUp size={15} />
                    ) : isNeutral ? (
                        <Minus size={15} />
                    ) : (
                        <TrendingDown size={15} />
                    )}
                    {period}
                </p>

                <p className="mt-1 text-sm text-gray-600 dark:text-blue-100/80">
                    {isPositive
                        ? `Strong performance! Revenue increased by ${growth}% compared to the previous period.`
                        : isNeutral
                            ? "Revenue held steady compared to the previous period."
                            : `Revenue decreased by ${Math.abs(growth)}% compared to the previous period.`}
                </p>
            </div>
        </section>
    );
};

export default RevenueWidget;
