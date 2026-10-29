import clsx from "clsx";

const SPACING_VARIANTS = Object.freeze({
    NONE: "",
    SM: "py-8",
    MD: "py-12",
    LG: "py-16",
    XL: "py-20",
    "2XL": "py-24",
});

const Section = ({
    as: Component = "section",
    children,
    className,
    id,
    spacing = "XL",
    ...props
}) => {
    return (
        <Component
            id={id}
            className={clsx(
                SPACING_VARIANTS[spacing] ??
                    SPACING_VARIANTS.XL,
                className
            )}
            {...props}
        >
            {children}
        </Component>
    );
};

export default Section;