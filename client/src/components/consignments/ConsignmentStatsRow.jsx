import { motion } from "framer-motion";
import { Check } from "lucide-react";

import {
    STAGGER_CONTAINER,
    STAGGER_ITEM,
} from "../../constants/motionConstants";

const TONES = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
    green: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300",
    gray: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
    sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300",
};

/* Per-tone accent: the bottom stripe / check badge, and the selected-card
   border + tint. Full class strings so Tailwind can see them. */
const ACCENTS = {
    blue: { bar: "bg-blue-500", active: "border-blue-300 bg-blue-50/70 dark:border-blue-500/50 dark:bg-blue-950/30" },
    amber: { bar: "bg-amber-500", active: "border-amber-300 bg-amber-50/70 dark:border-amber-500/50 dark:bg-amber-950/30" },
    green: { bar: "bg-green-500", active: "border-green-300 bg-green-50/70 dark:border-green-500/50 dark:bg-green-950/30" },
    violet: { bar: "bg-violet-500", active: "border-violet-300 bg-violet-50/70 dark:border-violet-500/50 dark:bg-violet-950/30" },
    slate: { bar: "bg-slate-500", active: "border-slate-300 bg-slate-50/70 dark:border-slate-500/50 dark:bg-slate-800/40" },
    orange: { bar: "bg-orange-500", active: "border-orange-300 bg-orange-50/70 dark:border-orange-500/50 dark:bg-orange-950/30" },
    purple: { bar: "bg-purple-500", active: "border-purple-300 bg-purple-50/70 dark:border-purple-500/50 dark:bg-purple-950/30" },
    gray: { bar: "bg-gray-500", active: "border-gray-300 bg-gray-50/70 dark:border-gray-500/50 dark:bg-gray-800/40" },
    sky: { bar: "bg-sky-500", active: "border-sky-300 bg-sky-50/70 dark:border-sky-500/50 dark:bg-sky-950/30" },
};

/*
 * KPI row for the consignment page. `items` is a list of
 * { label, value, icon, tone, hint?, onClick?, active? }. An item with
 * onClick doubles as a quick filter (mirrors KpiCard on the admin Bookings
 * page) - clicking it drives the same status filter as the pill it
 * replaces, so there's no separate control duplicating its count.
 */
const ConsignmentStatsRow = ({ items = [] }) => {
    return (
        <motion.div
            variants={STAGGER_CONTAINER}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
        >
            {items.map((item) => {
                const Icon = item.icon;
                const Tag = item.onClick ? "button" : "div";
                const tone = TONES[item.tone] || TONES.slate;
                const accent = ACCENTS[item.tone] || ACCENTS.slate;

                return (
                    <motion.div
                        key={item.label}
                        variants={STAGGER_ITEM}
                    >
                        {/* Stacked (icon → number → label) so nine fit in a row
                            without labels overflowing; the card's own colour
                            marks it via the bottom stripe and, when selected,
                            the border + tint. */}
                        <Tag
                            type={item.onClick ? "button" : undefined}
                            onClick={item.onClick}
                            aria-pressed={item.onClick ? Boolean(item.active) : undefined}
                            title={item.label}
                            className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border p-3.5 text-left shadow-sm transition-all duration-200 ${
                                item.onClick
                                    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md"
                                    : ""
                            } ${
                                item.active
                                    ? accent.active
                                    : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
                            }`}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <span
                                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone}`}
                                >
                                    {Icon && <Icon className="h-[18px] w-[18px]" />}
                                </span>

                                {item.active && (
                                    <span
                                        className={`grid h-5 w-5 place-items-center rounded-full text-white ${accent.bar}`}
                                    >
                                        <Check size={12} strokeWidth={3} />
                                    </span>
                                )}
                            </div>

                            <p className="mt-3 text-2xl font-black leading-none tabular-nums tracking-tight text-gray-900 dark:text-white">
                                {item.value}
                            </p>

                            <p className="mt-1.5 line-clamp-2 min-h-[2rem] text-[11px] font-semibold leading-4 text-gray-500 dark:text-gray-400">
                                {item.label}
                            </p>

                            {item.hint && (
                                <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                                    {item.hint}
                                </p>
                            )}

                            <span
                                aria-hidden="true"
                                className={`absolute inset-x-0 bottom-0 h-1 transition-opacity duration-200 ${accent.bar} ${
                                    item.active
                                        ? "opacity-100"
                                        : "opacity-25 group-hover:opacity-100"
                                }`}
                            />
                        </Tag>
                    </motion.div>
                );
            })}
        </motion.div>
    );
};

export default ConsignmentStatsRow;
