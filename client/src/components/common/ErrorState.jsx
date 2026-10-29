import { AlertCircle } from "lucide-react";

const ErrorState = ({
    title = "Something went wrong",
    message = "We couldn't load the requested data.",
    className = "",
}) => {
    return (
        <div
            className={[
                "flex min-h-[280px] w-full items-center justify-center",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div className="flex max-w-md flex-col items-center px-6 text-center">
                <div
                    className="
                        flex
                        h-14
                        w-14
                        items-center
                        justify-center
                        rounded-full
                        bg-red-50
                        text-red-500
                        dark:bg-red-950/40
                        dark:text-red-400
                    "
                >
                    <AlertCircle size={28} />
                </div>

                <h2
                    className="
                        mt-4
                        text-base
                        font-semibold
                        text-gray-900
                        dark:text-white
                    "
                >
                    {title}
                </h2>

                <p
                    className="
                        mt-2
                        text-sm
                        leading-6
                        text-gray-500
                        dark:text-gray-400
                    "
                >
                    {message}
                </p>
            </div>
        </div>
    );
};

export default ErrorState;