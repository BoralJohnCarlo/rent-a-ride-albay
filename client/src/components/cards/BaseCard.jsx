const BaseCard = ({
    children,
    className = "",

    selected = false,
    hoverable = true,
    clickable = false,

    onClick,
}) => {
    return (
        <div
            onClick={onClick}
            className={[
                "overflow-hidden rounded-2xl border bg-white dark:border-gray-700 dark:bg-gray-900",
                "transition-all duration-200 ease-out",

                selected
                    ? "border-blue-500 ring-2 ring-blue-100 shadow-lg dark:border-blue-400 dark:ring-blue-500/20"
                    : "border-gray-200 shadow-sm dark:border-gray-700",

                hoverable
                    ? "hover:-translate-y-1 hover:border-gray-300 hover:shadow-md dark:hover:border-gray-600"
                    : "",

                clickable
                    ? "cursor-pointer"
                    : "",

                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </div>
    );
};

export default BaseCard;