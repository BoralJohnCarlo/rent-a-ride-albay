import {
    useLayoutEffect,
    useRef,
} from "react";

import { useLocation } from "react-router-dom";

const ROOT_ATTR = "data-page-root";

// A page that runs its own entrance (the dashboards' framer-motion heroes)
// puts this on its root or on one of its top-level sections.
const OPT_OUT = "[data-own-entrance]";

// Matches the @keyframes name in styles/page-enter.css.
const ENTRANCE = "page-section-in";

// The entrance belongs to the opening only. After this long the tag comes
// off, so a section remounting later (search results, a filter flip) doesn't
// replay it — or fight the page's own framer-motion transitions.
const RELEASE_AFTER_MS = 1000;

// A root that only appears after this (a slow first load) just shows up.
const OPENING_WINDOW_MS = 3000;

// Removes the tag once every entrance still running under it has finished,
// so none is cut short mid-fade.
const release = (root) => {
    const running =
        typeof root.getAnimations === "function"
            ? root
                  .getAnimations({ subtree: true })
                  .filter(
                      (animation) =>
                          animation.animationName === ENTRANCE
                  )
            : [];

    Promise.allSettled(
        running.map((animation) => animation.finished)
    ).then(() => root.removeAttribute(ROOT_ATTR));
};

const isContent = (element) =>
    element.tagName !== "STYLE" &&
    element.tagName !== "SCRIPT";

const ownsEntrance = (root) =>
    root.matches(OPT_OUT) ||
    Boolean(root.querySelector(`:scope > ${OPT_OUT}`));

/*
 * The section a path belongs to: "/admin/settings/themes" → "/admin/settings".
 * Keying on it replays the entrance per page, not per settings tab (which
 * would otherwise remount the whole Settings page).
 */
const sectionOf = (pathname) =>
    pathname
        .split("/")
        .slice(0, 3)
        .join("/");

const PageEntrance = ({ children }) => {
    const wrapperRef = useRef(null);

    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;

        if (!wrapper) return undefined;

        const openedAt = performance.now();

        // The element whose children are the page's sections: the page's
        // single root element, or this wrapper when it renders a fragment.
        let root = null;
        let releaseTimer = null;

        // Stick with a root while it's still mounted, so a sibling appearing
        // later doesn't move the tag and replay the whole page. Re-pick only
        // when it's replaced (e.g. a loading state giving way to the page).
        const tagRoot = () => {
            const children = [...wrapper.children].filter(isContent);

            // Nothing rendered yet (lazy route, `return null` while loading).
            if (children.length === 0) {
                wrapper.removeAttribute(ROOT_ATTR);
                root = null;
                return;
            }

            const rootStillMounted =
                root &&
                (root === wrapper || root.parentNode === wrapper);

            if (rootStillMounted) return;

            root = children.length === 1
                ? children[0]
                : wrapper;

            const opening =
                performance.now() - openedAt < OPENING_WINDOW_MS;

            if (!opening || ownsEntrance(root)) return;

            const tagged = root;

            tagged.setAttribute(ROOT_ATTR, "");

            clearTimeout(releaseTimer);
            releaseTimer = setTimeout(
                () => release(tagged),
                RELEASE_AFTER_MS
            );
        };

        tagRoot();

        const observer = new MutationObserver(tagRoot);

        observer.observe(wrapper, { childList: true });

        return () => {
            observer.disconnect();
            clearTimeout(releaseTimer);
        };
    }, []);

    return (
        <div
            ref={wrapperRef}
            className="h-full"
        >
            {children}
        </div>
    );
};

/**
 * Admin / partner page entrance: each page's top-level sections fade + rise
 * in, staggered (styles/page-enter.css).
 */
const DashboardPageTransition = ({ children }) => {
    const { pathname } = useLocation();

    return (
        <PageEntrance key={sectionOf(pathname)}>
            {children}
        </PageEntrance>
    );
};

export default DashboardPageTransition;
