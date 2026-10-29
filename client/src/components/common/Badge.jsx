const variants = {
    default:
        "bg-gray-100 text-gray-700 ring-gray-500/15 dark:bg-gray-800 dark:text-gray-200 dark:ring-white/10",

    primary:
        "bg-blue-100 text-blue-700 ring-blue-500/20 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-400/20",

    secondary:
        "bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10",

    success:
        "bg-green-100 text-green-700 ring-green-500/20 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-400/20",

    warning:
        "bg-yellow-100 text-yellow-700 ring-yellow-500/25 dark:bg-yellow-950/50 dark:text-yellow-300 dark:ring-yellow-400/20",

    danger:
        "bg-red-100 text-red-700 ring-red-500/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",

    info:
        "bg-cyan-100 text-cyan-700 ring-cyan-500/20 dark:bg-cyan-950/50 dark:text-cyan-300 dark:ring-cyan-400/20",

    purple:
        "bg-purple-100 text-purple-700 ring-purple-500/20 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-400/20",

    admin:
        "bg-red-100 text-red-700 ring-red-500/20 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-400/20",

    operator:
        "bg-purple-100 text-purple-700 ring-purple-500/20 dark:bg-purple-950/50 dark:text-purple-300 dark:ring-purple-400/20",

    customer:
        "bg-blue-100 text-blue-700 ring-blue-500/20 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-400/20",
};

const dotColors = {
    default: "bg-gray-400 dark:bg-gray-500",
    primary: "bg-blue-500",
    secondary: "bg-slate-400 dark:bg-slate-500",
    success: "bg-green-500",
    warning: "bg-yellow-500",
    danger: "bg-red-500",
    info: "bg-cyan-500",
    purple: "bg-purple-500",
    admin: "bg-red-500",
    operator: "bg-purple-500",
    customer: "bg-blue-500",
};

const sizes = {
    sm: "gap-1 px-2 py-0.5 text-xs",
    md: "gap-1.5 px-3 py-1 text-sm",
    lg: "gap-2 px-4 py-1.5 text-base",
};

const dotSizes = {
    sm: "h-1.5 w-1.5",
    md: "h-2 w-2",
    lg: "h-2.5 w-2.5",
};

const Badge = ({
    children,
    variant = "default",
    size = "md",
    rounded = true,
    dot = false,
    pulse = false,
    icon = null,
    animate = true,
    className = "",
}) => {
    const dotColor =
        dotColors[variant] ?? dotColors.default;
    const dotSize = dotSizes[size] ?? dotSizes.md;

    return (
        <span
            className={[
                "inline-flex items-center justify-center font-medium whitespace-nowrap",
                "ring-1 ring-inset shadow-2xs transition-[color,background-color,box-shadow] duration-200",
                animate ? "animate-badge-in" : "",
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
            {dot && (
                <span
                    className={`relative flex shrink-0 ${dotSize}`}
                >
                    {pulse && (
                        <span
                            className={`absolute inline-flex h-full w-full rounded-full ${dotColor} animate-status-ping`}
                        />
                    )}

                    <span
                        className={`relative inline-flex rounded-full ring-1 ring-white/70 dark:ring-black/20 ${dotSize} ${dotColor}`}
                    />
                </span>
            )}

            {icon && (
                <span className="flex shrink-0 items-center [&>svg]:h-[1.1em] [&>svg]:w-[1.1em]">
                    {icon}
                </span>
            )}

            {children}
        </span>
    );
};

export default Badge;
