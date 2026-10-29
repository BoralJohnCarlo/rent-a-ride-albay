import {
    useEffect,
    useMemo,
    useState,
} from "react";

import SidebarContext from "../context/SidebarContext";

const STORAGE_KEY =
    "admin-sidebar-collapsed";

export const SidebarProvider = ({
    children,
}) => {
    const [
        collapsed,
        setCollapsed,
    ] = useState(() => {
        return (
            localStorage.getItem(
                STORAGE_KEY
            ) === "true"
        );
    });

    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY,
            collapsed
        );
    }, [collapsed]);

    const toggleSidebar = () => {
        setCollapsed(
            (previous) => !previous
        );
    };

    const expandSidebar = () => {
        setCollapsed(false);
    };

    const collapseSidebar = () => {
        setCollapsed(true);
    };

    const value = useMemo(
        () => ({
            collapsed,
            toggleSidebar,
            expandSidebar,
            collapseSidebar,
        }),
        [collapsed]
    );

    return (
        <SidebarContext.Provider
            value={value}
        >
            {children}
        </SidebarContext.Provider>
    );
};
