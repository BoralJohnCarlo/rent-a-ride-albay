import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/*
 * Asks before leaving a page with unsaved changes, while `active`.
 *
 * The app uses <BrowserRouter>, whose navigation can't be blocked (that
 * needs a data router), so this works at the browser-history level:
 *   - In-app navigation (links, the sidebar and dock, navigate()) goes
 *     through history.pushState, which React Router calls and then re-reads
 *     the URL from. While active, a push to another page is held back, so
 *     the router stays put, and `pending` asks the page to confirm.
 *   - The browser's Back button: a same-URL entry is added on top, so going
 *     back lands on this page again; that's spotted and confirmed the same
 *     way.
 * Closing the tab or reloading is the page's own beforeunload warning.
 *
 * Returns { pending, confirmLeave, cancelLeave }.
 */
const GUARD_STATE_KEY = "__leaveGuard";

/*
 * Dropping the extra entry when the guard switches off is deferred a tick,
 * and cancelled if it switches straight back on (React StrictMode re-runs
 * effects; or new edits right after saving) — otherwise that history.back()
 * would land after the new guard started and look like the user pressing
 * Back.
 */
let pendingDrop = null;

const useLeaveGuard = (active, { fallbackPath = "/" } = {}) => {
    const navigate = useNavigate();
    const [pending, setPending] = useState(null);
    const leavingRef = useRef(false);
    const fallbackTimerRef = useRef(null);

    useEffect(() => () => clearTimeout(fallbackTimerRef.current), []);

    useEffect(() => {
        if (!active) {
            return undefined;
        }

        leavingRef.current = false;

        const history = window.history;
        const originalPush = history.pushState;

        const pushGuardEntry = () =>
            originalPush.call(
                history,
                { ...(history.state || {}), [GUARD_STATE_KEY]: true },
                "",
                window.location.href
            );

        history.pushState = function guardedPushState(state, title, url) {
            if (leavingRef.current || url == null) {
                return originalPush.call(history, state, title, url);
            }

            const target = new URL(String(url), window.location.href);

            // Same page (e.g. a ?tab change): let it through.
            if (target.pathname === window.location.pathname) {
                return originalPush.call(history, state, title, url);
            }

            setPending({
                type: "push",
                to: `${target.pathname}${target.search}${target.hash}`,
            });

            return undefined;
        };

        if (pendingDrop) {
            // Still on our entry from a moment ago: keep it.
            clearTimeout(pendingDrop);
            pendingDrop = null;
        } else if (!history.state?.[GUARD_STATE_KEY]) {
            pushGuardEntry();
        }

        const handlePopState = () => {
            if (leavingRef.current) {
                return;
            }

            // Back from our extra entry: still on this page. Ask, and put
            // the entry back for the next press.
            pushGuardEntry();
            setPending({ type: "back" });
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            history.pushState = originalPush;
            window.removeEventListener("popstate", handlePopState);

            // Saved (no longer dirty) while still here: drop the extra entry
            // so Back works in one press again.
            if (!leavingRef.current && history.state?.[GUARD_STATE_KEY]) {
                pendingDrop = setTimeout(() => {
                    pendingDrop = null;

                    if (window.history.state?.[GUARD_STATE_KEY]) {
                        window.history.back();
                    }
                }, 0);
            }
        };
    }, [active]);

    const confirmLeave = useCallback(() => {
        const request = pending;

        setPending(null);
        leavingRef.current = true;

        if (!request) {
            return;
        }

        if (request.type === "push") {
            navigate(request.to);
        } else {
            const startedAt = window.location.href;

            // Past our extra entry and this page's own one.
            window.history.go(-2);

            /*
             * Opened straight onto this page (nothing to go back to): the
             * browser ignores that, so go somewhere sensible instead.
             */
            fallbackTimerRef.current = setTimeout(() => {
                if (window.location.href === startedAt) {
                    navigate(fallbackPath, { replace: true });
                }
            }, 500);
        }
    }, [fallbackPath, navigate, pending]);

    const cancelLeave = useCallback(() => setPending(null), []);

    return { pending, confirmLeave, cancelLeave };
};

export default useLeaveGuard;
