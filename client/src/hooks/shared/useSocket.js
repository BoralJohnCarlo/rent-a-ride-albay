import { useCallback, useEffect, useState } from "react";
import useAuth from "../auth/useAuth";
import { getSocket, setSocketAuthenticated } from "../../lib/socket";

// Authentication and credential renewal control one shared connection.
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

        setSocketAuthenticated(isAuthenticated);
    }, [isAuthenticated, initialized]);

    const emitWithAck = useCallback((event, payload) => {
        return new Promise((resolve) => {
            getSocket().timeout(10_000).emit(event, payload, (error, result) => {
                resolve(
                    error ? { success: false, message: "GPS subscription request timed out." } : result ?? {
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
