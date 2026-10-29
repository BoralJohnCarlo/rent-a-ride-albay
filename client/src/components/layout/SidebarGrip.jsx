import { motion } from "framer-motion";

import useSidebar from "../../context/useSidebar";

/**
 * The pull tab on the sidebar's right edge. Reads as a piece of the panel
 * bulging out (shared surface + border, seam merged on the left), while the
 * grip lines and hover accent keep it obviously clickable.
 */
const SidebarGrip = () => {
    const { collapsed, toggleSidebar } = useSidebar();

    return (
        <div className="absolute right-0 top-1/2 z-30 -translate-y-1/2 translate-x-full">
            <motion.button
                type="button"
                onClick={toggleSidebar}
                aria-label={
                    collapsed ? "Open sidebar" : "Close sidebar"
                }
                title={
                    collapsed ? "Open sidebar" : "Close sidebar"
                }
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                    delay: 0.15,
                    type: "spring",
                    stiffness: 380,
                    damping: 22,
                }}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.93 }}
                className="
                    group flex h-16 w-5 items-center justify-center
                    rounded-r-xl border border-l-0 border-slate-200 bg-white
                    text-slate-300
                    shadow-[3px_0_10px_-4px_rgba(15,23,42,0.18)]
                    transition-colors duration-200
                    hover:bg-blue-50 hover:text-blue-500
                    dark:border-slate-800 dark:bg-slate-950 dark:text-slate-600
                    dark:hover:bg-blue-500/10 dark:hover:text-blue-400
                "
            >
                <span className="flex gap-1">
                    <span className="h-5 w-0.5 rounded-full bg-current transition-all duration-200 group-hover:h-6" />
                    <span className="h-5 w-0.5 rounded-full bg-current transition-all duration-200 group-hover:h-6" />
                </span>
            </motion.button>
        </div>
    );
};

export default SidebarGrip;
