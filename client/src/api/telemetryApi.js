import api from "../lib/axios";

export const getCurrentVehicleTracking = async (vehicleId) => {
    const { data } = await api.get(
        `/telemetry/vehicles/${vehicleId}/current`
    );

    return data;
};

// Partner only: the caller's own vehicles, each with its tracker summary
// and last known position.
export const getMyFleetTracking = async () => {
    const { data } = await api.get("/telemetry/fleet/mine");

    return data;
};

export const getVehicleTelemetryHistory = async (
    vehicleId,
    { start, end } = {}
) => {
    const { data } = await api.get(
        `/telemetry/vehicles/${vehicleId}/history`,
        {
            params: { start, end },
        }
    );

    return data;
};
