import { useRef, useState } from "react";

import { LoaderCircle } from "lucide-react";

const variants = {
    primary:
        "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",

    secondary:
        "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-400 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-gray-500",

    outline:
        "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 focus:ring-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800 dark:focus:ring-gray-500",

    danger:
        "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",

    success:
        "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",

    /*
     * Was missing entirely — every Button using variant="warning" (Request
     * Revision, among others) fell through to `variants[variant]` being
     * undefined, so no background/text color classes applied at all. That
     * left the button rendering as plain unstyled text, worst of all in
     * dark mode where the inherited text color reads as barely visible.
     */
    warning:
        "bg-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500",

    brand:
        "bg-yellow-500 text-black hover:bg-yellow-400 focus:ring-yellow-400",

    ghost:
        "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-400 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:ring-gray-500",

    dark:
        "bg-gray-900 text-white hover:bg-black focus:ring-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white dark:focus:ring-gray-400",
};

const sizes = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-3 text-base",
    lg: "px-6 py-4 text-lg",
};

const Button = ({
    children,
    type = "button",
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    className = "",
    onPointerDown,
    ...props
}) => {
    const isDisabled = loading || disabled;

    const [ripples, setRipples] = useState([]);
    const nextRippleId = useRef(0);

    const handlePointerDown = (event) => {
        // Only the primary mouse button / a touch or pen contact — not a
        // right-click opening a context menu.
        if (isDisabled || event.button !== 0) {
            onPointerDown?.(event);
            return;
        }

        const rect =
            event.currentTarget.getBoundingClientRect();

        // Oversized so it always fully covers the button regardless of
        // where within it the ripple started.
        const diameter =
            Math.max(rect.width, rect.height) * 2;

        const ripple = {
            id: nextRippleId.current++,
            size: diameter,
            x: event.clientX - rect.left - diameter / 2,
            y: event.clientY - rect.top - diameter / 2,
        };

        setRipples((previous) => [
            ...previous,
            ripple,
        ]);

        onPointerDown?.(event);
    };

    const removeRipple = (id) => {
        setRipples((previous) =>
            previous.filter(
                (ripple) => ripple.id !== id
            )
        );
    };

    return (
        <button
            type={type}
            disabled={isDisabled}
            onPointerDown={handlePointerDown}
            className={`
                relative
                inline-flex
                items-center
                justify-center
                gap-2
                overflow-hidden
                rounded-lg
                font-medium
                transition-all
                duration-200
                focus:outline-none
                focus:ring-2
                disabled:cursor-not-allowed
                disabled:opacity-50
                ${variants[variant]}
                ${variant === "primary" ? "dashboard-primary-button" : ""}
                ${sizes[size]}
                ${fullWidth ? "w-full" : ""}
                ${className}
            `}
            {...props}
        >
            {ripples.map((ripple) => (
                <span
                    key={ripple.id}
                    onAnimationEnd={() =>
                        removeRipple(ripple.id)
                    }
                    className="animate-ripple pointer-events-none absolute rounded-full bg-current"
                    style={{
                        width: ripple.size,
                        height: ripple.size,
                        left: ripple.x,
                        top: ripple.y,
                    }}
                />
            ))}

            {loading ? (
                <>
                    <LoaderCircle
                        size={18}
                        className="animate-spin"
                    />

                    <span>Loading...</span>
                </>
            ) : (
                <>
                    {leftIcon}

                    <span>{children}</span>

                    {rightIcon}
                </>
            )}
        </button>
    );
};

export default Button;
