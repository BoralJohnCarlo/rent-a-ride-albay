const QUICK_REASONS = [
    "Please re-upload clearer OR/CR documents",
    "Vehicle photos are unclear or incomplete",
    "Additional vehicle photos are needed (interior/exterior/damage)",
    "Vehicle details do not match the submitted documents",
    "Pricing information needs adjustment",
    "Missing or unclear valid ID",
];

const RequestRevisionForm = ({
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
                    Revision Remarks
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
                            className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50"
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
                    placeholder="Explain what the applicant needs to revise before the application can continue."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-amber-500/30 dark:disabled:bg-gray-800"
                />
            </div>
        </div>
    );
};

export default RequestRevisionForm;