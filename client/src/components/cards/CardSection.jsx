const CardSection = ({
    title,
    subtitle,
    children,
    className = "",
    contentClassName = "",
}) => {
    return (
        <section
            className={[
                "rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900",
                "shadow-sm",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {(title || subtitle) && (
                <header className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                    {title && (
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                            {title}
                        </h3>
                    )}

                    {subtitle && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {subtitle}
                        </p>
                    )}
                </header>
            )}

            <div
                className={[
                    "p-5",
                    contentClassName,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {children}
            </div>
        </section>
    );
};

export default CardSection;