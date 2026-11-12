// One controller belongs to the shared socket, regardless of mounted hooks.
export const createSocketSession = (getSocket) => {
    let authenticated = false;
    return {
        setAuthenticated(value) {
            authenticated = value;
            const socket = getSocket();
            if (value) {
                if (!socket.connected) socket.connect();
            } else {
                // Also cancel a connection/reconnection still in flight.
                socket.disconnect();
            }
        },
        refreshCredentials() {
            if (!authenticated) return;
            // Called only after the password response has installed the cookie.
            // Do not automatically retry a server disconnect on other devices.
            const socket = getSocket();
            socket.disconnect();
            socket.connect();
        },
    };
};
