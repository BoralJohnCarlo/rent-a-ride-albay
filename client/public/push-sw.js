/* Dedicated to push: no fetch handler or offline cache. */
const receiptDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.open("rent-a-ride-push-receipts", 1);
    let settled = false;
    const fail = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("Push receipt storage unavailable"));
    };
    const timer = setTimeout(fail, 1500);
    request.onupgradeneeded = () => request.result.createObjectStore("shown", { keyPath: "id" });
    request.onsuccess = () => {
        if (settled) { request.result.close(); return; }
        settled = true;
        clearTimeout(timer);
        resolve(request.result);
    };
    request.onerror = fail;
    request.onblocked = fail;
});

// Bound every transaction, not just opening the database. A stalled read or
// write must release the serialized push chain and fall back to stable tags.
const receiptTransaction = (database, mode, operation) => new Promise((resolve, reject) => {
    let transaction;
    let value;
    let settled = false;
    const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) {
            try { transaction?.abort(); } catch { /* Already completed or aborted. */ }
            reject(error);
        } else resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Push receipt transaction timed out")), 1500);
    try {
        transaction = database.transaction("shown", mode);
        transaction.oncomplete = () => finish();
        transaction.onerror = () => finish(new Error("Push receipt transaction failed"));
        transaction.onabort = () => finish(new Error("Push receipt transaction aborted"));
        const request = operation(transaction.objectStore("shown"));
        if (request) request.onsuccess = () => { value = request.result; };
    } catch (error) { finish(error); }
});

const displayPush = async (data) => {
    let database;
    const id = typeof data?.tag === "string" ? data.tag : null;
    const expiresAt = Number(data?.expiresAt) || Date.now() + 60 * 60 * 1000;
    if (expiresAt <= Date.now()) return;
    try {
        if (id && typeof indexedDB !== "undefined") {
            database = await receiptDatabase();
            const receipt = await receiptTransaction(database, "readonly", (store) => store.get(id));
            if (receipt?.expiresAt > Date.now()) { database.close(); return; }
        }
    } catch {
        database?.close();
        database = null; // Storage failure must not discard an important new alert.
    }
    try {
        await self.registration.showNotification("Rent-A-Ride Albay", {
            icon: "/favicon-48.png", badge: "/favicon-32.png",
            body: data?.body || "An important update is available. Open your notifications to view it.",
            tag: id || "rent-a-ride-update", renotify: false,
            data: { url: data?.url || "/" },
        });
        if (database && id) {
            await receiptTransaction(database, "readwrite", (store) => {
                store.put({ id, expiresAt });
                const cursor = store.openCursor();
                cursor.onsuccess = () => {
                    const item = cursor.result;
                    if (!item) return;
                    if (item.value.expiresAt <= Date.now()) item.delete();
                    item.continue();
                };
            }).catch(() => {}); // Stable notification tags remain the fallback.
        }
    } finally { database?.close(); }
};

// Serialize pushes within this worker so concurrent retries share the saved receipt.
let pendingPush = Promise.resolve();
self.addEventListener("push", (event) => {
    let data;
    try { data = event.data?.json(); } catch { /* Use a safe fallback. */ }
    pendingPush = pendingPush.catch(() => {}).then(() => displayPush(data));
    event.waitUntil(pendingPush);
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = new URL(event.notification.data?.url || "/", self.location.origin);
    if (url.origin !== self.location.origin) return;
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of windows) {
            if (new URL(client.url).origin === url.origin) {
                await client.navigate(url.href);
                return client.focus();
            }
        }
        return self.clients.openWindow(url.href);
    })());
});
