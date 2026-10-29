import clsx from "clsx";

const PageContainer = ({
    as: Component = "div",
    children,
    className,
    ...props
}) => {
    return (
        <Component
            className={clsx(
                "mx-auto flex w-full max-w-7xl flex-col px-4 sm:px-6 lg:px-8",
                    className
            )}
            {...props}
        >
            {children}
        </Component>
    );
};

export default PageContainer;