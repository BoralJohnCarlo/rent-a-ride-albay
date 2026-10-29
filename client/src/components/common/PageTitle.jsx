const PageTitle = ({
    title,
    subtitle,
    align = "left",
    size = "md",
    className = "",
}) => {
    const alignments = {
        left: "text-left",
        center: "text-center",
        right: "text-right",
    };

    const titleSizes = {
        sm: "text-lg",
        md: "text-2xl",
        lg: "text-3xl",
    };

    return (
        <div
            className={`
                ${alignments[align]}
                ${className}
            `}
        >
            <h2
                className={`
                    font-bold
                    text-gray-900
                    dark:text-gray-100
                    ${titleSizes[size]}
                `}
            >
                {title}
            </h2>

            {subtitle && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {subtitle}
                </p>
            )}
        </div>
    );
};

export default PageTitle;