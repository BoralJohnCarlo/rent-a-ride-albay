const Breadcrumb = ({
    items = [],
}) => {
    return (
        <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-sm">
                {items.length === 0 ? (
                    <li>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                            Dashboard
                        </span>
                    </li>
                ) : (
                    items.map((item, index) => (
                        <li
                            key={`${item.label}-${index}`}
                            className="flex items-center gap-2"
                        >
                            {index > 0 && (
                                <span
                                    className="text-gray-400 dark:text-gray-600"
                                    aria-hidden="true"
                                >
                                    /
                                </span>
                            )}

                            {item.active ? (
                                <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {item.label}
                                </span>
                            ) : (
                                <span className="text-gray-500 dark:text-gray-400">
                                    {item.label}
                                </span>
                            )}
                        </li>
                    ))
                )}
            </ol>
        </nav>
    );
};

export default Breadcrumb;