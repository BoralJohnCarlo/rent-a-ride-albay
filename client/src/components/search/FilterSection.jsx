const FilterSection = ({
    title,
    children,
    className = "",
}) => {
    return (
        <section
            className={className}
        >
            {title && (
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                    {title}
                </h3>
            )}

            <div className="space-y-2">
                {children}
            </div>
        </section>
    );
};

export default FilterSection;