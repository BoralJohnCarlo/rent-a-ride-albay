import clsx from "clsx";

const SIZE_VARIANTS = Object.freeze({
    SM: "text-2xl md:text-3xl",
    MD: "text-3xl md:text-4xl",
    LG: "text-4xl md:text-5xl",
});

const SectionTitle = ({
    as: Component = "h2",
    children,
    className,
    size = "MD",
    ...props
}) => {
    return (
        <Component
            className={clsx(
                "w-full text-center font-bold tracking-tight text-gray-900 dark:text-white",
                SIZE_VARIANTS[size] ??
                    SIZE_VARIANTS.MD,
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
};

export default SectionTitle;