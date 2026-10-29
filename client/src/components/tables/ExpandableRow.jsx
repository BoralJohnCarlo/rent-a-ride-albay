import { ChevronDown } from "lucide-react";

const ExpandableRow = ({
    expanded = false,
    colSpan = 1,
    onToggle,
    children,
}) => {
    return (
        <>
            <tr
                className="
                    cursor-pointer
                    border-b
                    border-gray-200
                    transition-colors
                    hover:bg-gray-50
                    dark:border-gray-700
                    dark:hover:bg-gray-800/60
                "
                onClick={onToggle}
            >
                <td
                    className="
                        w-12
                        px-4
                        py-4
                        align-middle
                    "
                >
                    <ChevronDown
                        size={18}
                        className={[
                            "transition-transform duration-200 text-gray-500 dark:text-gray-400",
                            expanded
                                ? "rotate-180"
                                : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    />
                </td>

                {children[0]}
            </tr>

            {expanded && (
                <tr className="bg-gray-50 dark:bg-gray-800/60">
                    <td />

                    <td
                        colSpan={colSpan}
                        className="p-6"
                    >
                        {children[1]}
                    </td>
                </tr>
            )}
        </>
    );
};

export default ExpandableRow;