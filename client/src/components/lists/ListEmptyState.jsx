const ListEmptyState = ({
    title = "Nothing to display.",
    description = "",
}) => {
    return (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {title}
            </h3>

            {description && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            )}
        </div>
    );
};

export default ListEmptyState;