import { BadgeDollarSign } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import Modal from "../common/Modal";
import Select from "../common/Select";

const REFUND_REASONS = [
    { value: "Overpayment", label: "Overpayment" },
    { value: "Adjustment", label: "Billing Adjustment" },
    { value: "Vehicle Performance Issue", label: "Vehicle Performance Issue" },
    { value: "Other", label: "Other" },
];

const REFUND_TYPE_OPTIONS = [
    { value: "full", label: "Full refund" },
    { value: "partial", label: "Partial (%)" },
    { value: "custom", label: "Custom amount" },
];

const RequestRefundModal = ({
    isOpen,
    onClose,
    onSubmit,
    loading = false,
    booking,
}) => {
    const [reason, setReason] = useState("");
    const [description, setDescription] = useState("");
    const [refundType, setRefundType] = useState("full");
    const [percentage, setPercentage] = useState("");
    const [amount, setAmount] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setReason("");
            setDescription("");
            setRefundType("full");
            setPercentage("");
            setAmount("");
        }
    }, [isOpen]);

    if (!booking) {
        return null;
    }

    const isValid = () => {
        if (!reason) {
            return false;
        }

        if (refundType === "partial") {
            const parsedPercentage = Number(percentage);

            return (
                Number.isFinite(parsedPercentage) &&
                parsedPercentage > 0 &&
                parsedPercentage <= 100
            );
        }

        if (refundType === "custom") {
            const parsedAmount = Number(amount);

            return (
                Number.isFinite(parsedAmount) &&
                parsedAmount > 0
            );
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!isValid()) {
            return;
        }

        const payload = {
            reason,
            description: description.trim() || "",
            refundType,
        };

        if (refundType === "partial") {
            payload.percentage = Number(percentage);
        } else if (refundType === "custom") {
            payload.amount = Number(amount);
        }

        await onSubmit(payload);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Request a Refund"
            size="md"
            footer={
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
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
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={!isValid()}
                    >
                        Submit Request
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        <BadgeDollarSign size={16} />
                        <span>
                            Booking: {booking?.bookingCode ?? "—"}
                        </span>
                    </div>
                    <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
                        Choose how much of your eligible refund to request —
                        everything you've paid for this trip that hasn't
                        already been refunded. Our team will review your
                        request and get back to you — approved refunds are
                        returned to your original payment method.
                    </p>
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                        Refund amount
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                        {REFUND_TYPE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                    setRefundType(option.value)
                                }
                                className={`rounded-lg border px-3 py-2.5 text-xs font-semibold transition ${
                                    refundType === option.value
                                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500/60 dark:bg-emerald-500/10 dark:text-emerald-300"
                                        : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-600"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {refundType === "partial" && (
                    <Input
                        id="refund-request-percentage"
                        name="percentage"
                        type="number"
                        label="Percentage of your eligible refund (%)"
                        required
                        min="1"
                        max="100"
                        step="1"
                        value={percentage}
                        onChange={(event) =>
                            setPercentage(event.target.value)
                        }
                        placeholder="e.g. 50"
                    />
                )}

                {refundType === "custom" && (
                    <Input
                        id="refund-request-amount"
                        name="amount"
                        type="number"
                        label="Amount to Refund (₱)"
                        required
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(event) =>
                            setAmount(event.target.value)
                        }
                        placeholder="0.00"
                    />
                )}

                <Select
                    id="refund-request-reason"
                    name="reason"
                    label="Reason"
                    required
                    options={REFUND_REASONS}
                    value={reason}
                    onChange={(event) =>
                        setReason(event.target.value)
                    }
                    placeholder="Select a reason"
                />

                <div>
                    <label
                        htmlFor="refund-request-description"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        Details{" "}
                        <span className="text-gray-400">
                            (optional)
                        </span>
                    </label>
                    <textarea
                        id="refund-request-description"
                        value={description}
                        onChange={(event) =>
                            setDescription(event.target.value)
                        }
                        rows={3}
                        maxLength={500}
                        placeholder="Tell us more about why you're requesting this refund..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                    />
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {description.length}/500
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default RequestRefundModal;
