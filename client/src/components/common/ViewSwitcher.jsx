import { useEffect, useRef, useState } from "react";

const SIZE_CLASSES = {
    sm: {
        container: "h-9 p-1",
        button: "px-3 py-6 text-xs",
        indicator: "rounded-md",
    },

    md: {
        container: "h-11 p-1",
        button: "px-4 py-2 text-[13px]",
        indicator: "rounded-lg",
    },

    lg: {
        container: "h-12 p-1",
        button: "px-5 py-2 text-sm",
        indicator: "rounded-lg",
    },
};

const VARIANT_CLASSES = {
    default: {
        indicator:
            "bg-blue-600 text-white",
        active:
            "text-white",
        inactive:
            "text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400",
    },
};

const ViewSwitcher = ({
    value,
    onChange,
    options = [],
    size = "md",
    variant = "default",
    fullWidth = false,
    equalWidth = true,
    disabled = false,
    className = "",
}) => {
    const containerRef = useRef(null);

    const [
        indicatorStyle,
        setIndicatorStyle,
    ] = useState({
        width: 0,
        left: 0,
    });

    const sizeStyle =
        SIZE_CLASSES[size] ??
        SIZE_CLASSES.md;

    const colors =
        VARIANT_CLASSES[variant] ??
        VARIANT_CLASSES.default;

    useEffect(() => {
        if (!containerRef.current) {
            return;
        }

        const activeIndex =
            options.findIndex(
                (option) =>
                    option.value === value
            );

        if (activeIndex < 0) {
            return;
        }

        const buttons =
            containerRef.current.querySelectorAll(
                "[data-view-option]"
            );

        const activeButton =
            buttons[activeIndex];

        if (!activeButton) {
            return;
        }

        setIndicatorStyle({
            width:
                activeButton.offsetWidth,
            left:
                activeButton.offsetLeft,
        });
    }, [value, options]);

    const handleKeyDown = (event) => {
        if (
            disabled ||
            options.length === 0
        ) {
            return;
        }

        const currentIndex =
            options.findIndex(
                (option) =>
                    option.value === value
            );

        if (
            event.key !== "ArrowLeft" &&
            event.key !== "ArrowRight"
        ) {
            return;
        }

        event.preventDefault();

        const direction =
            event.key === "ArrowRight"
                ? 1
                : -1;

        let nextIndex =
            currentIndex + direction;

        if (nextIndex < 0) {
            nextIndex =
                options.length - 1;
        }

        if (
            nextIndex >=
            options.length
        ) {
            nextIndex = 0;
        }

        while (
            options[nextIndex]?.disabled
        ) {
            nextIndex += direction;

            if (nextIndex < 0) {
                nextIndex =
                    options.length - 1;
            }

            if (
                nextIndex >=
                options.length
            ) {
                nextIndex = 0;
            }
        }

        onChange?.(
            options[nextIndex].value
        );
    };

    return (
        <div
            ref={containerRef}
            role="tablist"
            aria-label="View Switcher"
            onKeyDown={handleKeyDown}
            className={`
                relative
                inline-flex
                ${
                    fullWidth
                        ? "w-full"
                        : "w-fit"
                }
                overflow-hidden
                rounded-xl
                border
                border-gray-200
                bg-gray-100
                dark:border-gray-700
                dark:bg-gray-800
                ${sizeStyle.container}
                ${className}
            `}
        >
            <span
                className={`
                    absolute
                    top-1
                    bottom-1
                    z-0
                    shadow-md
                    transition-all
                    duration-500
                    [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]
                    ${sizeStyle.indicator}
                    ${colors.indicator}
                `}
                style={{
                    width:
                        indicatorStyle.width,
                    transform: `translateX(${indicatorStyle.left}px)`,
                }}
            />

            {options.map((option) => {
                const Icon = option.icon;

                const active =
                    value === option.value;

                return (
                    <button
                        key={option.value}
                        data-view-option
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={option.label}
                        disabled={
                            disabled ||
                            option.disabled
                        }
                        onClick={() =>
                            onChange?.(
                                option.value
                            )
                        }
                        className={`
                            relative
                            z-10
                            flex
                            ${
                                equalWidth
                                    ? "flex-1"
                                    : "flex-none shrink-0"
                            }
                            items-center
                            justify-center
                            gap-2
                            whitespace-nowrap
                            transform-gpu
                            transition-all
                            duration-500
                            [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]
                            focus:outline-none
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                            tracking-tight
                            ${sizeStyle.button}
                            ${
                                active
                                    ? `
                                        opacity-100
                                        font-semibold
                                        ${colors.active}
                                    `
                                    : `
                                        opacity-75
                                        font-medium
                                        ${colors.inactive}
                                    `
                            }
                        `}
                    >
                        {Icon && (
                            <Icon
                                size={
                                    size === "lg"
                                        ? 18
                                        : 16
                                }
                                className={`
                                    transition-all
                                    duration-500
                                    [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]
                                    ${
                                        active
                                            ? "scale-[1.10]"
                                            : "scale-[0.90]"
                                    }
                                `}
                            />
                        )}

                        <span
                            className={`
                                hidden
                                sm:inline
                                origin-center
                                transform-gpu
                                transition-all
                                duration-500
                                [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]
                                ${
                                    active
                                        ? `
                                            opacity-100
                                            scale-100
                                        `
                                        : `
                                            opacity-65
                                            scale-[0.90]
                                        `
                                }
                            `}
                        >
                            {option.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default ViewSwitcher;