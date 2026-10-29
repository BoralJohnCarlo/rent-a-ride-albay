const CardGrid = ({
    children,
    columns = "xl:grid-cols-4",
    className = "",
}) => {
    return (
        <div
            className={`
                grid
                grid-cols-1
                gap-6
                md:grid-cols-2
                ${columns}
                ${className}
            `}
        >
            {children}
        </div>
    );
};

export default CardGrid;