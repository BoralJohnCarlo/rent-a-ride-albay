import { useEffect } from "react";

// Body scope also covers dialogs rendered through portals.
export default function useDashboardButtons() {
    useEffect(() => {
        document.body.classList.add("dashboard-scope");
        return () => document.body.classList.remove("dashboard-scope");
    }, []);
}
