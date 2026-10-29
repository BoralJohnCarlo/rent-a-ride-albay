import {
    Children,
    cloneElement,
    isValidElement,
} from "react";
import { ChevronDown } from "lucide-react";

const ExpandableCard = ({
    expanded = false,
    onToggle,
    disabled = false,
    children,
    className = "",
}) => {
    const childArray =
        Children.toArray(children);

    const enhancedChildren =
        childArray.map((child) => {
            if (!isValidElement(child)) {
                return child;
            }

            return cloneElement(child, {
                expanded,
            });
        });

    const handleToggle = () => {
        if (disabled) {
            return;
        }

        onToggle?.();
    };

    const handleKeyDown = (
        event
    ) => {
        if (disabled) {
            return;
        }

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {
            event.preventDefault();
            handleToggle();
        }
    };

    return (
        <div
            className={[
                "overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900 shadow-sm transition-all duration-200 hover:shadow-md",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <div
                role="button"
                tabIndex={
                    disabled ? -1 : 0
                }
                aria-expanded={expanded}
                aria-disabled={disabled}
                onClick={handleToggle}
                onKeyDown={
                    handleKeyDown
                }
                className={[
                    "flex items-start gap-4 p-5 transition-colors duration-200 select-none",
                    disabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <ChevronDown
                    size={20}
                    className={[
                        "mt-1 shrink-0 text-gray-500 transition-transform duration-200 dark:text-gray-400",
                        expanded
                            ? "rotate-180"
                            : "",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                />

                <div className="min-w-0 flex-1">
                    {
                        enhancedChildren[0]
                    }
                </div>
            </div>

            <div
                className={[
                    "grid transition-all duration-300 ease-in-out",
                    expanded
                        ? "grid-rows-[1fr]"
                        : "grid-rows-[0fr]",
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <div className="overflow-hidden">
                    <div className="border-t border-gray-100 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-800/40">
                        {
                            enhancedChildren[1]
                        }
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ExpandableCard;