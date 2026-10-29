import { LoaderCircle } from "lucide-react";

const variants = {
    primary:
        "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",

    secondary:
        "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-gray-500",

    outline:
        "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-gray-500",

    danger:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",

    success:
        "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",

    brand:
        "bg-yellow-500 text-black hover:bg-yellow-400 focus:ring-yellow-400",

    ghost:
        "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:ring-gray-500",

    dark:
        "bg-gray-900 text-white hover:bg-black focus:ring-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white dark:focus:ring-gray-400",
};

const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-6 py-4 text-lg",
};

const Button = ({
    children,
    type = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className = "",
    ...props
}) => {
    const isDisabled = loading || disabled;

    return (
        <button
            type={type}
            disabled={isDisabled}
            className={`
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-lg
                font-medium
                transition-all
                duration-200
                focus:outline-none
                focus:ring-2
                disabled:cursor-not-allowed
                disabled:opacity-50
                ${variants[variant]}
                ${sizes[size]}
                ${fullWidth ? "w-full" : ""}
                ${className}
            `}
            {...props}
        >
            {loading ? (
                <>
                    <LoaderCircle
                        size={18}
                        className="animate-spin"
                    />

                    <span>Loading...</span>
                </>
            ) : (
                <>
                    {leftIcon}

                    <span>{children}</span>

                    {rightIcon}
                </>
            )}
        </button>
    );
};

export default Button;