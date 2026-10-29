import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import useSocket from "../shared/useSocket";
import {
    getAlerts,
    readAlert,
    resolveAlert,
    clearAlertError,
    alertReceived,
    alertResolvedRealtime,
} from "../../store/alerts";

const ALERT_NEW_EVENT = "alerts:new";
const ALERT_RESOLVED_EVENT = "alerts:resolved";

/*
 * Admins auto-join the server's admin alert room on socket connect (see
 * server/sockets/index.js), so unlike useGPS.js there is no per-vehicle
 * gps:subscribe call needed here - just listen for the two alert events on
 * the existing shared socket.
 */
const useAlerts = (params) => {
    const dispatch = useDispatch();
    const { socket } = useSocket();

    const { alerts, loading, error } = useSelector(
        (state) => state.alerts
    );

    useEffect(() => {
        const handleNewAlert = (payload) => {
            dispatch(alertReceived(payload));
        };

        const handleResolvedAlert = (payload) => {
            dispatch(alertResolvedRealtime(payload));
        };

        socket.on(ALERT_NEW_EVENT, handleNewAlert);
        socket.on(ALERT_RESOLVED_EVENT, handleResolvedAlert);

        return () => {
            socket.off(ALERT_NEW_EVENT, handleNewAlert);
            socket.off(ALERT_RESOLVED_EVENT, handleResolvedAlert);
        };
    }, [socket, dispatch]);

    return {
        alerts,
        loading,
        error,

        getAlerts: () => dispatch(getAlerts(params)),

        readAlert: (alertId) => dispatch(readAlert(alertId)),

        resolveAlert: (alertId) => dispatch(resolveAlert(alertId)),

        clearAlertError: () => dispatch(clearAlertError()),
    };
};

export default useAlerts;
