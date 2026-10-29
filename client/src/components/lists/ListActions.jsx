const ListActions = ({
    children,
    className = "",
}) => {
    return (
        <div
            className={[
                "flex",
                "items-center",
                "justify-end",
                "gap-2",
                "shrink-0",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {children}
        </div>
    );
};

export default ListActions;