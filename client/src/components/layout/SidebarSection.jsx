import { AnimatePresence, motion } from "framer-motion";

import useSidebar from "../../context/useSidebar";

const SidebarSection = ({ title, children, first = false }) => {
    const { collapsed } = useSidebar();

    return (
        <section className="space-y-1">
            {collapsed && !first && (
                <div className="mx-auto my-2 h-px w-8 bg-slate-200 dark:bg-slate-800" />
            )}

            <AnimatePresence initial={false}>
                {!collapsed && title && (
                    <motion.h2
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{
                            type: "spring",
                            stiffness: 500,
                            damping: 30,
                        }}
                        className={`px-4 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500 ${
                            first ? "pt-1" : "pt-4"
                        }`}
                    >
                        {title}
                    </motion.h2>
                )}
            </AnimatePresence>

            <div className="space-y-1">{children}</div>
        </section>
    );
};

export default SidebarSection;
