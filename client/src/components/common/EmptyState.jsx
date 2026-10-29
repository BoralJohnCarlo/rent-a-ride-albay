import { Inbox } from "lucide-react";

const EmptyState = ({
    title = "No Data Found",
    description = "There's nothing to display at the moment.",
    icon,
    action,
    className = "",
}) => {
    const Icon = icon || Inbox;

    return (
        <div
            className={`
                flex
                flex-col
                items-center
                justify-center
                rounded-xl
                border
                border-dashed
                border-gray-300
                bg-white
                px-8
                py-12
                text-center
                dark:border-gray-700
                dark:bg-gray-900
                ${className}
            `}
        >
            <Icon
                size={56}
                className="mb-5 text-gray-400 dark:text-gray-500"
            />

            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {title}
            </h3>

            <p className="mt-2 max-w-md text-gray-500 dark:text-gray-400">
                {description}
            </p>

            {action && (
                <div className="mt-6">
                    {action}
                </div>
            )}
        </div>
    );
};

export default EmptyState;