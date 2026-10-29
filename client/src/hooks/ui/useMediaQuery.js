import { useCallback, useSyncExternalStore } from "react";

/**
 * Live `window.matchMedia(query).matches`. Used where a breakpoint must
 * decide what's *mounted* (not just shown) — e.g. the dashboard bell, which
 * polls and plays a sound, so a CSS-hidden second copy would double-fire.
 */
const useMediaQuery = (query) => {
    const subscribe = useCallback(
        (onChange) => {
            const list = window.matchMedia(query);

            list.addEventListener("change", onChange);

            return () =>
                list.removeEventListener("change", onChange);
        },
        [query]
    );

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false
    );
};

export default useMediaQuery;
