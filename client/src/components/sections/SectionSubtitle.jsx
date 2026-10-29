import clsx from "clsx";

const SIZE_VARIANTS = Object.freeze({
    SM: "text-sm md:text-base",
    MD: "text-base md:text-lg",
    LG: "text-lg md:text-xl",
});

const WIDTH_VARIANTS = Object.freeze({
    SM: "max-w-2xl",
    MD: "max-w-3xl",
    LG: "max-w-4xl",
    FULL: "max-w-none",
});

const SectionSubtitle = ({
    as: Component = "p",
    children,
    className,
    size = "MD",
    width = "MD",
    ...props
}) => {
    return (
        <Component
            className={clsx(
                "w-full text-center leading-relaxed text-gray-600 dark:text-gray-300",
                SIZE_VARIANTS[size] ??
                    SIZE_VARIANTS.MD,
                WIDTH_VARIANTS[width] ??
                    WIDTH_VARIANTS.MD,
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
};

export default SectionSubtitle;