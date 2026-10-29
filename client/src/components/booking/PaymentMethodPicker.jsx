import { AnimatePresence, motion } from "framer-motion";
import { Check, CircleCheck, Info } from "lucide-react";

/*
 * Booking payment step: wallet-style method cards, a "how much now"
 * segmented toggle (GCash only), and a bar splitting the total into what's
 * paid now vs. at pickup.
 */
const PaymentMethodPicker = ({
    options = [],
    value,
    onChange,
    payInFull = false,
    onPayInFullChange,
    // Reservation (+ any upfront) fees due to confirm the booking.
    upfrontTotal = 0,
    reservationFee = 0,
    finalTotal = 0,
    amountDueNow = 0,
    formatCurrency,
    disabled = false,
    error,
}) => {
    if (upfrontTotal <= 0) {
        return (
            <div className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-green-300 bg-green-50/60 p-5 dark:border-green-500/30 dark:bg-green-500/5">
                <CircleCheck
                    size={22}
                    className="mt-0.5 shrink-0 text-green-600 dark:text-green-400"
                />
                <div>
                    <p className="font-semibold text-green-800 dark:text-green-300">
                        No reservation fee required
                    </p>
                    <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                        This vehicle does not require a reservation fee. You
                        will only pay the rental fee when you pick up the
                        vehicle.
                    </p>
                </div>
            </div>
        );
    }

    const isGcash = value === "GCASH";
    const dueAtPickup = Math.max(0, finalTotal - amountDueNow);
    const nowShare =
        finalTotal > 0
            ? Math.min(100, Math.max(4, (amountDueNow / finalTotal) * 100))
            : 100;
    const selectedOption = options.find((option) => option.value === value);

    return (
        <div className="space-y-5">
            <div
                role="radiogroup"
                aria-label="Payment method"
                className="grid gap-3"
            >
                {options.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={disabled}
                            onClick={() => onChange?.(option.value)}
                            className={`
                                group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all duration-300
                                focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400/30
                                disabled:cursor-not-allowed disabled:opacity-60
                                ${
                                    isSelected
                                        ? "border-transparent bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 text-white shadow-xl shadow-blue-600/25"
                                        : "border-gray-200 bg-white text-gray-900 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-blue-600"
                                }
                            `}
                        >
                            {/* Soft light blobs, like the sheen on a card. */}
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full transition-opacity duration-300 ${
                                    isSelected
                                        ? "bg-white/15 opacity-100"
                                        : "bg-blue-500/5 opacity-100"
                                }`}
                            />
                            <span
                                aria-hidden="true"
                                className={`pointer-events-none absolute -bottom-16 right-16 h-32 w-32 rounded-full ${
                                    isSelected ? "bg-sky-300/20" : "bg-transparent"
                                }`}
                            />

                            <div className="relative flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span
                                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                                            isSelected
                                                ? "bg-white/20 text-white backdrop-blur"
                                                : "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                                        }`}
                                    >
                                        <Icon size={20} />
                                    </span>

                                    <div>
                                        <p className="text-lg font-bold tracking-tight">
                                            {option.label}
                                        </p>
                                        <p
                                            className={`text-xs ${
                                                isSelected
                                                    ? "text-white/80"
                                                    : "text-gray-500 dark:text-gray-400"
                                            }`}
                                        >
                                            {option.description}
                                        </p>
                                    </div>
                                </div>

                                <span
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                        isSelected
                                            ? "border-white bg-white text-blue-600"
                                            : "border-gray-300 dark:border-gray-600"
                                    }`}
                                >
                                    {isSelected && (
                                        <Check size={14} strokeWidth={3} />
                                    )}
                                </span>
                            </div>

                            <div className="relative mt-5 flex items-end justify-between gap-3">
                                {/* Card "chip" */}
                                <span
                                    aria-hidden="true"
                                    className={`h-7 w-10 rounded-md ${
                                        isSelected
                                            ? "bg-gradient-to-br from-yellow-200 to-amber-400 shadow-inner"
                                            : "bg-gray-200 dark:bg-gray-700"
                                    }`}
                                />

                                <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                                        isSelected
                                            ? "bg-white/20 text-white"
                                            : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                                    }`}
                                >
                                    {option.timing}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {error && (
                <p
                    role="alert"
                    className="text-sm font-medium text-red-600 dark:text-red-400"
                >
                    {error}
                </p>
            )}

            <AnimatePresence initial={false}>
                {isGcash && (
                    <motion.div
                        key="gcash-plan"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-4">
                            <div>
                                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                                    How much would you like to pay now?
                                </p>

                                <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                                    {[
                                        {
                                            full: false,
                                            label: "Reservation fee",
                                            amount: upfrontTotal,
                                        },
                                        {
                                            full: true,
                                            label: "Pay in full",
                                            amount: finalTotal,
                                        },
                                    ].map((plan) => {
                                        const active = payInFull === plan.full;

                                        return (
                                            <button
                                                key={plan.label}
                                                type="button"
                                                aria-pressed={active}
                                                disabled={disabled}
                                                onClick={() =>
                                                    onPayInFullChange?.(
                                                        plan.full
                                                    )
                                                }
                                                className={`relative rounded-full px-3 py-2 text-center transition-colors disabled:cursor-not-allowed ${
                                                    active
                                                        ? "text-gray-900 dark:text-white"
                                                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                                                }`}
                                            >
                                                {active && (
                                                    <motion.span
                                                        layoutId="pay-plan-pill"
                                                        transition={{
                                                            type: "spring",
                                                            stiffness: 400,
                                                            damping: 32,
                                                        }}
                                                        className="absolute inset-0 rounded-full bg-white shadow dark:bg-gray-700"
                                                    />
                                                )}
                                                <span className="relative block text-xs font-semibold">
                                                    {plan.label}
                                                </span>
                                                <span className="relative block text-[11px] opacity-80">
                                                    {formatCurrency(plan.amount)}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Now vs. at pickup */}
                            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
                                <div className="flex items-end justify-between gap-4">
                                    <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                            Pay now
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(amountDueNow)}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                            At pickup
                                        </p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {formatCurrency(dueAtPickup)}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                    <motion.div
                                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400"
                                        initial={false}
                                        animate={{ width: `${nowShare}%` }}
                                        transition={{ duration: 0.4, ease: "easeOut" }}
                                    />
                                </div>

                                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                    {payInFull ? (
                                        <>
                                            You&apos;re paying the full amount
                                            now via GCash. Nothing will be due
                                            at pickup.
                                        </>
                                    ) : (
                                        <>
                                            A reservation fee of{" "}
                                            <strong className="text-gray-700 dark:text-gray-200">
                                                {formatCurrency(reservationFee)}
                                            </strong>{" "}
                                            confirms this booking and is
                                            deducted from your total rental
                                            fee. The rest is paid in cash at
                                            pickup.
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {selectedOption?.note && (
                <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    {selectedOption.note}
                </p>
            )}

            {!value && (
                <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Info size={13} className="mt-0.5 shrink-0" />
                    A reservation fee of {formatCurrency(reservationFee)} is
                    required to confirm this booking. It is deducted from your
                    total rental fee.
                </p>
            )}
        </div>
    );
};

export default PaymentMethodPicker;
