import { BadgeDollarSign } from "lucide-react";
import { useEffect, useState } from "react";

import Button from "../common/Button";
import Input from "../common/Input";
import Modal from "../common/Modal";
import Select from "../common/Select";

const REFUND_REASONS = [
    { value: "Cancellation", label: "Cancellation" },
    { value: "Overpayment", label: "Overpayment" },
    { value: "Adjustment", label: "Adjustment" },
    { value: "Other", label: "Other" },
];

const RefundModal = ({
    isOpen,
    onClose,
    onSubmit,
    loading = false,
    rental,
}) => {
    const [amount, setAmount] = useState("");
    const [reason, setReason] = useState("");
    const [description, setDescription] = useState("");
    const [reference, setReference] = useState("");

    useEffect(() => {
        if (!isOpen) {
            setAmount("");
            setReason("");
            setDescription("");
            setReference("");
        }
    }, [isOpen]);

    if (!rental) return null;

    const formatCurrency = (value) => {
        const amount = Number(value);
        return Number.isFinite(amount)
            ? `₱${amount.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              })}`
            : "₱0.00";
    };

    const totalPaid =
        Number(rental?.financial?.amountPaid ?? 0) -
        Number(rental?.financial?.refunds ?? 0);

    const handleSubmit = async () => {
        const parsedAmount = Number.parseFloat(amount);

        if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
            return;
        }

        if (!reason) {
            return;
        }

        await onSubmit({
            amount: parsedAmount,
            reason,
            description: description.trim() || "",
            reference: reference.trim() || "",
        });
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Record Refund"
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
                        variant="primary"
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={
                            !amount ||
                            Number.parseFloat(amount) <= 0 ||
                            !reason
                        }
                    >
                        Record Refund
                    </Button>
                </div>
            }
        >
            <div className="space-y-5">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/20">
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        <BadgeDollarSign size={16} />
                        <span>
                            Customer:{" "}
                            {[
                                rental?.customer?.firstName,
                                rental?.customer?.lastName,
                            ]
                                .filter(Boolean)
                                .join(" ") ||
                                rental?.customer?.fullName ||
                                rental?.customer?.name ||
                                "—"}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                        <BadgeDollarSign size={16} />
                        <span>
                            Rental: {rental?.rentalCode ?? "—"}
                        </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-white p-3 dark:bg-gray-800">
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                            Max Refundable Amount
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-white">
                            {formatCurrency(totalPaid)}
                        </span>
                    </div>
                </div>

                <Input
                    id="refund-amount"
                    name="amount"
                    type="number"
                    label="Refund Amount (₱)"
                    required
                    min="0.01"
                    max={totalPaid}
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(event) =>
                        setAmount(event.target.value)
                    }
                />

                <Select
                    id="refund-reason"
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
                        htmlFor="refund-description"
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                        Description{" "}
                        <span className="text-gray-400">
                            (optional)
                        </span>
                    </label>
                    <textarea
                        id="refund-description"
                        value={description}
                        onChange={(event) =>
                            setDescription(event.target.value)
                        }
                        rows={3}
                        maxLength={500}
                        placeholder="Describe the reason for this refund..."
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-gray-400 dark:focus:ring-gray-700"
                    />
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {description.length}/500
                    </p>
                </div>

                <Input
                    id="refund-reference"
                    name="reference"
                    type="text"
                    label="Reference Number"
                    placeholder="e.g., OR-12345, TXN-67890"
                    value={reference}
                    onChange={(event) =>
                        setReference(event.target.value)
                    }
                />
            </div>
        </Modal>
    );
};

export default RefundModal;
