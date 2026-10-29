const FilterGroup = ({
    children,
    className = "",
}) => {
    return (
        <div
            className={[
                "space-y-2",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </div>
    );
};

export default FilterGroup;