const variants = {
    default: `
        text-gray-500
        hover:bg-gray-100
        hover:text-gray-700
        dark:text-gray-400
        dark:hover:bg-gray-800
        dark:hover:text-gray-200
    `,

    primary: `
        text-blue-600
        hover:bg-blue-50
        hover:text-blue-700
        dark:text-blue-400
        dark:hover:bg-blue-950/50
        dark:hover:text-blue-300
    `,

    success: `
        text-green-600
        hover:bg-green-50
        hover:text-green-700
        dark:text-green-400
        dark:hover:bg-green-950/50
        dark:hover:text-green-300
    `,

    warning: `
        text-amber-600
        hover:bg-amber-50
        hover:text-amber-700
        dark:text-amber-400
        dark:hover:bg-amber-950/50
        dark:hover:text-amber-300
    `,

    danger: `
        text-red-600
        hover:bg-red-50
        hover:text-red-700
        dark:text-red-400
        dark:hover:bg-red-950/50
        dark:hover:text-red-300
    `,
};

const sizes = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-10 w-10",
};

const ActionIconButton = ({
    icon: Icon,
    title,
    onClick,
    variant = "default",
    size = "md",
    disabled = false,
    className = "",
}) => {
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            disabled={disabled}
            onClick={onClick}
            className={[
                "inline-flex",
                "items-center",
                "justify-center",
                "rounded-lg",
                "transition-colors",
                "duration-200",
                "disabled:cursor-not-allowed",
                "disabled:opacity-50",
                sizes[size] ?? sizes.md,
                variants[variant] ??
                    variants.default,
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {Icon && <Icon size={18} />}
        </button>
    );
};

export default ActionIconButton;