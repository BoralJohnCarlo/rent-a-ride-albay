import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const SCROLL_THRESHOLD = 24;

/*
 * Whether floating chrome (pill navbar pieces, the bell, the user menu, the
 * customer-service bubble) is currently sitting over the home hero video and
 * should use its transparent "glass over the hero" look instead of its solid
 * colours. That's while the page is at the top of the home page, in every
 * colour theme — the hero video is always dark.
 *
 * One source of truth, so everything flips back to its real colours at the
 * same scroll position.
 */
const useNavbarOverHero = (homePath) => {
    const { pathname } = useLocation();

    const [isScrolled, setIsScrolled] = useState(
        () =>
            typeof window !== "undefined" &&
            window.scrollY > SCROLL_THRESHOLD
    );

    useEffect(() => {
        const handleScroll = () =>
            setIsScrolled(window.scrollY > SCROLL_THRESHOLD);

        handleScroll();
        window.addEventListener("scroll", handleScroll, {
            passive: true,
        });

        return () =>
            window.removeEventListener("scroll", handleScroll);
    }, []);

    return {
        isScrolled,
        overHero: pathname === homePath && !isScrolled,
    };
};

export default useNavbarOverHero;
