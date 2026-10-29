import { useContext } from "react";

import SidebarContext from "./SidebarContext";

const useSidebar = () => {
    const context =
        useContext(
            SidebarContext
        );

    if (!context) {
        throw new Error(
            "useSidebar must be used within SidebarProvider."
        );
    }

    return context;
};

export default useSidebar;