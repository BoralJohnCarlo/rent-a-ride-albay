import { motion } from "framer-motion";
import { CircleUserRound } from "lucide-react";

import NotificationBell from "./NotificationBell";

/**
 * Dashboard top-bar actions below lg: the (single) notification bell and an
 * initials avatar that opens the account drawer.
 */
const MobileHeaderActions = ({
    user,
    notificationPath,
    isMenuOpen,
    onOpenMenu,
}) => {
    const initials = [user?.firstName, user?.lastName]
        .filter(Boolean)
        .map((name) => name.charAt(0).toUpperCase())
        .join("");

    return (
        <div className="flex items-center gap-2">
            <NotificationBell navigateTo={notificationPath} />

            <motion.button
                type="button"
                onClick={onOpenMenu}
                whileTap={{ scale: 0.92 }}
                aria-label="Open account menu"
                aria-expanded={isMenuOpen}
                className="
                    flex
                    h-10
                    w-10
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-blue-600
                    text-sm
                    font-bold
                    text-white
                    shadow-sm
                    shadow-blue-600/30
                    ring-2
                    ring-white
                    transition-colors
                    hover:bg-blue-700
                    dark:ring-gray-950
                "
            >
                {initials || <CircleUserRound size={20} />}
            </motion.button>
        </div>
    );
};

export default MobileHeaderActions;
