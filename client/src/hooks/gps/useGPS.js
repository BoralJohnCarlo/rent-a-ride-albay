import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import useSocket from "../shared/useSocket";
import { getCurrentVehicleTracking } from "../../api/telemetryApi";
import {
    telemetryReceived,
    heartbeatReceived,
    selectVehicleTelemetry,
} from "../../store/gps";

const GPS_TELEMETRY_EVENT = "gps:telemetry";
const GPS_HEARTBEAT_EVENT = "gps:heartbeat";

// VehicleTrackingState (REST) uses `vehicle`/`tracker` ObjectId refs; the
// realtime socket payload already uses `vehicleId`/`trackerId` strings.
// Normalizing here means the gps slice always holds one consistent shape
// regardless of which source (REST or socket) populated it.
export const normalizeTrackingState = (state) => ({
    vehicleId: String(state.vehicle),
    trackerId: state.tracker ? String(state.tracker) : null,
    latitude: state.latitude,
    longitude: state.longitude,
    speed: state.speed,
    heading: state.heading,
    ignition: state.ignition,
    batteryLevel: state.batteryLevel,
    gpsFix: state.gpsFix,
    recordedAt: state.recordedAt,
    receivedAt: state.receivedAt,
    source: state.source ?? null,
});

/*
 * Focused GPS data/subscription hook - no map/Leaflet concerns here (that's
 * a later milestone). Subscribes to one vehicle's realtime telemetry room
 * while mounted and exposes the latest known state from Redux.
 *
 * Also seeds Redux with the vehicle's last known position via REST on
 * mount, so a fresh page load can show an existing position immediately
 * instead of waiting for the next socket event.
 */
/*
 * `seed: false` skips the per-vehicle REST seed - for pages that already
 * loaded every vehicle's last position in one request (partner fleet).
 */
const useGPS = (vehicleId, { seed = true } = {}) => {
    const dispatch = useDispatch();
    const {
        socket,
        connected,
        error: socketError,
        subscribeToVehicle,
        unsubscribeFromVehicle,
    } = useSocket();

    const telemetry = useSelector(selectVehicleTelemetry(vehicleId));
    const subscribedRef = useRef(false);
    const [initializing, setInitializing] = useState(
        Boolean(vehicleId) && seed
    );

    useEffect(() => {
        if (!vehicleId || !seed) {
            return undefined;
        }

        let cancelled = false;
        setInitializing(true);

        getCurrentVehicleTracking(vehicleId)
            .then((response) => {
                if (cancelled || !response?.data) {
                    return;
                }

                dispatch(
                    telemetryReceived(
                        normalizeTrackingState(response.data)
                    )
                );
            })
            .catch(() => {
                // No tracking state yet (e.g. a 404 for a vehicle with no
                // tracker) - not an error the user needs to see, the
                // empty state already covers "no GPS data".
            })
            .finally(() => {
                if (!cancelled) {
                    setInitializing(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [vehicleId, seed, dispatch]);

    useEffect(() => {
        if (!vehicleId) {
            return undefined;
        }

        const handleTelemetry = (payload) => {
            if (payload?.vehicleId === vehicleId) {
                dispatch(telemetryReceived(payload));
            }
        };

        // Communication without a newer position - keeps the vehicle from
        // looking Offline while its tracker is still talking to us.
        const handleHeartbeat = (payload) => {
            if (payload?.vehicleId === vehicleId) {
                dispatch(heartbeatReceived(payload));
            }
        };

        socket.on(GPS_TELEMETRY_EVENT, handleTelemetry);
        socket.on(GPS_HEARTBEAT_EVENT, handleHeartbeat);

        return () => {
            socket.off(GPS_TELEMETRY_EVENT, handleTelemetry);
            socket.off(GPS_HEARTBEAT_EVENT, handleHeartbeat);
        };
    }, [socket, vehicleId, dispatch]);

    useEffect(() => {
        if (!vehicleId || !connected) {
            return undefined;
        }

        let cancelled = false;

        subscribeToVehicle(vehicleId).then((result) => {
            if (!cancelled) {
                subscribedRef.current = Boolean(result?.success);
            }
        });

        return () => {
            cancelled = true;

            if (subscribedRef.current) {
                unsubscribeFromVehicle(vehicleId);
                subscribedRef.current = false;
            }
        };
    }, [vehicleId, connected, subscribeToVehicle, unsubscribeFromVehicle]);

    const resubscribe = useCallback(() => {
        if (!vehicleId) {
            return Promise.resolve({ success: false });
        }

        return subscribeToVehicle(vehicleId);
    }, [vehicleId, subscribeToVehicle]);

    return {
        telemetry,
        initializing,
        connected,
        error: socketError,
        resubscribe,
    };
};

export default useGPS;
