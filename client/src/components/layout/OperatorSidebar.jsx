import { motion } from "framer-motion";

import { operatorNavigation } from "../../config/navigation";
import {
    OPERATOR_SIDEBAR_SECTIONS,
    buildSidebarGroups,
} from "../../config/sidebarSections";
import { SIDEBAR_SPRING } from "../../constants/animations";

import useSidebar from "../../context/useSidebar";

import useActivityCounts from "../../hooks/dashboard/useActivityCounts";

import Logo from "./Logo";
import SidebarGrip from "./SidebarGrip";
import SidebarItem from "./SidebarItem";
import SidebarSection from "./SidebarSection";

const groups = buildSidebarGroups(
    operatorNavigation,
    OPERATOR_SIDEBAR_SECTIONS
);

let cursor = 0;
const orderedGroups = groups.map((group) => ({
    title: group.title,
    items: group.items.map((item) => ({
        ...item,
        order: cursor++,
    })),
}));

const OperatorSidebar = () => {
    const { collapsed } = useSidebar();
    const activityCounts = useActivityCounts();

    return (
        <div className="relative z-20 shrink-0">
            <motion.aside
                initial={{
                    opacity: 0,
                    x: -12,
                    width: collapsed ? 80 : 272,
                }}
                animate={{
                    width: collapsed ? 80 : 272,
                    opacity: 1,
                    x: 0,
                }}
                transition={{
                    width: SIDEBAR_SPRING,
                    x: SIDEBAR_SPRING,
                    opacity: { duration: 0.3 },
                }}
                className="
                    flex
                    h-screen
                    max-h-screen
                    flex-col
                    overflow-hidden
                    border-r
                    border-slate-200
                    bg-white
                    shadow-sm
                    dark:border-slate-800
                    dark:bg-slate-950
                "
            >
                <div className="shrink-0 px-4 pb-4 pt-5">
                    <Logo />
                </div>

                <div className="mx-4 shrink-0 border-t border-slate-200 dark:border-slate-800" />

                <nav className="scrollbar-hide flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
                    {orderedGroups.map((group, groupIndex) => (
                        <SidebarSection
                            key={group.title}
                            title={group.title}
                            first={groupIndex === 0}
                        >
                            {group.items.map((item) => (
                                <SidebarItem
                                    key={item.path}
                                    to={item.path}
                                    icon={item.icon}
                                    label={item.label}
                                    end={item.path === "/operator"}
                                    index={item.order}
                                    badgeCount={
                                        item.badgeKey
                                            ? activityCounts[
                                                  item.badgeKey
                                              ]
                                            : 0
                                    }
                                />
                            ))}
                        </SidebarSection>
                    ))}
                </nav>
            </motion.aside>

            <SidebarGrip />
        </div>
    );
};

export default OperatorSidebar;
