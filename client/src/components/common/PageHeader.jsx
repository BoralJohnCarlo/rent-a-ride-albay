const PageHeader = ({
    title,
    subtitle,
    actions,
    divider = true,
    className = "",
}) => {
    return (
        <header
            className={`
                flex
                flex-col
                gap-2
                md:flex-row
                md:items-center
                md:justify-between
                ${
                    divider
                        ? "border-b border-gray-200 pb-4 dark:border-gray-800"
                        : ""
                }
                ${className}
            `}
        >
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {title}
                </h1>

                {subtitle && (
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        {subtitle}
                    </p>
                )}
            </div>

            {actions && (
                <div className="flex items-center gap-3">
                    {actions}
                </div>
            )}
        </header>
    );
};

export default PageHeader;