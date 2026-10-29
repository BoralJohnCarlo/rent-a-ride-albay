import { Pencil } from "lucide-react";

const ReviewSection = ({
    title,
    onEdit,
    children,
}) => {
    return (
        <section
            className="
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-white
                dark:border-gray-700
                dark:bg-gray-900
            "
        >
            <div
                className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-gray-200
                    px-6
                    py-4
                    dark:border-gray-700
                "
            >
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {title}
                </h3>

                {onEdit && (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="
                            flex
                            items-center
                            gap-2
                            rounded-lg
                            px-3
                            py-2
                            text-sm
                            font-medium
                            text-blue-600
                            transition-colors
                            hover:bg-blue-50
                            dark:text-blue-400
                            dark:hover:bg-blue-950/40
                        "
                    >
                        <Pencil size={16} />

                        Edit
                    </button>
                )}
            </div>

            <div className="p-6">
                {children}
            </div>
        </section>
    );
};

export default ReviewSection;