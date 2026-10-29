const CardDetailItem = ({
    label,
    value,
    icon = null,
    className = "",
    labelClassName = "",
    valueClassName = "",
}) => {
    return (
        <div
            className={`
                flex
                flex-col
                gap-1
                ${className}
            `}
        >
            <div className="flex items-center gap-2">
                {icon && (
                    <span className="text-gray-400 dark:text-gray-500">
                        {icon}
                    </span>
                )}

                <span
                    className={`
                        text-xs
                        font-medium
                        uppercase
                        tracking-wide
                        text-gray-500
                        dark:text-gray-400
                        ${labelClassName}
                    `}
                >
                    {label}
                </span>
            </div>

            <span
                className={`
                    break-words
                    text-sm
                    font-medium
                    text-gray-900
                    dark:text-gray-100
                    ${valueClassName}
                `}
            >
                {value ??
                    "Not Available"}
            </span>
        </div>
    );
};

export default CardDetailItem;