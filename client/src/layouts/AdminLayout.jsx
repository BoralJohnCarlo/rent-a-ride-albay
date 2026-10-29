import { Outlet, useLocation } from "react-router-dom";

import PageTransition from "../components/common/PageTransition";

import useAuth from "../hooks/auth/useAuth";
import { SidebarProvider } from "../providers/SidebarProvider";

import {
    AdminNavbar,
    AdminSidebar,
    DashboardShell,
    TopbarActions,
} from "../components/layout";

import { getPageTitle } from "../config/navigationHelpers";

const AdminLayout = () => {
    const location = useLocation();

    const {
        user,
        logout,
    } = useAuth();

    return (
        <SidebarProvider>
            <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-950">
                <AdminSidebar />

                <DashboardShell
                    navbar={
                        <AdminNavbar
                            title={getPageTitle(location.pathname)}
                        />
                    }

                    topbar={
                        <TopbarActions
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

export default AdminLayout;