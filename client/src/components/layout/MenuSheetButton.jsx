import { Menu } from "lucide-react";

import { useLocation } from "react-router-dom";

import { isTabBarHidden } from "./customerTabs";

/**
 * Phones only, and only on the screens where the bottom tab bar is hidden
 * (vehicle details, checkout, support chat): a small top button that opens
 * the same menu sheet the tab bar's Menu button does.
 */
const MenuSheetButton = ({ isOpen, onOpen, className = "" }) => {
    const { pathname } = useLocation();

    if (!isTabBarHidden(pathname)) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={onOpen}
            aria-label="Open menu"
            aria-expanded={isOpen}
            className={`pointer-events-auto flex shrink-0 items-center justify-center rounded-full lg:hidden ${className}`}
        >
            <Menu size={20} />
        </button>
    );
};

export default MenuSheetButton;
