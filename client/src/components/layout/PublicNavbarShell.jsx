import { motion } from "framer-motion";

import PageContainer from "../sections/PageContainer";

const HEADER_ENTRANCE = {
    initial: {
        y: -20,
        opacity: 0,
    },
    animate: {
        y: 0,
        opacity: 1,
    },
    transition: {
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
    },
};

const GRID_CLASSES =
    "grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center";

// Hidden (display:none) children don't take grid cells, so on mobile the
// grid would drop the menu button into the centre column. The pill uses a
// plain flex row there and only switches to the 3-column grid on desktop.
const PILL_LAYOUT_CLASSES =
    "flex items-center gap-2 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-0";

/*
 * Outer frame of the public/customer navbar. "default" is the original
 * full-width bar (transparent over the hero, frosted once scrolled). "pill"
 * is a transparent row where the logo, the link group and the user menu each
 * float on their own (see getPillSurfaceClasses); the row itself ignores
 * clicks so page content under the gaps stays usable. Both keep the header
 * 72px tall so page offsets don't change between styles.
 */
const PublicNavbarShell = ({
    isPill,
    isScrolled,
    children,
}) => {
    if (!isPill) {
        return (
            <motion.header
                {...HEADER_ENTRANCE}
                className={`
                    fixed
                    inset-x-0
                    top-0
                    z-50
                    h-18
                    border-b
                    transition-all
                    duration-500
                    ${
                        isScrolled
                            ? `
                                border-gray-200/80
                                bg-white/85
                                shadow-sm
                                backdrop-blur-xl
                                dark:border-gray-800/80
                                dark:bg-gray-950/85
                                dark:shadow-black/20
                            `
                            : `
                                border-transparent
                                bg-transparent
                                shadow-none
                            `
                    }
                `}
            >
                <PageContainer className={`h-full ${GRID_CLASSES}`}>
                    {children}
                </PageContainer>
            </motion.header>
        );
    }

    return (
        <motion.header
            {...HEADER_ENTRANCE}
            className="
                pointer-events-none
                fixed
                inset-x-0
                top-0
                z-50
                h-18
                px-3
                pt-3
                sm:px-6
            "
        >
            <div
                className={`
                    mx-auto
                    h-15
                    max-w-7xl
                    ${PILL_LAYOUT_CLASSES}
                `}
            >
                {children}
            </div>
        </motion.header>
    );
};

export default PublicNavbarShell;
