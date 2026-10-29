import {
    Banknote,
    CircleDollarSign,
    Clock,
    CreditCard,
    ShieldCheck,
    AlertTriangle,
    Hammer,
    Package,
    CalendarClock,
    Undo2,
} from "lucide-react";

const formatAmount = (value) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return "₱0.00";
    }

    return `₱${amount.toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const getTotalCharges = (rental) => {
    if (Number.isFinite(Number(rental?.financial?.finalAmount))) {
        return Number(rental.financial.finalAmount);
    }

    if (Number.isFinite(Number(rental?.financial?.totalAmount))) {
        return Number(rental.financial.totalAmount);
    }

    if (Number.isFinite(Number(rental?.totalAmount))) {
        return Number(rental.totalAmount);
    }

    if (Number.isFinite(Number(rental?.booking?.pricing?.totalAmount))) {
        return Number(rental.booking.pricing.totalAmount);
    }

    return 0;
};

const getPaidAmount = (rental) => {
    if (
        Number.isFinite(
            Number(rental?.financial?.amountPaid)
        )
    ) {
        return Number(rental.financial.amountPaid);
    }

    if (
        Number.isFinite(
            Number(rental?.financial?.paidAmount)
        )
    ) {
        return Number(rental.financial.paidAmount);
    }

    if (
        Number.isFinite(
            Number(rental?.paidAmount)
        )
    ) {
        return Number(rental.paidAmount);
    }

    return 0;
};

const getBalance = (rental, total, paid) => {
    if (
        Number.isFinite(
            Number(rental?.financial?.balance)
        )
    ) {
        return Number(rental.financial.balance);
    }

    if (
        Number.isFinite(
            Number(rental?.balance)
        )
    ) {
        return Number(rental.balance);
    }

    return Math.max(total - paid, 0);
};

const getSecurityDeposit = (rental) => {
    const deposit =
        rental?.securityDeposit ??
        rental?.financial?.securityDeposit;

    if (!deposit) {
        return {
            amount: 0,
            status: null,
            amountHeld: 0,
            amountDeducted: 0,
            amountReleased: 0,
            deductionReason: "",
        };
    }

    if (typeof deposit === "number") {
        return {
            amount: deposit,
            status: null,
            amountHeld: 0,
            amountDeducted: 0,
            amountReleased: 0,
            deductionReason: "",
        };
    }

    return {
        amount:
            Number(deposit.amount) || 0,
        status:
            deposit.status ||
            deposit.state ||
            null,
        amountHeld:
            Number(deposit.amountHeld) || 0,
        amountDeducted:
            Number(deposit.amountDeducted) || 0,
        amountReleased:
            Number(deposit.amountReleased) || 0,
        deductionReason:
            deposit.deductionReason || "",
    };
};

const FinancialItem = ({
    icon: Icon,
    label,
    value,
    valueClassName = "",
}) => {
    return (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
            <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-400">
                    <Icon size={17} />
                </div>

                <span className="text-sm text-gray-600 dark:text-gray-300">
                    {label}
                </span>
            </div>

            <span
                className={[
                    "whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white",
                    valueClassName,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {value}
            </span>
        </div>
    );
};

const getRefundTotals = (rental) => {
    const approved = Number(
        rental?.financial?.refunds || 0
    );

    const pending = Array.isArray(rental?.refunds)
        ? rental.refunds
              .filter(
                  (refund) => refund.status === "Pending"
              )
              .reduce(
                  (sum, refund) =>
                      sum + Number(refund.amount || 0),
                  0
              )
        : 0;

    return { approved, pending };
};

const RentalFinancialSummary = ({
    rental,
}) => {
    const total = getTotalCharges(rental);
    const paid = getPaidAmount(rental);
    const balance = getBalance(
        rental,
        total,
        paid
    );

    const securityDeposit =
        getSecurityDeposit(rental);

    const refundTotals = getRefundTotals(rental);

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                    <CircleDollarSign
                        size={19}
                    />
                </div>

                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Financial Summary
                    </p>

                    <h3 className="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                        Rental Finances
                    </h3>
                </div>
            </div>

            <div className="mt-5 space-y-2">
                <FinancialItem
                    icon={Banknote}
                    label="Total Charges"
                    value={formatAmount(total)}
                />

                <FinancialItem
                    icon={CreditCard}
                    label="Paid"
                    value={formatAmount(paid)}
                    valueClassName="text-emerald-600 dark:text-emerald-400"
                />

                <FinancialItem
                    icon={CircleDollarSign}
                    label="Balance"
                    value={formatAmount(balance)}
                    valueClassName={
                        balance > 0
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                    }
                />

                <FinancialItem
                    icon={ShieldCheck}
                    label="Security Deposit"
                    value={formatAmount(
                        securityDeposit.amount
                    )}
                />

                {refundTotals.approved > 0 && (
                    <FinancialItem
                        icon={Undo2}
                        label="Refunded"
                        value={`-${formatAmount(
                            refundTotals.approved
                        )}`}
                        valueClassName="text-emerald-600 dark:text-emerald-400"
                    />
                )}

                {refundTotals.pending > 0 && (
                    <FinancialItem
                        icon={Clock}
                        label="Refund Pending Review"
                        value={formatAmount(
                            refundTotals.pending
                        )}
                        valueClassName="text-amber-600 dark:text-amber-400"
                    />
                )}
            </div>

            {(rental.financial?.extensionCharges > 0 ||
                rental.financial?.lateCharges > 0 ||
                rental.financial?.damageCharges > 0 ||
                rental.financial?.otherCharges > 0 ||
                rental.financial?.securityDepositApplied >
                    0) && (
                <div className="mt-4 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Charge Breakdown
                    </p>

                    <div className="space-y-2">
                        {rental.financial?.extensionCharges >
                            0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <CalendarClock
                                        size={14}
                                        className="text-blue-500"
                                    />

                                    Extension
                                    Charges
                                </span>

                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatAmount(
                                        rental.financial
                                            .extensionCharges
                                    )}
                                </span>
                            </div>
                        )}

                        {rental.financial?.lateCharges >
                            0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <AlertTriangle
                                        size={14}
                                        className="text-red-500"
                                    />

                                    Late Return
                                    Charge
                                </span>

                                <span className="font-semibold text-red-700 dark:text-red-300">
                                    {formatAmount(
                                        rental.financial
                                            .lateCharges
                                    )}
                                </span>
                            </div>
                        )}

                        {rental.financial?.damageCharges >
                            0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <Hammer
                                        size={14}
                                        className="text-orange-500"
                                    />

                                    Damage
                                    Charges
                                </span>

                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatAmount(
                                        rental.financial
                                            .damageCharges
                                    )}
                                </span>
                            </div>
                        )}

                        {rental.financial?.otherCharges >
                            0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <Package
                                        size={14}
                                        className="text-gray-500"
                                    />

                                    Other Charges
                                </span>

                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {formatAmount(
                                        rental.financial
                                            .otherCharges
                                    )}
                                </span>
                            </div>
                        )}

                        {rental.financial
                            ?.securityDepositApplied >
                            0 && (
                            <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                                    <ShieldCheck
                                        size={14}
                                        className="text-emerald-500"
                                    />

                                    Covered by Security
                                    Deposit
                                </span>

                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                    -
                                    {formatAmount(
                                        rental.financial
                                            .securityDepositApplied
                                    )}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {securityDeposit.status && (
                <div className="mt-4 space-y-2 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
                            Deposit Status
                        </span>

                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {securityDeposit.status}
                        </span>
                    </div>

                    {securityDeposit.amountHeld > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                                Held
                            </span>

                            <span className="font-medium text-gray-700 dark:text-gray-200">
                                {formatAmount(
                                    securityDeposit.amountHeld
                                )}
                            </span>
                        </div>
                    )}

                    {securityDeposit.amountDeducted > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                                Deducted
                            </span>

                            <span className="font-medium text-red-600 dark:text-red-400">
                                -
                                {formatAmount(
                                    securityDeposit.amountDeducted
                                )}
                            </span>
                        </div>
                    )}

                    {securityDeposit.amountReleased > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400">
                                Released
                            </span>

                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                {formatAmount(
                                    securityDeposit.amountReleased
                                )}
                            </span>
                        </div>
                    )}

                    {securityDeposit.deductionReason && (
                        <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                            Reason:{" "}
                            {
                                securityDeposit.deductionReason
                            }
                        </p>
                    )}
                </div>
            )}
        </section>
    );
};

export default RentalFinancialSummary;