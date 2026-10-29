import { motion } from "framer-motion";

import { useCallback, useState } from "react";

import CustomerTabBar from "./CustomerTabBar";
import { CUSTOMER_TAB_PATHS } from "./customerTabs";
import MenuSheetButton from "./MenuSheetButton";
import NotificationBell from "./NotificationBell";
import PublicLogo from "./PublicLogo";
import PublicNavbarShell from "./PublicNavbarShell";
import PublicNavLinks from "./PublicNavLinks";
import { getPillSurfaceClasses } from "./pillSurface";
import SiteMenuSheet from "./SiteMenuSheet";
import UserMenu from "./UserMenu";

import {
    customerNavigation,
    publicNavigation,
} from "../../config/navigation";

import useTheme from "../../hooks/theme/useTheme";
import useNavbarOverHero from "./useNavbarOverHero";
import useAuth from "../../hooks/auth/useAuth";

const NAV_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 18,
    mass: 0.55,
};

const CustomerNavbar = () => {
    const [
        isMobileMenuOpen,
        setIsMobileMenuOpen,
    ] = useState(false);

    const {
        user,
        logout,
        isAuthenticated,
    } = useAuth();

    const { isPillNavbar } = useTheme();

    // Shared with the bell, user menu and customer-service bubble so they
    // all switch from hero glass to their real colours together.
    const {
        isScrolled,
        overHero: shouldShowWhiteText,
    } = useNavbarOverHero("/customer/home");

    const closeMobileMenu = useCallback(
        () => setIsMobileMenuOpen(false),
        []
    );

    const navigationItems =
        publicNavigation
            .filter(
                (item) => item.enabled
            )
            .map((item) => ({
                ...item,
                path:
                    item.path === "/"
                        ? "/customer/home"
                        : item.path,
                end: true,
            }));

    if (
        isAuthenticated &&
        user?.role === "customer"
    ) {
        const customerItems =
            customerNavigation
                .filter(
                    (item) =>
                        item.path !==
                        "/customer/home"
                );

        navigationItems.splice(
            1,
            0,
            ...customerItems
        );
    }

    // The phone menu sheet: what the bottom tab bar doesn't already cover.
    const drawerItems = navigationItems.filter(
        (item) => !CUSTOMER_TAB_PATHS.has(item.path)
    );

    return (
        <>
            <PublicNavbarShell
                isPill={isPillNavbar}
                isScrolled={isScrolled}
            >
                    <div className="flex min-w-0 flex-1 items-center justify-start lg:justify-self-start">
                        <div
                            className={
                                isPillNavbar
                                    ? `flex h-12 min-w-0 items-center pl-2 pr-4 ${getPillSurfaceClasses(
                                          {
                                              overHero:
                                                  shouldShowWhiteText,
                                              isScrolled,
                                          }
                                      )}`
                                    : "flex min-w-0 items-center"
                            }
                        >
                        <motion.div
                            initial={{
                                opacity: 0,
                                x: -12,
                                scale: 0.96,
                            }}
                            animate={{
                                opacity: 1,
                                x: 0,
                                scale: 1,
                            }}
                            whileHover={{
                                y: -1,
                                scale: 1.015,
                            }}
                            whileTap={{
                                scale: 0.98,
                            }}
                            transition={{
                                ...NAV_SPRING,
                                delay: 0.05,
                            }}
                            className="
                                flex
                                shrink-0
                                items-center
                                justify-center
                            "
                        >
                            <PublicLogo
                                variant="LIGHT"
                                showTitle={false}
                                showSubtitle={false}
                                iconSize={30}
                            />
                        </motion.div>

                        <span
                            className={`
                                ml-2
                                whitespace-nowrap
                                ${isPillNavbar ? "truncate" : ""}
                                text-lg
                                font-extrabold
                                tracking-tight
                                text-gray-950
                                dark:text-white
                                ${
                                    shouldShowWhiteText
                                        ? "text-white"
                                        : ""
                                }
                            `}
                        >
                            Rent-A-Ride Albay
                        </span>
                        </div>
                    </div>

                    <PublicNavLinks
                        isPill={isPillNavbar}
                        items={navigationItems}
                        layoutIdPrefix="customer-navbar"
                        overHero={shouldShowWhiteText}
                        isScrolled={isScrolled}
                    />

                    {/* One cluster on every size: user menu (desktop) →
                        bell. The bell is a single instance (it polls + plays
                        the notification sound), always visible, and sits
                        rightmost on desktop so the user menu growing on hover
                        never pushes it. Phones open the menu from the bottom
                        tab bar instead. */}
                    <div
                        className="
                            pointer-events-auto
                            ml-auto
                            flex
                            min-w-0
                            items-center
                            justify-end
                            gap-2
                            lg:ml-0
                            lg:justify-self-end
                        "
                    >
                        <div className="hidden lg:block">
                            <UserMenu
                                user={user}
                                onLogout={logout}
                                notificationPath="/customer/notifications"
                                pill={isPillNavbar}
                                overHero={shouldShowWhiteText}
                            />
                        </div>

                        <NotificationBell
                            navigateTo="/customer/notifications"
                            overHero={shouldShowWhiteText}
                            sizeClassName={
                                isPillNavbar
                                    ? "h-12 w-12 lg:h-10 lg:w-10"
                                    : "h-10 w-10"
                            }
                        />

                        <MenuSheetButton
                            isOpen={isMobileMenuOpen}
                            onOpen={() => setIsMobileMenuOpen(true)}
                            className={`${
                                isPillNavbar ? "h-12 w-12" : "h-10 w-10"
                            } border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800`}
                        />
                    </div>
            </PublicNavbarShell>

            <CustomerTabBar
                isMenuOpen={isMobileMenuOpen}
                onOpenMenu={() =>
                    setIsMobileMenuOpen(true)
                }
            />

            <SiteMenuSheet
                open={isMobileMenuOpen}
                onClose={closeMobileMenu}
                variant="customer"
                links={drawerItems}
            />
        </>
    );
};

export default CustomerNavbar;
