/*
 * Glass capsule used by each floating piece of the pill navbar (logo, link
 * group, mobile menu button). Dark glass with white text over the home hero,
 * light/dark glass everywhere else, with a slightly deeper shadow once the
 * page is scrolled.
 */
export const getPillSurfaceClasses = ({ overHero, isScrolled }) =>
    `pointer-events-auto rounded-full border backdrop-blur-xl transition-all duration-500 ${
        overHero
            ? "border-white/15 bg-gray-950/25 shadow-lg shadow-black/10"
            : `border-gray-200/80 bg-white/80 dark:border-gray-800/80 dark:bg-gray-950/75 ${
                  isScrolled
                      ? "shadow-xl shadow-gray-900/10 dark:shadow-black/40"
                      : "shadow-lg shadow-gray-900/5 dark:shadow-black/30"
              }`
    }`;
