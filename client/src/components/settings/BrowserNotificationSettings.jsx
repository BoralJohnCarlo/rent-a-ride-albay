import { useCallback, useEffect, useRef, useState } from "react";
import { getBrowserPushState, enableBrowserPush, disableBrowserPush } from "../../services/browserPush";
import useAuth from "../../hooks/auth/useAuth";

export default function BrowserNotificationSettings() {
    const { user } = useAuth();
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [message, setMessage] = useState("");
    const requestId = useRef(0);
    const cancelLoad = useCallback(() => { requestId.current++; }, []);
    const load = useCallback(async () => {
        const id = ++requestId.current;
        setLoading(true);
        setLoadError(false);
        setMessage("");
        try {
            const result = await getBrowserPushState();
            if (id === requestId.current) setState(result);
        } catch {
            if (id === requestId.current) {
                setLoadError(true);
                setMessage("Could not load browser notification settings. Please retry.");
            }
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, []);
    useEffect(() => {
        load();
        return cancelLoad;
    }, [load, cancelLoad, user?._id]);
    useEffect(() => {
        let timer;
        const refreshOnReturn = () => {
            if (busy || document.visibilityState === "hidden") return;
            clearTimeout(timer);
            // Returning to a tab can emit both focus and visibility events.
            timer = setTimeout(() => { void load(); }, 150);
        };
        window.addEventListener("focus", refreshOnReturn);
        document.addEventListener("visibilitychange", refreshOnReturn);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("focus", refreshOnReturn);
            document.removeEventListener("visibilitychange", refreshOnReturn);
        };
    }, [load, busy, user?._id]);
    const disable = async () => {
        setBusy(true);
        setMessage("");
        try {
            const result = await disableBrowserPush();
            setState((previous) => previous ? { ...previous, enabled: false } : previous);
            setMessage(result.message);
        } catch (error) {
            setMessage(error.message || "Could not disable notifications. Please try again.");
        } finally { setBusy(false); }
    };
    const toggle = async () => {
        if (state.enabled) return disable();
        setBusy(true);
        setMessage("");
        try {
            await enableBrowserPush(state.publicKey);
            await load();
        } catch (error) {
            setMessage(error.response?.data?.message || error.message || "Could not update notifications. Please try again.");
        } finally { setBusy(false); }
    };
    return <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-lg font-bold text-gray-950 dark:text-white">Browser notifications</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Receive important booking, rental, document and money updates relevant to your role. Routine updates stay in your notification bell. This setting applies to this browser and ends when you sign out.</p>
        {state && !state.supported && <p className="mt-4 text-sm">This browser does not support notifications here. Use HTTPS or localhost; on iPhone or iPad, add this website to your Home Screen and open it there.</p>}
        {state?.supported && !state.configured && <p className="mt-4 text-sm">Browser notifications are not available yet. Your in-app notifications still work.</p>}
        {state?.permission === "denied" && <p className="mt-4 text-sm">Notifications are blocked. Allow them in your browser's site settings to enable alerts.</p>}
        {!loadError && state?.supported && state.configured && <button type="button" disabled={busy || loading || (!state.enabled && state.permission === "denied")} onClick={toggle} className="mt-4 rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">{busy ? "Saving..." : state.enabled ? "Disable browser notifications" : "Enable browser notifications"}</button>}
        {loadError && <button type="button" onClick={load} disabled={loading || busy} className="mt-4 rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-gray-950 disabled:opacity-50">Retry loading settings</button>}
        {loadError && <button type="button" onClick={disable} disabled={loading || busy} className="ml-3 mt-4 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">Disable on this browser</button>}
        <p role="status" className="mt-3 text-sm text-gray-600 dark:text-gray-300">{loading ? "Loading..." : message || (state?.enabled ? "Important browser notifications are enabled for this account." : "")}</p>
    </section>;
}
