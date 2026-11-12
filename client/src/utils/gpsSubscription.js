// Consumers share one room and retry failed joins while at least one remains.
const subscriptions = new WeakMap();

export const acquireGpsSubscription = (socket, vehicleId, subscribe, unsubscribe) => {
    let rooms = subscriptions.get(socket);
    if (!rooms) { rooms = new Map(); subscriptions.set(socket, rooms); }
    let room = rooms.get(vehicleId);
    if (!room) {
        room = { members: new Set(), pending: 0, attempt: 0, joined: false, retry: null, failures: 0 };
        rooms.set(vehicleId, room);
    }
    const member = { subscribe, unsubscribe };
    const wasEmpty = room.members.size === 0;
    room.members.add(member);
    const cancelRetry = () => { clearTimeout(room.retry); room.retry = null; };
    const prune = () => {
        if (!room.members.size && !room.pending && rooms.get(vehicleId) === room) rooms.delete(vehicleId);
    };
    const leave = () => {
        try { Promise.resolve(unsubscribe(vehicleId)).catch(() => {}); } catch { /* disconnected */ }
    };
    const join = () => {
        cancelRetry();
        const consumer = room.members.values().next().value;
        if (!consumer) return;
        const attempt = ++room.attempt;
        room.pending++;
        let succeeded = false;
        Promise.resolve().then(() => consumer.subscribe(vehicleId)).then(result => {
            succeeded = result?.success === true;
            if (succeeded && !room.members.size) leave();
        }).catch(() => {}).finally(() => {
            room.pending--;
            if (attempt === room.attempt) {
                room.joined = succeeded && room.members.size > 0;
                if (room.joined) room.failures = 0;
                else if (room.members.size) {
                    const delay = Math.min(1000 * 2 ** Math.min(room.failures++, 5), 30000);
                    room.retry = setTimeout(join, delay);
                    room.retry.unref?.();
                }
            }
            prune();
        });
    };
    // A new consumer can immediately retry a failed room without waiting
    // for all existing screens to unmount. Only one current join runs.
    if (wasEmpty || (!room.joined && room.pending === 0)) join();
    let released = false;
    return () => {
        if (released) return;
        released = true;
        room.members.delete(member);
        if (!room.members.size) {
            cancelRetry();
            room.joined = false;
            leave();
        }
        prune();
    };
};

// Joining before fetching closes the gap between a REST seed and room membership.
export const subscribeGpsAndRefresh = async (vehicleId, subscribe, refresh, active) => {
    const result = await subscribe(vehicleId);
    if (result?.success && active()) {
        try { await refresh(vehicleId); } catch { /* No saved position or temporarily unavailable. */ }
    }
    return result;
};
