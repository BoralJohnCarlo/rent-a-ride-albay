const variants = {
    default:
        "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200",

    primary:
        "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",

    secondary:
        "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",

    success:
        "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400",

    warning:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400",

    danger:
        "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",

    info:
        "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400",

    purple:
        "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",

    admin:
        "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",

    operator:
        "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400",

    customer:
        "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
};

const sizes = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
};

const Badge = ({
    children,
    variant = "default",
    size = "md",
    rounded = true,
    className = "",
}) => {
    return (
        <span
            className={[
                "inline-flex items-center justify-center font-medium whitespace-nowrap",
                rounded
                    ? "rounded-full"
                    : "rounded-md",
                variants[variant] ??
                    variants.default,
                sizes[size] ?? sizes.md,
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </span>
    );
};

export default Badge;