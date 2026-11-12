// Events only invalidate local assignments. Their payload never authorizes a
// tracker: refresh must load the caller's current fleet/trackers from REST.
export const listenForGpsAssignmentChanges = (socket, getAssignments, refresh) => {
    let stopped = false, running = false, dirty = false, timer, failures = 0;
    const request = (delay = 150) => {
        if (stopped) return;
        dirty = true;
        if (running || timer) return;
        timer = setTimeout(async () => {
            timer = null;
            if (stopped) return;
            running = true;
            dirty = false;
            let failed = false;
            try { failed = (await refresh()) === false; } catch { failed = true; }
            finally {
                running = false;
                if (failed) {
                    failures = Math.min(failures + 1, 6);
                    request(Math.min(1000 * 2 ** (failures - 1), 30000));
                } else {
                    failures = 0;
                    if (dirty) request();
                }
            }
        }, delay);
    };
    const assignmentChanged = (payload) => {
        // An unassigned vehicle may not have an assignment-cache entry yet.
        // The server scopes this notification to authorized vehicle rooms.
        if (payload?.vehicleId) request();
    };
    const reading = (payload) => {
        const assignments = getAssignments();
        if (payload?.vehicleId && payload.trackerId &&
            (!Object.hasOwn(assignments, payload.vehicleId) || assignments[payload.vehicleId] !== payload.trackerId)) request();
    };
    socket.on("connect", request);
    socket.on("gps:assignment-changed", assignmentChanged);
    socket.on("gps:telemetry", reading);
    socket.on("gps:heartbeat", reading);
    return () => {
        stopped = true;
        clearTimeout(timer);
        socket.off("connect", request);
        socket.off("gps:assignment-changed", assignmentChanged);
        socket.off("gps:telemetry", reading);
        socket.off("gps:heartbeat", reading);
    };
};
