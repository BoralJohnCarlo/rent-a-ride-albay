const ReviewField = ({
    label,
    value,
    fallback = "—",
}) => {
    return (
        <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
                {label}
            </span>

            <p
                className="
                    mt-1
                    break-words
                    font-medium
                    text-gray-900
                    dark:text-gray-100
                "
            >
                {value || fallback}
            </p>
        </div>
    );
};

export default ReviewField;