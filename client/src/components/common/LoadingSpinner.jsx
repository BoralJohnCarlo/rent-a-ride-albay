import { LoaderCircle } from "lucide-react";

const LoadingSpinner = ({
    message = "Loading...",
    fullScreen = true,
    size = 40,
}) => {
    const containerClass = fullScreen
        ? "flex min-h-screen items-center justify-center"
        : "flex items-center justify-center py-8";

    return (
        <div className={containerClass}>
            <div className="flex flex-col items-center gap-4">
                <LoaderCircle
                    size={size}
                    className="animate-spin text-blue-600 dark:text-blue-400"
                />

                {message && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        {message}
                    </p>
                )}
            </div>
        </div>
    );
};

export default LoadingSpinner;