import { motion } from "framer-motion";
import {
    Calendar,
    Copy,
    Edit,
    Eye,
    Gift,
    Tag,
    Trash2,
} from "lucide-react";

import CardActionMenu from "./CardActionMenu";

import {
    VOUCHER_TYPE_LABELS,
    VOUCHER_DISCOUNT_METHOD,
    VOUCHER_STATUS,
    VOUCHER_STATUS_LABELS,
} from "../../constants/voucherConstants";

import {
    CARD_LAYOUT_TRANSITION,
} from "../../constants/motionConstants";

const formatDate = (dateString) => {
    if (!dateString) {
        return "—";
    }

    return new Date(dateString).toLocaleDateString(
        "en-PH",
        {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "short",
            day: "numeric",
        }
    );
};

const statusColors = {
    [VOUCHER_STATUS.ACTIVE]:
        "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    [VOUCHER_STATUS.INACTIVE]:
        "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    expired:
        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    scheduled:
        "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

// A voucher's day in Philippine time, the same calendar the server checks.
const toManilaDateKey = (value) =>
    value
        ? new Date(value).toLocaleDateString("en-CA", {
              timeZone: "Asia/Manila",
          })
        : null;

/*
 * What customers actually experience: an "Active" voucher past its end date
 * can't be redeemed, so the card said "Active" for dead vouchers.
 */
const getDisplayStatus = (voucher) => {
    if (voucher.status !== VOUCHER_STATUS.ACTIVE) {
        return {
            key: voucher.status,
            label:
                VOUCHER_STATUS_LABELS[voucher.status] ?? "—",
        };
    }

    const todayKey = toManilaDateKey(new Date());
    const startKey = toManilaDateKey(voucher.startDate);
    const endKey = toManilaDateKey(voucher.endDate);

    if (endKey && todayKey > endKey) {
        return { key: "expired", label: "Expired" };
    }

    if (startKey && todayKey < startKey) {
        return { key: "scheduled", label: "Scheduled" };
    }

    return {
        key: VOUCHER_STATUS.ACTIVE,
        label: VOUCHER_STATUS_LABELS[VOUCHER_STATUS.ACTIVE],
    };
};

const VoucherCard = ({
    voucher,
    onView,
    onEdit,
    onDelete,
    onCopyCode,
    className = "",
}) => {
    const voucherId = voucher._id ?? voucher.id;
    const displayStatus = getDisplayStatus(voucher);
    const usageCount = Number(voucher.usageCount) || 0;
    const isSystemIssued =
        voucher.source === "early_return";

    const actions = [
        {
            label: "View",
            icon: Eye,
            onClick: () => onView?.(voucher),
        },
        /*
         * System-issued vouchers (e.g. an approved early-return credit)
         * shouldn't be hand-edited like marketing promos — their amount
         * and recipient were already decided by the approval that created
         * them.
         */
        ...(isSystemIssued
            ? []
            : [
                  {
                      label: "Edit",
                      icon: Edit,
                      onClick: () => onEdit?.(voucher),
                  },
              ]),
        {
            label: "Delete",
            icon: Trash2,
            variant: "danger",
            onClick: () => onDelete?.(voucher),
        },
    ];

    return (
        <motion.article
            layout
            layoutId={`voucher-${voucherId}`}
            transition={{
                layout: CARD_LAYOUT_TRANSITION,
            }}
            className={[
                "group",
                "overflow-visible",
                "rounded-2xl",
                "border",
                "border-gray-200",
                "bg-white",
                "dark:border-gray-800",
                "dark:bg-gray-900",
                "dark:hover:border-gray-700",
                "shadow-sm",
                "transition-all",
                "duration-300",
                "hover:-translate-y-0.5",
                "hover:border-gray-300",
                "hover:shadow-lg",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                            <Gift
                                size={24}
                                className="text-yellow-600 dark:text-yellow-400"
                            />
                        </div>

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                                    {voucher.name}
                                </h3>
                                <span
                                    className={
                                        `inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[displayStatus.key] ?? "bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`
                                    }
                                >
                                    {displayStatus.label}
                                </span>
                                {isSystemIssued && (
                                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                        Auto-issued · Early
                                        Return
                                    </span>
                                )}
                            </div>

                            <div className="mt-1 flex items-center gap-2">
                                <span className="font-mono text-sm font-medium text-gray-600 dark:text-gray-300">
                                    {voucher.code}
                                </span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        onCopyCode?.(voucher.code);
                                    }}
                                    className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                    title="Copy code"
                                    aria-label={`Copy code ${voucher.code}`}
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div
                        className="shrink-0"
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <CardActionMenu
                            actions={actions}
                        />
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs font-medium text-gray-400">
                            Type
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                            <Tag
                                size={14}
                                className="text-gray-400"
                            />
                            {VOUCHER_TYPE_LABELS[voucher.type] ??
                                "—"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-400">
                            Discount
                        </p>
                        <p className="mt-0.5 text-sm font-semibold text-green-600 dark:text-green-400">
                            {voucher.discountMethod ===
                            VOUCHER_DISCOUNT_METHOD.PERCENTAGE
                                ? `${voucher.discountValue}% off`
                                : `₱${(Number(voucher.discountValue) || 0).toLocaleString("en-PH", {
                                      maximumFractionDigits: 2,
                                  })} off`}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-400">
                            Validity
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                            <Calendar
                                size={14}
                                className="text-gray-400"
                            />
                            {formatDate(voucher.startDate)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            to{" "}
                            {formatDate(voucher.endDate)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-400">
                            Usage
                        </p>
                        <p className="mt-0.5 text-sm text-gray-700 dark:text-gray-300">
                            Used {usageCount}{" "}
                            {usageCount === 1 ? "time" : "times"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Max {voucher.maxUsagesPerUser ?? 1} per
                            customer
                        </p>
                    </div>
                </div>
            </div>
        </motion.article>
    );
};

export default VoucherCard;
