import { User } from "lucide-react";

const sizes = {
    xs: "h-8 w-8 text-xs",
    sm: "h-10 w-10 text-sm",
    md: "h-12 w-12 text-base",
    lg: "h-16 w-16 text-lg",
    xl: "h-20 w-20 text-xl",
};

const indicatorSizes = {
    xs: "h-2 w-2",
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
    lg: "h-4 w-4",
    xl: "h-5 w-5",
};

const Avatar = ({
    src,
    name = "",
    size = "md",
    rounded = true,
    showStatus = false,
    online = false,
    className = "",
    ...props
}) => {
    const initials = name
        .trim()
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((word) =>
            word.charAt(0).toUpperCase()
        )
        .join("");

    return (
        <div className="relative inline-flex">
            <div
                className={[
                    "flex items-center justify-center overflow-hidden bg-gray-200 font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200",
                    sizes[size] ?? sizes.md,
                    rounded
                        ? "rounded-full"
                        : "rounded-lg",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                {src ? (
                    <img
                        src={src}
                        alt={name || "Avatar"}
                        loading="lazy"
                        draggable={false}
                        className="h-full w-full object-cover"
                        {...props}
                    />
                ) : initials ? (
                    <span aria-label={name}>
                        {initials}
                    </span>
                ) : (
                    <User
                        size={20}
                        aria-hidden="true"
                    />
                )}
            </div>

            {showStatus && (
                <span
                    className={[
                        "absolute bottom-0 right-0 rounded-full border-2 border-white dark:border-gray-900",
                        indicatorSizes[size] ??
                            indicatorSizes.md,
                        online
                            ? "bg-green-500"
                            : "bg-gray-400",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                />
            )}
        </div>
    );
};

export default Avatar;