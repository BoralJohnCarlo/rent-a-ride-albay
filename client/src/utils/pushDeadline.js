export const pushStep = (signal, operation) => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const aborted = () => reject(signal.reason);
    signal.addEventListener("abort", aborted, { once: true });
    try {
        Promise.resolve(operation()).then(resolve, reject)
            .finally(() => signal.removeEventListener("abort", aborted));
    } catch (error) {
        signal.removeEventListener("abort", aborted);
        reject(error);
    }
});

// Abort HTTP requests and stop later steps if a native browser promise stalls.
export const withPushDeadline = async (operation, timeoutMs = 12_000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("Notification settings took too long. Please try again.")), timeoutMs);
    try { return await pushStep(controller.signal, () => operation(controller.signal)); }
    finally { clearTimeout(timer); }
};
