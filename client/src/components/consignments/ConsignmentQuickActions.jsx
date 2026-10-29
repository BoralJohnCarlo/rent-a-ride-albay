import {
    ArrowRight,
    FilePlus2,
    FolderOpen,
} from "lucide-react";

const defaultActions = [
    {
        key: "new-consignment",
        label: "Submit New Consignment",
        description:
            "Register a new vehicle for review and approval.",
        icon: FilePlus2,
    },
    {
        key: "view-consignments",
        label: "View My Consignments",
        description:
            "Review and manage your submitted applications.",
        icon: FolderOpen,
    },
];

const ConsignmentQuickActions = ({
    actions = defaultActions,
    className = "",
    title = "Quick Actions",
    description = "Frequently used consignment shortcuts.",
    onActionClick,
}) => {
    return (
        <section
            className={`
                rounded-xl
                border
                border-gray-200
                bg-white
                p-5
                shadow-sm
                dark:border-gray-800
                dark:bg-gray-900
                ${className}
            `}
        >
            <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {title}
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {description}
                </p>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
                {actions.map((action) => {
                    const Icon = action.icon;

                    return (
                        <button
                            key={action.key}
                            type="button"
                            onClick={() =>
                                onActionClick?.(
                                    action.key
                                )
                            }
                            className="
                                group
                                flex
                                items-center
                                justify-between
                                rounded-xl
                                border
                                border-gray-200
                                bg-white
                                p-5
                                text-left
                                transition
                                hover:-translate-y-0.5
                                hover:border-primary-200
                                hover:shadow-md
                                dark:border-gray-800
                                dark:bg-gray-900
                                dark:hover:border-gray-600
                            "
                        >
                            <div className="flex items-start gap-4">
                                <div
                                    className="
                                        flex
                                        h-12
                                        w-12
                                        items-center
                                        justify-center
                                        rounded-xl
                                        bg-blue-50
                                        text-blue-600
                                        dark:bg-blue-950/40
                                        dark:text-blue-400
                                    "
                                >
                                    <Icon size={22} />
                                </div>

                                <div>
                                    <h3 className="font-semibold text-gray-900 dark:text-white">
                                        {action.label}
                                    </h3>

                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        {
                                            action.description
                                        }
                                    </p>
                                </div>
                            </div>

                            <ArrowRight
                                size={20}
                                className="
                                    text-gray-400
                                    transition-transform
                                    group-hover:translate-x-1
                                    dark:text-gray-500
                                "
                            />
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

export default ConsignmentQuickActions;