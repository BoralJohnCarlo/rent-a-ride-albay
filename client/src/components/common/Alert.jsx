import {
    AlertCircle,
    CheckCircle2,
    Info,
    TriangleAlert,
    X,
} from "lucide-react";

const variants = {
    success: {
        container:
            "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400",
        icon: CheckCircle2,
    },

    error: {
        container:
            "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400",
        icon: AlertCircle,
    },

    warning: {
        container:
            "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400",
        icon: TriangleAlert,
    },

    info: {
        container:
            "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
        icon: Info,
    },
};

const Alert = ({
    variant = "info",
    title,
    message,
    dismissible = false,
    onDismiss,
    className = "",
}) => {
    if (!message) {
        return null;
    }

    const selected =
        variants[variant] || variants.info;

    const Icon = selected.icon;

    return (
        <div
            role="alert"
            className={`
                flex
                items-start
                gap-3
                rounded-lg
                border
                px-4
                py-3
                ${selected.container}
                ${className}
            `}
        >
            <Icon
                size={20}
                className="mt-0.5 shrink-0"
            />

            <div className="flex-1">
                {title && (
                    <h4 className="mb-1 font-semibold">
                        {title}
                    </h4>
                )}

                <p className="text-sm">
                    {message}
                </p>
            </div>

            {dismissible && (
                <button
                    type="button"
                    onClick={onDismiss}
                    className="
                        transition-opacity
                        hover:opacity-70
                    "
                    aria-label="Close alert"
                >
                    <X size={18} />
                </button>
            )}
        </div>
    );
};

export default Alert;