const ArchiveConsignmentForm = ({
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

    return (
        <div className="space-y-6">
            <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Archive Remarks
                    <span className="ml-1 text-red-500">
                        *
                    </span>
                </label>

                <textarea
                    rows={4}
                    value={value.remarks}
                    onChange={(event) =>
                        updateField(
                            "remarks",
                            event.target.value
                        )
                    }
                    disabled={disabled}
                    placeholder="Explain why this consignment is being archived."
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:focus:ring-gray-500/30 dark:disabled:bg-gray-800"
                />
            </div>
        </div>
    );
};

export default ArchiveConsignmentForm;