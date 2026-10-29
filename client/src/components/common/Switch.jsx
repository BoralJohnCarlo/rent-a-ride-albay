const Switch = ({
    id,
    name,
    checked = false,
    onChange,
    label,
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
                    justify-between
                    gap-4
                    ${
                        disabled
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                    }
                `}
            >
                <div className="min-w-0">
                    {label && (
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {label}
                        </p>
                    )}

                    {helperText && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {helperText}
                        </p>
                    )}
                </div>

                <button
                    id={id || name}
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    aria-disabled={disabled}
                    disabled={disabled}
                    onClick={() =>
                        onChange?.({
                            target: {
                                name,
                                type: "switch",
                                checked: !checked,
                            },
                        })
}
                    className={`
                        relative
                        flex
                        h-6
                        w-11
                        min-w-11
                        flex-none
                        items-center
                        rounded-full
                        transition-colors
                        duration-200
                        ease-in-out
                        focus:outline-none
                        focus:ring-2
                        focus:ring-blue-500
                        focus:ring-offset-2
                        dark:focus:ring-blue-400
                        dark:focus:ring-offset-gray-900
                        ${
                            checked
                                ? "bg-blue-600 dark:bg-blue-500"
                                : "bg-gray-300 dark:bg-gray-700"
                        }
                        ${
                            disabled
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                        }
                        ${className}
                    `}
                    {...props}
                >
                    <span
                        className={`
                            pointer-events-none
                            absolute
                            left-0.5
                            h-5
                            w-5
                            rounded-full
                            bg-white
                            shadow-sm
                            transition-transform
                            duration-200
                            ease-in-out
                            dark:bg-gray-100
                            ${
                                checked
                                    ? "translate-x-5"
                                    : "translate-x-0"
                            }
                        `}
                    />
                </button>
            </label>
        </div>
    );
};

export default Switch;