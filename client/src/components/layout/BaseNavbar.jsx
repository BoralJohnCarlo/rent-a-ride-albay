import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";

import { DEFAULT_SPRING } from "../../constants/animations";

const BaseNavbar = ({
    title,
    subtitle,
    icon: Icon,
    onMenuClick,
    actions,
}) => {
    return (
        <header className="relative flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 transition-colors duration-200 dark:border-gray-800 dark:bg-gray-950 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
                {onMenuClick && (
                    <motion.button
                        type="button"
                        onClick={onMenuClick}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.92 }}
                        transition={DEFAULT_SPRING}
                        className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </motion.button>
                )}

                {Icon && (
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={title}
                            initial={{
                                scale: 0.5,
                                opacity: 0,
                                rotate: -15,
                            }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                rotate: 0,
                            }}
                            exit={{
                                scale: 0.5,
                                opacity: 0,
                            }}
                            transition={DEFAULT_SPRING}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                        >
                            <Icon size={19} />
                        </motion.div>
                    </AnimatePresence>
                )}

                <div className="flex min-w-0 flex-col justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.h1
                            key={title}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{
                                duration: 0.18,
                                ease: "easeOut",
                            }}
                            className="truncate text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
                        >
                            {title}
                        </motion.h1>
                    </AnimatePresence>

                    {subtitle && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>

            {actions && (
                <div className="ml-4 flex shrink-0 items-center">
                    {actions}
                </div>
            )}

            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"
            />
        </header>
    );
};

export default BaseNavbar;
