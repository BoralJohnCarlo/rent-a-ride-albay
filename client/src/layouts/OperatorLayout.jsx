import { Outlet, useLocation } from "react-router-dom";

import PageTransition from "../components/common/PageTransition";

import useAuth from "../hooks/auth/useAuth";
import { SidebarProvider } from "../providers/SidebarProvider";

import {
    DashboardShell,
    OperatorNavbar,
    OperatorSidebar,
} from "../components/layout";

import {
    getPageTitle,
} from "../config/navigationHelpers";

const OperatorLayout = () => {
    const location = useLocation();

    const {
        user,
        logout,
    } = useAuth();

    return (
        <SidebarProvider>
            <div className="flex min-h-screen bg-gray-100">
                <OperatorSidebar />

                <DashboardShell
                    navbar={
                        <OperatorNavbar
                            title={getPageTitle(location.pathname)}
                            user={user}
                            onLogout={logout}
                        />
                    }

                >
                    <PageTransition>
                        <Outlet />
                    </PageTransition>
                </DashboardShell>
            </div>
        </SidebarProvider>
    );
};

export default OperatorLayout;