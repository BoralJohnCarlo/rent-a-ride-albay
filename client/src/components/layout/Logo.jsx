import { AnimatePresence, motion } from "framer-motion";

import logo from "../../assets/logos/logo.png";

import { SIDEBAR_SPRING } from "../../constants/animations";

import useSidebar from "../../context/useSidebar";

const Logo = ({ title = "Rent-A-Ride Albay" }) => {
    const { collapsed } = useSidebar();

    return (
        <div
            className={`flex items-center gap-3 ${
                collapsed ? "justify-center" : ""
            }`}
        >
            <motion.img
                src={logo}
                alt={title}
                animate={{ width: collapsed ? 40 : 44 }}
                transition={SIDEBAR_SPRING}
                className="aspect-square shrink-0 rounded-full object-contain"
            />

            <AnimatePresence initial={false}>
                {!collapsed && (
                    <motion.h1
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{
                            type: "spring",
                            stiffness: 480,
                            damping: 30,
                        }}
                        className="truncate text-[15px] font-bold leading-tight text-slate-900 dark:text-white"
                    >
                        {title}
                    </motion.h1>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Logo;
