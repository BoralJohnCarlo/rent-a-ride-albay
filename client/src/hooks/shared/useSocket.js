import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";

import useAuth from "../auth/useAuth";

const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL ||
    (
        import.meta.env.VITE_API_URL || "http://localhost:5000/api"
    ).replace(/\/api\/?$/, "");

/*
 * One shared Socket.IO connection for the whole app - created lazily on
 * first use, never recreated per component render/mount. Auth relies
 * entirely on the existing httpOnly JWT cookie (withCredentials), same as
 * lib/axios.js - never localStorage, never a second auth mechanism.
 */
let sharedSocket = null;

const getSocket = () => {
    if (!sharedSocket) {
        sharedSocket = io(SOCKET_URL, {
            withCredentials: true,
            autoConnect: false,
        });
    }

    return sharedSocket;
};

const useSocket = () => {
    const { isAuthenticated, initialized } = useAuth();
    const [connected, setConnected] = useState(
        () => getSocket().connected
    );
    const [error, setError] = useState(null);
    const [reconnecting, setReconnecting] = useState(false);

    useEffect(() => {
        const socket = getSocket();

        const handleConnect = () => {
            setConnected(true);
            setError(null);
            setReconnecting(false);
        };

        const handleDisconnect = () => {
            setConnected(false);
        };

        const handleConnectError = (err) => {
            setConnected(false);
            setError(err?.message || "Socket connection error.");
        };

        // Reconnection attempts/success/failure are emitted on the Manager
        // (socket.io), not the socket itself - only connect/disconnect/
        // connect_error live there.
        const handleReconnectAttempt = () => setReconnecting(true);
        const handleReconnectSuccess = () => setReconnecting(false);
        const handleReconnectFailed = () => setReconnecting(false);

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.io.on("reconnect_attempt", handleReconnectAttempt);
        socket.io.on("reconnect", handleReconnectSuccess);
        socket.io.on("reconnect_failed", handleReconnectFailed);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
            socket.io.off("reconnect_attempt", handleReconnectAttempt);
            socket.io.off("reconnect", handleReconnectSuccess);
            socket.io.off("reconnect_failed", handleReconnectFailed);
        };
    }, []);

    // Connect once an authenticated session exists; disconnect on logout.
    // Socket.IO's own reconnection handles transient drops - if the JWT
    // cookie has since expired, the next reconnect attempt re-runs the
    // server's auth middleware and surfaces via connect_error above; no
    // refresh-token system is invented here.
    useEffect(() => {
        if (!initialized) {
            return;
        }

        const socket = getSocket();

        if (isAuthenticated) {
            if (!socket.connected) {
                socket.connect();
            }
        } else if (socket.connected) {
            socket.disconnect();
        }
    }, [isAuthenticated, initialized]);

    const emitWithAck = useCallback((event, payload) => {
        return new Promise((resolve) => {
            getSocket().emit(event, payload, (result) => {
                resolve(
                    result ?? {
                        success: false,
                        message: "No response from server.",
                    }
                );
            });
        });
    }, []);

    const subscribeToVehicle = useCallback(
        (vehicleId) => emitWithAck("gps:subscribe", { vehicleId }),
        [emitWithAck]
    );

    const unsubscribeFromVehicle = useCallback(
        (vehicleId) => emitWithAck("gps:unsubscribe", { vehicleId }),
        [emitWithAck]
    );

    return {
        socket: getSocket(),
        connected,
        error,
        reconnecting,
        subscribeToVehicle,
        unsubscribeFromVehicle,
    };
};

export default useSocket;
