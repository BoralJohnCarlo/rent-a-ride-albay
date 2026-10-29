import { forwardRef } from "react";

const Textarea = forwardRef(
    (
        {
            id,
            name,
            label,
            value,
            onChange,
            rows = 4,
            placeholder = "",
            error,
            helperText,
            required = false,
            disabled = false,
            className = "",
            ...props
        },
        ref
    ) => {
        return (
            <div className="space-y-2">
                {label && (
                    <label
                        htmlFor={id || name}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {label}

                        {required && (
                            <span className="ml-1 text-red-500">
                                *
                            </span>
                        )}
                    </label>
                )}

                <textarea
                    ref={ref}
                    id={id || name}
                    name={name}
                    value={value}
                    onChange={onChange}
                    rows={rows}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className={`
                        w-full
                        rounded-lg
                        border
                        bg-white
                        px-4
                        py-3
                        text-gray-900
                        outline-none
                        transition
                        duration-200
                        resize-y
                        placeholder:text-gray-400
                        disabled:cursor-not-allowed
                        disabled:bg-gray-100
                        dark:border-gray-700
                        dark:bg-gray-900
                        dark:text-gray-100
                        dark:placeholder:text-gray-500
                        dark:disabled:bg-gray-800
                        focus:ring-2
                        ${
                            error
                                ? "border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-950"
                                : "border-gray-300 focus:border-blue-500 focus:ring-blue-200 dark:focus:border-blue-400 dark:focus:ring-blue-950"
                        }
                        ${className}
                    `}
                    {...props}
                />

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
    }
);

Textarea.displayName = "Textarea";

export default Textarea;