import api from "../lib/axios";
import { pushStep, withPushDeadline } from "../utils/pushDeadline";
import { withPushSubscriptionLock } from "../utils/pushCoordinator";

export const supportsPush = () => window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const requestOptions = (signal) => ({ signal, timeout: 8000 });

export const getBrowserPushState = async () => {
    if (!supportsPush()) return { supported: false };
    return withPushDeadline(async (signal) => {
        const worker = await pushStep(signal, () => navigator.serviceWorker.getRegistration("/"));
        const subscription = await pushStep(signal, () => worker?.pushManager.getSubscription());
        const { data } = await pushStep(signal, () => api.get("/notifications/push/config", requestOptions(signal)));
        const status = subscription ? await pushStep(signal, () => api.post("/notifications/push/status", { endpoint: subscription.endpoint }, requestOptions(signal))) : null;
        return { supported: true, configured: data.enabled, publicKey: data.publicKey, enabled: Boolean(status?.data.subscribed) && Notification.permission === "granted", permission: Notification.permission };
    });
};

export const enableBrowserPush = (publicKey) => withPushDeadline(async (signal) => {
    // Permission is requested directly from the user's click, before network awaits.
    const permission = await pushStep(signal, () => Notification.requestPermission());
    if (permission !== "granted") throw new Error(permission === "denied"
        ? "Notifications are blocked. You can allow them in your browser's site settings."
        : "Notifications were not enabled. Click Enable when you are ready to try again.");
    return withPushSubscriptionLock(signal, async (nativeStep) => {
    await nativeStep(() => navigator.serviceWorker.register("/push-sw.js", { scope: "/" }));
    const worker = await nativeStep(() => navigator.serviceWorker.ready);
    const bytes = Uint8Array.from(atob(publicKey.replace(/-/g, "+").replace(/_/g, "/")), (character) => character.charCodeAt(0));
    // Read only after older mutations finish; their cached subscription may be gone.
    let existing = await nativeStep(() => worker.pushManager.getSubscription());
    if (existing && String(new Uint8Array(existing.options.applicationServerKey || [])) !== String(bytes)) {
        await nativeStep(() => existing.unsubscribe());
        existing = null;
    }
    const subscription = existing || await nativeStep(() => worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }));
    try {
        await pushStep(signal, () => api.post("/notifications/push/subscription", subscription.toJSON(), requestOptions(signal)));
    } catch (error) {
        if (!existing) {
            await withPushDeadline((cleanupSignal) => nativeStep(() => subscription.unsubscribe(), cleanupSignal), 2000).catch(() => {});
        }
        throw error;
    }
    });
}, 30_000);

export const disableBrowserPush = async () => {
    if (!supportsPush()) throw new Error("Browser notifications are not supported here.");
    const { worker, subscription } = await withPushDeadline(async (signal) => {
        const worker = await pushStep(signal, () => navigator.serviceWorker.getRegistration("/"));
        const subscription = await pushStep(signal, () => worker?.pushManager.getSubscription());
        return { worker, subscription };
    }, 4000);
    if (!subscription) return { localDisabled: true, serverDisabled: false, message: "Browser notifications are disabled on this browser." };
    // Run independently: neither cleanup attempt can prevent the other one.
    const [local, server] = await Promise.allSettled([
        withPushDeadline((signal) => withPushSubscriptionLock(signal, async (nativeStep) => {
            // Re-read under the lock rather than mutating a stale discovery result.
            const current = await nativeStep(() => worker.pushManager.getSubscription());
            if (!current || current.endpoint !== subscription.endpoint) return;
            const removed = await nativeStep(() => current.unsubscribe());
            if (removed === false && await nativeStep(() => worker.pushManager.getSubscription())) {
                throw new Error("Browser unsubscribe was not confirmed.");
            }
        }), 4000),
        withPushDeadline((signal) => pushStep(signal, () => api.delete("/notifications/push/subscription", {
            ...requestOptions(signal), data: { endpoint: subscription.endpoint },
        })), 8000),
    ]);
    const localDisabled = local.status === "fulfilled";
    const serverDisabled = server.status === "fulfilled";
    if (!localDisabled && !serverDisabled) throw new Error("Could not confirm notifications are disabled. Please retry or block notifications in your browser's site settings.");
    return { localDisabled, serverDisabled, message: localDisabled
        ? serverDisabled ? "Browser notifications disabled." : "Disabled on this browser. Server cleanup could not be confirmed."
        : "Disabled for your account on this browser. Local browser cleanup could not be confirmed." };
};
