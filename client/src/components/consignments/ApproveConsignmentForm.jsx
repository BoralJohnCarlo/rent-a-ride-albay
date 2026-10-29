import Select from "../common/Select";
import Switch from "../common/Switch";

const COMMISSION_MODE_OPTIONS = [
    { value: "PERCENTAGE", label: "Percentage of booking" },
    { value: "FIXED", label: "Fixed amount per booking" },
];

const ApproveConsignmentForm = ({
    value,
    onChange,
    disabled = false,
    useGlobalCommission = true,
    onToggleGlobalCommission,
    platformCommissionRate = null,
}) => {
    const updateField = (
        field,
        fieldValue
    ) => {
        onChange({
            ...value,
            [field]: fieldValue,
        });
    };

    const updateCommission = (
        field,
        fieldValue
    ) => {
        onChange({
            ...value,
            commission: {
                ...value.commission,
                [field]: fieldValue,
            },
        });
    };

    const updatePricing = (
        field,
        fieldValue
    ) => {
        onChange({
            ...value,
            pricing: {
                ...value.pricing,
                [field]: fieldValue,
            },
        });
    };

    const commissionMode =
        value.commission?.mode || "";

    return (
        <div className="space-y-6">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Vehicle Pricing
                    <span className="ml-1 text-red-500">
                        *
                    </span>
                </label>

                <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    The operator doesn't set a rate — set what this
                    vehicle rents for before it goes live as
                    available.
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                            value.pricing
                                ?.dailyRate ?? ""
                        }
                        onChange={(event) =>
                            updatePricing(
                                "dailyRate",
                                event.target.value
                            )
                        }
                        disabled={disabled}
                        placeholder="Daily Rate (₱)"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900"
                    />

                    <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={
                            value.pricing
                                ?.reservationFee ?? ""
                        }
                        onChange={(event) =>
                            updatePricing(
                                "reservationFee",
                                event.target.value
                            )
                        }
                        disabled={disabled}
                        placeholder="Reservation Fee (₱)"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900"
                    />
                </div>
            </div>

            <div
                className={`rounded-xl border p-4 transition-colors ${
                    useGlobalCommission
                        ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
                        : "border-indigo-200 bg-indigo-50/60 dark:border-indigo-900 dark:bg-indigo-950/20"
                }`}
            >
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {useGlobalCommission
                                ? "Use platform's default commission"
                                : "Individual commission for this vehicle"}
                        </p>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {useGlobalCommission
                                ? `This vehicle's payouts will use the platform's default rate${
                                      platformCommissionRate !=
                                      null
                                          ? ` (currently ${platformCommissionRate}%)`
                                          : ""
                                  }.`
                                : "Set a rate just for this vehicle. It stays with this vehicle going forward, even if the platform default changes later."}
                        </p>
                    </div>

                    <Switch
                        id="use-global-commission"
                        name="useGlobalCommission"
                        checked={useGlobalCommission}
                        disabled={disabled}
                        onChange={(event) =>
                            onToggleGlobalCommission?.(
                                event.target.checked
                            )
                        }
                    />
                </div>

                {!useGlobalCommission && (
                    <div className="mt-4 border-t border-indigo-200 pt-4 dark:border-indigo-900">
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Vehicle Commission
                            <span className="ml-1 text-red-500">
                                *
                            </span>
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Select
                                aria-label="Commission rate type"
                                value={commissionMode}
                                onChange={(event) =>
                                    updateCommission(
                                        "mode",
                                        event.target.value
                                    )
                                }
                                disabled={disabled}
                                placeholder="Select rate type"
                                options={COMMISSION_MODE_OPTIONS}
                                className="py-3"
                            />

                            <input
                                type="number"
                                min={0}
                                max={
                                    commissionMode ===
                                    "PERCENTAGE"
                                        ? 100
                                        : undefined
                                }
                                step={0.01}
                                value={
                                    value.commission
                                        ?.value ?? ""
                                }
                                onChange={(event) =>
                                    updateCommission(
                                        "value",
                                        event.target.value
                                    )
                                }
                                disabled={
                                    disabled ||
                                    !commissionMode
                                }
                                placeholder={
                                    commissionMode ===
                                    "FIXED"
                                        ? "Amount in ₱"
                                        : "Percentage (%)"
                                }
                                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900"
                            />
                        </div>

                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {commissionMode === "PERCENTAGE"
                                ? "The partner receives this percentage of each booking's total; the platform keeps the rest."
                                : commissionMode === "FIXED"
                                  ? "The partner receives this exact amount from each booking, regardless of the booking's size."
                                  : "Choose how this partner is paid for this vehicle."}
                        </p>
                    </div>
                )}
            </div>

            <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                    Approval Remarks
                    <span className="ml-1 text-xs font-normal text-gray-500">
                        (Optional)
                    </span>
                </label>

                <textarea
                    rows={5}
                    value={value.remarks}
                    onChange={(event) =>
                        updateField(
                            "remarks",
                            event.target.value
                        )
                    }
                    disabled={disabled}
                    placeholder="Enter additional remarks about this approval."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
            </div>
        </div>
    );
};

export default ApproveConsignmentForm;
