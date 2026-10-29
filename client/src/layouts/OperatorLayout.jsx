import { Settings, User } from "lucide-react";

import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import useAuth from "../hooks/auth/useAuth";
import useDashboardButtons from "../hooks/theme/useDashboardButtons";
import useMediaQuery from "../hooks/ui/useMediaQuery";
import { SidebarProvider } from "../providers/SidebarProvider";

import {
    ActivityDock,
    DashboardDrawerBrand,
    DashboardPageTransition,
    DashboardShell,
    MobileAccountDrawer,
    MobileHeaderActions,
    OperatorNavbar,
    OperatorSidebar,
} from "../components/layout";

import { operatorNavigation } from "../config/navigation";
import {
    getNavigationItem,
    getPageTitle,
} from "../config/navigationHelpers";
import {
    OPERATOR_SIDEBAR_SECTIONS,
    buildDockItems,
} from "../config/sidebarSections";

const NOTIFICATIONS_PATH = "/operator/notifications";

const DOCK_ITEMS = buildDockItems(
    operatorNavigation,
    OPERATOR_SIDEBAR_SECTIONS,
    "/operator"
);

const ACCOUNT_ROWS = [
    {
        icon: User,
        label: "My Profile",
        path: "/operator/profile",
    },
    {
        icon: Settings,
        label: "Settings",
        path: "/operator/settings",
    },
];

const OperatorLayout = () => {
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
                {isDesktop && <OperatorSidebar />}

                <DashboardShell
                    navbar={
                        <OperatorNavbar
                            title={getPageTitle(location.pathname)}
                            icon={
                                getNavigationItem(
                                    location.pathname
                                )?.icon
                            }
                            user={user}
                            onLogout={logout}
                            actions={
                                isDesktop ? undefined : (
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
                    roleLabel="Partner"
                    accent="blue"
                    accountRows={ACCOUNT_ROWS}
                    brand={<DashboardDrawerBrand />}
                />
            )}
        </SidebarProvider>
    );
};

export default OperatorLayout;
