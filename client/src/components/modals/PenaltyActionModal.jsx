import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    BadgeCheck,
    Clock3,
    Pencil,
    StickyNote,
} from "lucide-react";

import Button from "../common/Button";
import Input from "../common/Input";
import Modal from "../common/Modal";

const MODE_CONFIG = {
    waive: {
        title: "Waive Penalty",
        icon: BadgeCheck,
        tone: "text-red-600 bg-red-50 dark:bg-red-950/40 dark:text-red-400",
        confirmLabel: "Waive Penalty",
        confirmVariant: "danger",
        description:
            "This sets the entire late return penalty to ₱0.00. The action is recorded in the penalty history.",
        reasonRequired: false,
    },
    adjust: {
        title: "Adjust Penalty",
        icon: Pencil,
        tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400",
        confirmLabel: "Save Adjustment",
        confirmVariant: "primary",
        description:
            "Set a new penalty amount. It cannot be negative or exceed the configured maximum cap.",
        reasonRequired: false,
    },
    note: {
        title: "Add Penalty Note",
        icon: StickyNote,
        tone: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400",
        confirmLabel: "Add Note",
        confirmVariant: "primary",
        description:
            "Attach a note to the penalty record. The penalty amount is left unchanged.",
        reasonRequired: true,
    },
    apply: {
        title: "Apply Penalty",
        icon: Clock3,
        tone: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400",
        confirmLabel: "Apply Penalty",
        confirmVariant: "primary",
        description:
            "Calculate the late return penalty from the current rules and apply it to this rental.",
        reasonRequired: false,
    },
};

const formatCurrency = (value) => {
    const amount = Number(value);

    return Number.isFinite(amount)
        ? `₱${amount.toLocaleString("en-PH", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
          })}`
        : "₱0.00";
};

const PenaltyActionModal = ({
    isOpen,
    onClose,
    mode = "adjust",
    rental,
    maximumCap = 0,
    loading = false,
    onSubmit,
}) => {
    const config = MODE_CONFIG[mode] ?? MODE_CONFIG.adjust;

    const currentAmount = Number(
        rental?.lateReturn?.amount ?? 0
    );

    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (isOpen) {
            setAmount(
                mode === "adjust"
                    ? String(currentAmount)
                    : ""
            );
            setReason("");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, mode]);

    const amountError = useMemo(() => {
        if (mode !== "adjust") {
            return "";
        }

        if (amount === "" || amount === null) {
            return "Enter a new penalty amount.";
        }

        const parsed = Number(amount);

        if (!Number.isFinite(parsed) || parsed < 0) {
            return "Amount must be a non-negative number.";
        }

        if (maximumCap > 0 && parsed > maximumCap) {
            return `Amount cannot exceed the maximum cap of ${formatCurrency(
                maximumCap
            )}.`;
        }

        return "";
    }, [mode, amount, maximumCap]);

    const reasonError =
        config.reasonRequired && !reason.trim()
            ? "A reason is required."
            : "";

    const canSubmit =
        !loading && !amountError && !reasonError;

    if (!isOpen || !rental) {
        return null;
    }

    const Icon = config.icon;

    const customerName =
        [
            rental?.customer?.firstName,
            rental?.customer?.lastName,
        ]
            .filter(Boolean)
            .join(" ") ||
        rental?.customer?.fullName ||
        rental?.customer?.name ||
        "—";

    const handleSubmit = () => {
        if (!canSubmit) {
            return;
        }

        const payload = {
            mode,
            rentalId: rental._id,
            reason: reason.trim(),
        };

        if (mode === "adjust") {
            payload.newAmount = Number(amount);
        }

        onSubmit?.(payload);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={config.title}
            size="md"
            footer={
                <div className="flex justify-end gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={loading}
                    >
                        Cancel
                    </Button>

                    <Button
                        type="button"
                        variant={config.confirmVariant}
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={!canSubmit}
                    >
                        {config.confirmLabel}
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                    <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.tone}`}
                    >
                        <Icon size={18} />
                    </div>

                    <div className="min-w-0 text-sm">
                        <p className="font-semibold text-gray-900 dark:text-white">
                            {rental?.rentalCode ?? "Rental"}
                            <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                                {customerName}
                            </span>
                        </p>

                        <p className="mt-1 text-gray-500 dark:text-gray-400">
                            {config.description}
                        </p>
                    </div>
                </div>

                {mode !== "apply" && (
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-900">
                        <span className="text-gray-600 dark:text-gray-400">
                            Current penalty
                        </span>

                        <span className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(currentAmount)}
                        </span>
                    </div>
                )}

                {mode === "adjust" && (
                    <Input
                        id="penalty-amount"
                        name="newAmount"
                        type="number"
                        label="New Penalty Amount (₱)"
                        required
                        min="0"
                        max={
                            maximumCap > 0
                                ? maximumCap
                                : undefined
                        }
                        step="0.01"
                        placeholder="0.00"
                        value={amount}
                        error={amountError}
                        onChange={(event) =>
                            setAmount(event.target.value)
                        }
                        helperText={
                            maximumCap > 0
                                ? `Maximum cap: ${formatCurrency(
                                      maximumCap
                                  )}`
                                : "No maximum cap is configured."
                        }
                    />
                )}

                <div>
                    <label
                        htmlFor="penalty-reason"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        Reason{" "}
                        <span className="text-gray-400">
                            {config.reasonRequired
                                ? "(required)"
                                : "(optional)"}
                        </span>
                    </label>

                    <textarea
                        id="penalty-reason"
                        value={reason}
                        onChange={(event) =>
                            setReason(event.target.value)
                        }
                        rows={3}
                        maxLength={500}
                        placeholder="Explain why this action is being taken..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                    />

                    <div className="mt-1 flex items-center justify-between">
                        <p className="text-xs text-red-600 dark:text-red-400">
                            {reasonError}
                        </p>

                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {reason.length}/500
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default PenaltyActionModal;
