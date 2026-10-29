const RadioGroup = ({
    label,
    name,
    value,
    onChange,
    options = [],
    error,
    helperText,
    disabled = false,
    required = false,
    className = "",
}) => {
    return (
        <fieldset className={className}>
            {label && (
                <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {label}
                    {required && (
                        <span className="ml-1 text-red-500">
                            *
                        </span>
                    )}
                </legend>
            )}

            <div className="space-y-3">
                {options.map((option) => (
                    <label
                        key={option.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                            disabled
                                ? "cursor-not-allowed opacity-60"
                                : value === option.value
                                ? "border-primary-500 bg-primary-50 border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40"
                                : "border-slate-200 hover:border-primary-300 dark:border-slate-700 dark:hover:border-blue-700"
                        }`}
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={
                                value === option.value
                            }
                            disabled={disabled}
                            onChange={() =>
                                onChange?.(
                                    option.value
                                )
                            }
                            className="mt-1 h-4 w-4 accent-primary-600"
                        />

                        <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
                                {option.label}
                            </div>

                            {option.description && (
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {
                                        option.description
                                    }
                                </p>
                            )}
                        </div>
                    </label>
                ))}
            </div>

            {helperText && !error && (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {helperText}
                </p>
            )}

            {error && (
                <p className="mt-2 text-xs text-red-500">
                    {error}
                </p>
            )}
        </fieldset>
    );
};

export default RadioGroup;