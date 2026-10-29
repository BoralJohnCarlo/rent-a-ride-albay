import { useState } from "react";
import { ImageOff } from "lucide-react";

const sizes = {
    xs: "h-10 w-10",
    sm: "h-12 w-16",
    md: "h-16 w-24",
    lg: "h-24 w-32",
    xl: "h-32 w-48",
    full: "h-full w-full",
};

const roundedStyles = {
    none: "",
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
};

const ImageThumbnail = ({
    src,
    alt = "Image",
    size = "md",
    rounded = "lg",
    objectFit = "cover",
    loading = "lazy",
    className = "",
    onClick,
    ...props
}) => {
    const [hasError, setHasError] = useState(false);

    const baseClassName = [
        sizes[size] ?? sizes.md,
        roundedStyles[rounded] ?? roundedStyles.lg,
        "overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center",
        onClick ? "cursor-pointer" : "",
        className,
    ]
        .filter(Boolean)
        .join(" ");

    if (!src || hasError) {
        return (
            <div
                className={baseClassName}
                onClick={onClick}
                role={onClick ? "button" : undefined}
                tabIndex={onClick ? 0 : undefined}
            >
                <ImageOff
                    size={24}
                    className="text-gray-400 dark:text-gray-500"
                />
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            loading={loading}
            draggable={false}
            onClick={onClick}
            onError={() => setHasError(true)}
            className={[
                sizes[size] ?? sizes.md,
                roundedStyles[rounded] ??
                    roundedStyles.lg,
                objectFit === "contain"
                    ? "object-contain"
                    : "object-cover",
                onClick ? "cursor-pointer" : "",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
            {...props}
        />
    );
};

export default ImageThumbnail;