import { Settings } from "lucide-react";

import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import useAuth from "../hooks/auth/useAuth";
import useDashboardButtons from "../hooks/theme/useDashboardButtons";
import useMediaQuery from "../hooks/ui/useMediaQuery";
import { SidebarProvider } from "../providers/SidebarProvider";

import {
    ActivityDock,
    AdminNavbar,
    AdminSidebar,
    DashboardDrawerBrand,
    DashboardPageTransition,
    DashboardShell,
    MobileAccountDrawer,
    MobileHeaderActions,
    TopbarActions,
} from "../components/layout";

import { adminNavigation } from "../config/navigation";
import {
    getNavigationItem,
    getPageTitle,
} from "../config/navigationHelpers";
import {
    ADMIN_SIDEBAR_SECTIONS,
    buildDockItems,
} from "../config/sidebarSections";

const NOTIFICATIONS_PATH = "/admin/notifications";

const DOCK_ITEMS = buildDockItems(
    adminNavigation,
    ADMIN_SIDEBAR_SECTIONS,
    "/admin"
);

const ACCOUNT_ROWS = [
    {
        icon: Settings,
        label: "Settings",
        path: "/admin/settings",
    },
];

const AdminLayout = () => {
    useDashboardButtons();
    const location = useLocation();

    const {
        user,
        logout,
    } = useAuth();

    // Decides what's mounted, not just shown: the bell and the badge counts
    // poll, so a hidden desktop copy alongside the phone one would double up.
    const isDesktop = useMediaQuery("(min-width: 64rem)");

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <SidebarProvider>
            <div className="flex h-dvh overflow-hidden bg-gray-50 dark:bg-gray-950">
                {isDesktop && <AdminSidebar />}

                <DashboardShell
                    navbar={
                        <AdminNavbar
                            title={getPageTitle(location.pathname)}
                            icon={
                                getNavigationItem(
                                    location.pathname
                                )?.icon
                            }
                            actions={
                                isDesktop ? null : (
                                    <MobileHeaderActions
                                        user={user}
                                        notificationPath={NOTIFICATIONS_PATH}
                                        isMenuOpen={isMenuOpen}
                                        onOpenMenu={() =>
                                            setIsMenuOpen(true)
                                        }
                                    />
                                )
                            }
                        />
                    }

                    topbar={
                        isDesktop && (
                            <TopbarActions
                                user={user}
                                onLogout={logout}
                            />
                        )
                    }

                    bottomBar={
                        !isDesktop && (
                            <ActivityDock items={DOCK_ITEMS} />
                        )
                    }
                >
                    <DashboardPageTransition>
                        <Outlet />
                    </DashboardPageTransition>
                </DashboardShell>
            </div>

            {!isDesktop && (
                <MobileAccountDrawer
                    open={isMenuOpen}
                    onClose={() => setIsMenuOpen(false)}
                    roleLabel="Admin"
                    accent="blue"
                    accountRows={ACCOUNT_ROWS}
                    brand={<DashboardDrawerBrand />}
                />
            )}
        </SidebarProvider>
    );
};

export default AdminLayout;
