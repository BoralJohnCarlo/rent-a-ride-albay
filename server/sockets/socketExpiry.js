// Long-lived sockets must stop receiving room broadcasts when their JWT expires.
// Recheck long delays because Node timers overflow beyond about 24.8 days.
export const disconnectAtTokenExpiry = (socket) => {
    let timer;
    const schedule = () => {
        const remaining = socket.authExpiresAt - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0) {
            socket.disconnect(true);
            return false;
        }
        timer = setTimeout(schedule, Math.min(remaining, 2 ** 31 - 1));
        timer.unref?.();
        return true;
    };
    socket.once("disconnect", () => clearTimeout(timer));
    return schedule();
};
