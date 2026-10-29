import clsx from "clsx";

const ALIGNMENTS = Object.freeze({
    LEFT: "items-start text-left",
    CENTER: "items-center text-center",
    RIGHT: "items-end text-right",
});

const SectionHeader = ({
    children,
    className,
    alignment = "CENTER",
    ...props
}) => {
    return (
        <div
            className={clsx(
                "mb-12 flex w-full flex-col items-center gap-4 text-center",
                ALIGNMENTS[alignment] ??
                    ALIGNMENTS.CENTER,
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};

export default SectionHeader;