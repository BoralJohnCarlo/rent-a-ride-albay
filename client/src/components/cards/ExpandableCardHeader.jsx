const ExpandableCardHeader = ({
    expanded = false,
    children,
    className = "",
}) => {
    return (
        <div
            className={`
                flex
                min-w-0
                flex-1
                items-start
                justify-between
                gap-4
                ${className}
            `}
            data-expanded={expanded}
        >
            {children}
        </div>
    );
};

export default ExpandableCardHeader;