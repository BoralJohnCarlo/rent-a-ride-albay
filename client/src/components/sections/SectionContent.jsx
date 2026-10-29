import clsx from "clsx";

const SectionContent = ({
    as: Component = "div",
    children,
    className,
    ...props
}) => {
    return (
        <Component
            className={clsx(
                "w-full",
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
};

export default SectionContent;