const ExpandableCardContent = ({
    expanded = false,
    children,
    className = "",
}) => {
    return (
        <div
            className={`
                min-w-0
                ${className}
            `}
            data-expanded={expanded}
        >
            {children}
        </div>
    );
};

export default ExpandableCardContent;