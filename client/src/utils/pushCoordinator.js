import { pushStep } from "./pushDeadline.js";

export const createPushCoordinator = (getLocks = () => typeof navigator !== "undefined" && navigator.locks) => {
    let tail = Promise.resolve();
    return (signal, operation) => {
        let resolveOutcome;
        let rejectOutcome;
        const outcome = new Promise((resolve, reject) => {
            resolveOutcome = resolve;
            rejectOutcome = reject;
        });
        const run = async () => {
            const pending = new Set();
            const nativeStep = (action, stepSignal = signal) => pushStep(stepSignal, () => {
                const task = Promise.resolve(action());
                pending.add(task);
                task.then(() => pending.delete(task), () => pending.delete(task));
                return task;
            });
            try {
                if (signal.aborted) throw signal.reason;
                resolveOutcome(await operation(nativeStep));
            } catch (error) {
                rejectOutcome(error);
            } finally {
                // A UI timeout cannot cancel native subscribe/unsubscribe. Keep
                // ownership until those actual operations settle, not until the UI stops waiting.
                await Promise.allSettled([...pending]);
            }
        };
        const task = tail.then(() => {
            if (signal.aborted) throw signal.reason;
            const locks = getLocks();
            return locks?.request
                ? locks.request("rent-a-ride-push-subscription", { mode: "exclusive", signal }, run)
                : run();
        });
        task.catch(rejectOutcome);
        tail = task.then(() => undefined, () => undefined);
        return pushStep(signal, () => outcome);
    };
};

// Shared by settings and logout; Web Locks also coordinate tabs when supported.
export const withPushSubscriptionLock = createPushCoordinator();
