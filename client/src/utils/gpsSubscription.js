// Consumers share a Socket.IO room: one screen's cleanup must not evict another.
const subscriptions = new WeakMap();

export const acquireGpsSubscription = (socket, vehicleId, subscribe, unsubscribe) => {
    let rooms = subscriptions.get(socket);
    if (!rooms) {
        rooms = new Map();
        subscriptions.set(socket, rooms);
    }
    let room = rooms.get(vehicleId);
    if (!room) {
        room = { consumers: 0, pending: 0 };
        rooms.set(vehicleId, room);
    }
    const prune = () => {
        if (!room.consumers && !room.pending) rooms.delete(vehicleId);
    };
    const leave = () => {
        // Disconnections/failed acknowledgements must not create unhandled promises.
        try { Promise.resolve(unsubscribe(vehicleId)).catch(() => {}); } catch { /* disconnected */ }
    };
    if (room.consumers++ === 0) {
        room.pending++;
        Promise.resolve().then(() => subscribe(vehicleId)).then(result => {
            // The server may finish authorization and join after cleanup ran.
            if (result?.success && !room.consumers) leave();
        }).catch(() => {}).finally(() => {
            room.pending--;
            prune();
        });
    }
    let released = false;
    return () => {
        if (released) return;
        released = true;
        if (--room.consumers === 0) leave();
        prune();
    };
};
