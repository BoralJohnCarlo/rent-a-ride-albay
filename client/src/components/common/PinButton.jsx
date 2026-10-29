import { Pin } from "lucide-react";

const PinButton = ({
    pinned = false,
    disabled = false,
    onClick,
    className = "",
}) => {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            aria-label={
                pinned
                    ? "Unpin item"
                    : "Pin item"
            }
            title={
                pinned
                    ? "Unpin"
                    : "Pin"
            }
            className={[
                "inline-flex",
                "h-9",
                "w-9",
                "items-center",
                "justify-center",
                "rounded-lg",
                "border",
                "transition-all",
                "duration-200",
                "focus:outline-none",
                "focus:ring-2",
                "disabled:cursor-not-allowed",
                "disabled:opacity-50",

                pinned
                    ? [
                          "border-amber-300",
                          "bg-amber-100",
                          "text-amber-600",
                          "hover:bg-amber-200",
                          "focus:ring-amber-400",
                      ].join(" ")
                    : [
                          "border-gray-200",
                          "bg-white",
                          "text-gray-500",
                          "hover:bg-gray-100",
                          "hover:text-gray-700",
                          "focus:ring-gray-400",
                          "dark:border-gray-700",
                          "dark:bg-gray-900",
                          "dark:text-gray-400",
                          "dark:hover:bg-gray-800",
                          "dark:hover:text-gray-200",
                          "dark:focus:ring-gray-600",
                      ].join(" "),

                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <Pin
                size={16}
                className={
                    pinned
                        ? "fill-current"
                        : ""
                }
            />
        </button>
    );
};

export default PinButton;