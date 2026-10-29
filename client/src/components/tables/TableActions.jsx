import Button from "../common/Button";

const iconColors = {
    blue: "text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40",
    orange: "text-orange-500 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/40",
    gray: "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
    red: "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40",
    green: "text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/40",
    purple: "text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-950/40",
    amber: "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40",
};

const TableActions = ({
    actions = [],
    size = "sm",
    variant = "buttons",
    className = "",
}) => {
    if (variant === "buttons") {
        return (
            <div
                className={[
                    "flex flex-wrap justify-end gap-2",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {actions.map(
                    (
                        {
                            label,
                            variant = "primary",
                            disabled = false,
                            icon: Icon = null,
                            onClick,
                        },
                        index
                    ) => (
                        <Button
                            key={`${label}-${index}`}
                            size={size}
                            variant={variant}
                            disabled={disabled}
                            onClick={(event) => {
                                event.stopPropagation();
                                onClick?.(event);
                            }}
                        >
                            <span className="flex items-center gap-1">
                                {Icon && <Icon size={16} />}
                                {label}
                            </span>
                        </Button>
                    )
                )}
            </div>
        );
    }

    // "xs" shrinks the icon buttons; any other size keeps the default.
    const iconBox = size === "xs" ? "h-7 w-7" : "h-8 w-8";
    const iconSize = size === "xs" ? 15 : 18;

    return (
        <div
            className={[
                size === "xs"
                    ? "flex flex-wrap items-center justify-end gap-0.5"
                    : "flex items-center justify-end gap-1",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {actions.map(
                (
                    {
                        label,
                        icon: Icon,
                        color = "gray",
                        disabled = false,
                        onClick,
                    },
                    index
                ) => (
                    <button
                        key={`${label}-${index}`}
                        type="button"
                        title={label}
                        disabled={disabled}
                        onClick={(event) => {
                            event.stopPropagation();
                            onClick?.(event);
                        }}
                        className={[
                            "flex items-center justify-center rounded-md transition-colors duration-200",
                            iconBox,
                            iconColors[color] ?? iconColors.gray,
                            disabled
                                ? "cursor-not-allowed opacity-50"
                                : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    >
                        {Icon && <Icon size={iconSize} />}
                    </button>
                )
            )}
        </div>
    );
};

export default TableActions;