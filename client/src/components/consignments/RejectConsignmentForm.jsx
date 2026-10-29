const QUICK_REASONS = [
    "Incomplete or unclear vehicle documents",
    "OR/CR does not match vehicle or applicant details",
    "Vehicle does not meet platform standards",
    "Photos are unclear, missing, or misleading",
    "Ownership details could not be verified",
    "Duplicate or already-listed application",
];

const RejectConsignmentForm = ({
    value,
    onChange,
    disabled = false,
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

    const applyQuickReason = (reason) => {
        const current = value.remarks?.trim() ?? "";

        if (current.includes(reason)) {
            return;
        }

        updateField(
            "remarks",
            current
                ? `${current}\n${reason}`
                : reason
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Rejection Remarks
                    <span className="ml-1 text-red-500">
                        *
                    </span>
                </label>

                <div className="mb-3 flex flex-wrap gap-2">
                    {QUICK_REASONS.map((reason) => (
                        <button
                            key={reason}
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                                applyQuickReason(reason)
                            }
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
                        >
                            {reason}
                        </button>
                    ))}
                </div>

                <textarea
                    rows={5}
                    value={
                        value.remarks
                    }
                    onChange={(event) =>
                        updateField(
                            "remarks",
                            event.target.value
                        )
                    }
                    disabled={disabled}
                    placeholder="Explain why this consignment application is being rejected."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-red-500/30 dark:disabled:bg-gray-800"
                />
            </div>
        </div>
    );
};

export default RejectConsignmentForm;