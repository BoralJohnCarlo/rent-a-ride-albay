import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

const ListItem = ({
    expanded = false,
    onToggle,
    header,
    children,
    className = "",
}) => {
    const handleKeyDown = (event) => {
        if (
            event.key === "Enter" ||
            event.key === " "
        ) {
            event.preventDefault();
            onToggle?.();
        }
    };

    return (
        <motion.div
            layout
            transition={{
                type: "spring",
                stiffness: 420,
                damping: 32,
            }}
            className={[
                "overflow-hidden",
                "rounded-xl",
                "border",
                "border-gray-200",
                "bg-white",
                "dark:border-gray-800",
                "dark:bg-gray-900",
                "shadow-sm",
                className,
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <motion.div
                role="button"
                tabIndex={0}
                onClick={onToggle}
                onKeyDown={handleKeyDown}
                className="
                    flex
                    w-full
                    cursor-pointer
                    items-center
                    justify-between
                    gap-4
                    p-4
                    text-left
                    transition-colors
                    duration-200
                    hover:bg-gray-50
                    dark:hover:bg-gray-800/50
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-blue-500
                    focus-visible:ring-offset-2
                "
            >
                <div className="min-w-0 flex-1">
                    {header}
                </div>

                <motion.div
                    animate={{
                        rotate: expanded ? 180 : 0,
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 30,
                    }}
                    className="shrink-0"
                >
                    <ChevronDown size={20} />
                </motion.div>
            </motion.div>

            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        layout
                        initial={{
                            height: 0,
                            opacity: 0,
                            scaleY: 0.98,
                        }}
                        animate={{
                            height: "auto",
                            opacity: 1,
                            scaleY: 1,
                        }}
                        exit={{
                            height: 0,
                            opacity: 0,
                            scaleY: 0.98,
                        }}
                        transition={{
                            layout: {
                                type: "spring",
                                stiffness: 420,
                                damping: 32,
                            },
                            opacity: {
                                duration: 0.18,
                            },
                        }}
                        className="origin-top overflow-hidden"
                    >
                        <motion.div
                            layout
                            transition={{
                                type: "spring",
                                stiffness: 420,
                                damping: 32,
                            }}
                            className="border-t border-gray-100 p-4 dark:border-gray-800"
                        >
                            {children}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default ListItem;