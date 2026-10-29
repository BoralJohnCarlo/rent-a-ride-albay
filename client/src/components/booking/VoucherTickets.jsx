import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Loader2, Ticket, X } from "lucide-react";

const APPLIES_TO = {
    reservation_fee: "off the reservation fee",
    pickup_fee: "off the pickup fee",
    vehicle_price: "off the vehicle rental",
    total: "off your booking total",
};

const formatDiscount = (voucher) => {
    const amount = Number(voucher?.discountValue) || 0;

    return voucher?.discountMethod === "percentage"
        ? { value: `${amount}%`, unit: "OFF" }
        : {
              value: `₱${amount.toLocaleString("en-PH", {
                  maximumFractionDigits: 2,
              })}`,
              unit: "OFF",
          };
};

const formatExpiry = (date) =>
    date
        ? new Date(date).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
          })
        : "";

/*
 * Half-circle cut-outs on the stub/body seam, so the voucher reads as a
 * tear-off ticket. They take the section card's background colour.
 */
const Notches = () => (
    <>
        <span
            aria-hidden="true"
            className="absolute -top-2.5 left-[5.5rem] h-5 w-5 -translate-x-1/2 rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        />
        <span
            aria-hidden="true"
            className="absolute -bottom-2.5 left-[5.5rem] h-5 w-5 -translate-x-1/2 rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
        />
    </>
);

const VoucherTickets = ({
    vouchers = [],
    // The applied voucher (its `voucher` document) and the peso discount.
    appliedVoucher = null,
    discount = 0,
    onApply,
    onRemove,
    formatCurrency,
    disabled = false,
}) => {
    const [applyingCode, setApplyingCode] = useState("");

    const handleApply = async (code) => {
        setApplyingCode(code);

        try {
            await onApply?.(code);
        } finally {
            setApplyingCode("");
        }
    };

    if (appliedVoucher) {
        const voucher = appliedVoucher.voucher || {};
        const { value, unit } = formatDiscount(voucher);

        return (
            <motion.div
                initial={{ scale: 0.97, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative flex overflow-hidden rounded-2xl border border-green-300 bg-gradient-to-r from-green-50 to-white dark:border-green-500/30 dark:from-green-500/10 dark:to-gray-900"
            >
                <Notches />

                <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600 px-2 py-4 text-white">
                    <span className="text-xl font-black leading-none">
                        {value}
                    </span>
                    <span className="mt-1 text-[10px] font-bold tracking-[0.2em]">
                        {unit}
                    </span>
                </div>

                <div className="relative min-w-0 flex-1 border-l-2 border-dashed border-green-300 p-4 dark:border-green-500/30">
                    <span className="absolute right-4 top-3 -rotate-12 rounded border-2 border-green-600 px-1.5 text-[10px] font-black uppercase tracking-widest text-green-700 opacity-80 dark:border-green-400 dark:text-green-300">
                        Applied
                    </span>

                    <p className="pr-16 font-semibold text-gray-900 dark:text-white">
                        {voucher.name || "Voucher"}
                    </p>

                    <p className="mt-1 text-sm font-semibold text-green-700 dark:text-green-400">
                        {discount > 0
                            ? `You save ${formatCurrency(discount)}`
                            : "Applied to this booking"}
                    </p>

                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={disabled}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-red-600 hover:decoration-red-300 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:text-red-400"
                    >
                        <X size={12} />
                        Remove voucher
                    </button>
                </div>
            </motion.div>
        );
    }

    if (vouchers.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <Ticket size={20} className="shrink-0 text-gray-400" />
                No vouchers are available for your account right now.
            </div>
        );
    }

    return (
        <ul className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence initial={false}>
                {vouchers.map((voucher) => {
                    const { value, unit } = formatDiscount(voucher);
                    const isApplying = applyingCode === voucher.code;

                    return (
                        <motion.li
                            key={voucher.code}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group relative flex overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
                        >
                            <Notches />

                            <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center bg-gradient-to-br from-fuchsia-500 to-violet-600 px-2 py-4 text-white">
                                <span className="text-xl font-black leading-none">
                                    {value}
                                </span>
                                <span className="mt-1 text-[10px] font-bold tracking-[0.2em]">
                                    {unit}
                                </span>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col border-l-2 border-dashed border-gray-200 p-3.5 dark:border-gray-700">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                    {voucher.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {APPLIES_TO[voucher.type] || "off your booking"}
                                </p>

                                {voucher.description && (
                                    <p className="mt-1 line-clamp-2 text-[11px] text-gray-500 dark:text-gray-400">
                                        {voucher.description}
                                    </p>
                                )}

                                <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                                    <div className="min-w-0">
                                        <span className="block truncate rounded border border-dashed border-violet-300 bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-violet-700 dark:border-violet-500/40 dark:bg-violet-500/10 dark:text-violet-300">
                                            {voucher.code}
                                        </span>
                                        {voucher.endDate && (
                                            <span className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                                                <CalendarClock size={10} />
                                                Until {formatExpiry(voucher.endDate)}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => handleApply(voucher.code)}
                                        disabled={disabled || Boolean(applyingCode)}
                                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isApplying && (
                                            <Loader2 size={12} className="animate-spin" />
                                        )}
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </motion.li>
                    );
                })}
            </AnimatePresence>
        </ul>
    );
};

export default VoucherTickets;
