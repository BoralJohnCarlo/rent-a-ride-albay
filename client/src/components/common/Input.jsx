import {
    forwardRef,
    useState,
} from "react";

import { Eye, EyeOff } from "lucide-react";

const Input = forwardRef(
    (
        {
            id,
            name,
            type = "text",
            label,
            value,
            onChange,
            placeholder = "",
            error,
            helperText,
            required = false,
            disabled = false,
            autoComplete,
            leftIcon,
            rightIcon,
            className = "",
            ...props
        },
        ref
    ) => {
        const [showPassword, setShowPassword] =
            useState(false);

        const isPassword = type === "password";

        const inputType = isPassword
            ? showPassword
                ? "text"
                : "password"
            : type;

        return (
            <div className="space-y-2">
                {label && (
                    <label
                        htmlFor={id || name}
                        className="
                            block
                            text-sm
                            font-medium
                            text-gray-700
                            dark:text-gray-200
                        "
                    >
                        {label}

                        {required && (
                            <span className="ml-1 text-red-500">
                                *
                            </span>
                        )}
                    </label>
                )}

                <div className="relative">
                    {leftIcon && (
                        <div
                            className="
                                pointer-events-none
                                absolute
                                inset-y-0
                                left-0
                                flex
                                items-center
                                pl-3
                                text-gray-400
                                dark:text-gray-500
                            "
                        >
                            {leftIcon}
                        </div>
                    )}

                    <input
                        ref={ref}
                        id={id || name}
                        name={name}
                        type={inputType}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        required={required}
                        disabled={disabled}
                        autoComplete={autoComplete}
                        className={`
                            w-full
                            rounded-lg
                            border
                            bg-white
                            px-4
                            py-3
                            text-gray-900
                            placeholder:text-gray-400
                            outline-none
                            transition
                            duration-200
                            focus:ring-2
                            disabled:cursor-not-allowed
                            disabled:bg-gray-100
                            disabled:text-gray-500
                            dark:bg-gray-900
                            dark:text-gray-100
                            dark:placeholder:text-gray-500
                            dark:disabled:bg-gray-800
                            dark:disabled:text-gray-500
                            ${
                                error
                                    ? "border-red-500 focus:border-red-500 focus:ring-red-200 dark:focus:ring-red-900/40"
                                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200 dark:border-gray-600 dark:focus:border-blue-400 dark:focus:ring-blue-900/40"
                            }
                            ${leftIcon ? "pl-10" : ""}
                            ${
                                isPassword ||
                                rightIcon
                                    ? "pr-12"
                                    : ""
                            }
                            ${className}
                        `}
                        {...props}
                    />

                    {isPassword ? (
                        <button
                            type="button"
                            onClick={() =>
                                setShowPassword(
                                    (previous) =>
                                        !previous
                                )
                            }
                            className="
                                absolute
                                inset-y-0
                                right-0
                                flex
                                items-center
                                pr-3
                                text-gray-500
                                transition-colors
                                duration-200
                                hover:text-gray-700
                                dark:text-gray-400
                                dark:hover:text-gray-200
                            "
                        >
                            {showPassword ? (
                                <EyeOff size={20} />
                            ) : (
                                <Eye size={20} />
                            )}
                        </button>
                    ) : (
                        rightIcon && (
                            <div
                                className="
                                    absolute
                                    inset-y-0
                                    right-0
                                    flex
                                    items-center
                                    pr-3
                                    text-gray-400
                                    dark:text-gray-500
                                "
                            >
                                {rightIcon}
                            </div>
                        )
                    )}
                </div>

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

Input.displayName = "Input";

export default Input;