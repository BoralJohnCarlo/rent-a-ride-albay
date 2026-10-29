import { useState } from "react";

import { motion } from "framer-motion";

import NotificationBell from "./NotificationBell";
import UserMenu from "./UserMenu";

const SPRING = {
    type: "spring",
    stiffness: 200,
    damping: 30,
};

const NavbarActions = ({
    user,
    onLogout,
    isPublic = false,
    notificationPath = "/admin/notifications",
    pill = false,
    // Glass look while floating over the home hero (see useNavbarOverHero).
    overHero = false,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="flex items-center">
            <motion.div
                initial={false}
                animate={{
                    opacity: isHovered ? 0 : 1,
                }}
                transition={SPRING}
                className="mr-2"
            >
                <NotificationBell
                    navigateTo={notificationPath}
                    overHero={overHero}
                />
            </motion.div>
            <UserMenu
                user={user}
                onLogout={onLogout}
                isPublic={isPublic}
                notificationPath={notificationPath}
                onHoverChange={setIsHovered}
                pill={pill}
                overHero={overHero}
            />
        </div>
    );
};

export default NavbarActions;