import {
    useCallback,
    useEffect,
    useState,
} from "react";

import { motion } from "framer-motion";

import { useLocation } from "react-router-dom";

import CustomerTabBar from "./CustomerTabBar";
import {
    GUEST_TABS,
    GUEST_TAB_PATHS,
} from "./customerTabs";
import MenuSheetButton from "./MenuSheetButton";
import PublicLogo from "./PublicLogo";
import PublicNavbarShell from "./PublicNavbarShell";
import PublicNavLinks from "./PublicNavLinks";
import { getPillSurfaceClasses } from "./pillSurface";
import SiteMenuSheet from "./SiteMenuSheet";
import UserMenu from "./UserMenu";

import {
    publicNavigation,
} from "../../config/publicNavigation";

import useTheme from "../../hooks/theme/useTheme";

const NAV_SPRING = {
    type: "spring",
    stiffness: 420,
    damping: 18,
    mass: 0.55,
};

const PublicNavbar = () => {
    const [isScrolled, setIsScrolled] =
        useState(false);

    const [
        isMobileMenuOpen,
        setIsMobileMenuOpen,
    ] = useState(false);

    const { isPillNavbar } = useTheme();

    const location = useLocation();

    const isHomePage =
        location.pathname === "/";

    const isAuthPage =
        location.pathname.startsWith("/login") ||
        location.pathname.startsWith("/register");

    // The hero video and the auth pages' backdrop are always dark, so the
    // glass-over-image treatment applies in every colour theme.
    const shouldShowWhiteText =
        (isHomePage || isAuthPage) &&
        !isScrolled;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(
                window.scrollY > 24
            );
        };

        handleScroll();

        window.addEventListener(
            "scroll",
            handleScroll
        );

        return () =>
            window.removeEventListener(
                "scroll",
                handleScroll
            );
    }, []);

    const closeMobileMenu = useCallback(
        () => setIsMobileMenuOpen(false),
        []
    );

    const navigationItems =
        publicNavigation.filter(
            (item) => item.enabled
        );

    // The phone menu sheet: the pages the bottom tab bar doesn't cover.
    const sheetLinks = navigationItems
        .filter((item) => !GUEST_TAB_PATHS.has(item.path))
        .map((item) => ({ ...item, end: item.path === "/" }));

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
                        layoutIdPrefix="public-navbar"
                        overHero={shouldShowWhiteText}
                        isScrolled={isScrolled}
                    />

                    <div
                        className="
                            pointer-events-auto
                            hidden
                            min-w-0
                            items-center
                            justify-end
                            lg:flex
                            lg:justify-self-end
                        "
                    >
                        <UserMenu
                            isPublic
                            pill={isPillNavbar}
                            overHero={shouldShowWhiteText}
                        />
                    </div>

                    <MenuSheetButton
                        isOpen={isMobileMenuOpen}
                        onOpen={() => setIsMobileMenuOpen(true)}
                        className={`ml-auto ${
                            isPillNavbar
                                ? `h-12 w-12 ${getPillSurfaceClasses({
                                      overHero: shouldShowWhiteText,
                                      isScrolled,
                                  })} text-gray-800 dark:text-gray-200`
                                : "h-11 w-11 text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                        }`}
                    />
            </PublicNavbarShell>

            {/* Phones: bottom tabs + the menu sheet (Menu tab). */}
            <CustomerTabBar
                tabs={GUEST_TABS}
                isMenuOpen={isMobileMenuOpen}
                onOpenMenu={() =>
                    setIsMobileMenuOpen(true)
                }
            />

            <SiteMenuSheet
                open={isMobileMenuOpen}
                onClose={closeMobileMenu}
                variant="guest"
                links={sheetLinks}
            />
        </>
    );
};

export default PublicNavbar;
