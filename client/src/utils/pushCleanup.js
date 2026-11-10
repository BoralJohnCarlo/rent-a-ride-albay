import { withPushDeadline } from "./pushDeadline.js";
import { withPushSubscriptionLock } from "./pushCoordinator.js";

// Independent of the API: a database outage must not keep this browser subscribed.
export const stopBrowserPushOnLogout = async () => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    try {
        await withPushDeadline((signal) => withPushSubscriptionLock(signal, async (nativeStep) => {
            const worker = await nativeStep(() => navigator.serviceWorker.getRegistration("/"));
            const subscription = await nativeStep(() => worker?.pushManager.getSubscription());
            if (subscription) await nativeStep(() => subscription.unsubscribe());
            const notifications = await nativeStep(() => worker?.getNotifications?.());
            notifications?.forEach((notification) => notification.close());
        }), 1500);
    } catch { /* Logout still proceeds if the browser API fails. */ }
};
