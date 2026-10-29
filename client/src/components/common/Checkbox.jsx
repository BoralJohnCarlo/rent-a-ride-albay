const Checkbox = ({
    id,
    name,
    label,
    checked = false,
    onChange,
    error,
    helperText,
    disabled = false,
    className = "",
    ...props
}) => {
    return (
        <div>
            <label
                htmlFor={id || name}
                className={`
                    flex
                    items-center
                    gap-3
                    text-sm
                    font-medium
                    text-gray-700
                    dark:text-gray-300
                    ${
                        disabled
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                    }
                `}
            >
                <input
                    id={id || name}
                    name={name}
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    disabled={disabled}
                    className={`
                        h-4
                        w-4
                        rounded
                        border-gray-300
                        text-blue-600
                        focus:ring-2
                        focus:ring-blue-200
                        focus:ring-offset-1
                        disabled:cursor-not-allowed
                        dark:border-gray-600
                        dark:bg-gray-800
                        dark:text-blue-500
                        dark:focus:ring-blue-950
                        dark:focus:ring-offset-gray-900
                        ${className}
                    `}
                    {...props}
                />

                {label && (
                    <span>
                        {label}
                    </span>
                )}
            </label>

            {error ? (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            ) : (
                helperText && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {helperText}
                    </p>
                )
            )}
        </div>
    );
};

export default Checkbox;