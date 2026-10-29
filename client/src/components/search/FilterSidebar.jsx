const FilterSidebar = ({
    title = "Filters",
    children,
    className = "",
}) => {
    return (
        <aside
            className={[
                "w-full rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900 shadow-sm",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="mb-5 border-b border-gray-200 pb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                    {title}
                </h2>
            </div>

            <div className="space-y-6">
                {children}
            </div>
        </aside>
    );
};

export default FilterSidebar;