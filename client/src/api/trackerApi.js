import api from "../lib/axios";

export const getTrackers = async () => {
    const { data } = await api.get("/trackers");

    return data;
};

export const getTrackerById = async (trackerId) => {
    const { data } = await api.get(`/trackers/${trackerId}`);

    return data;
};

export const createTracker = async (trackerData) => {
    const { data } = await api.post("/trackers", trackerData);

    return data;
};

export const assignTracker = async (trackerId, vehicleId) => {
    const { data } = await api.patch(
        `/trackers/${trackerId}/assign`,
        { vehicle: vehicleId }
    );

    return data;
};

export const unassignTracker = async (trackerId) => {
    const { data } = await api.patch(`/trackers/${trackerId}/unassign`);

    return data;
};

export const disableTracker = async (trackerId) => {
    const { data } = await api.patch(`/trackers/${trackerId}/disable`);

    return data;
};

export const enableTracker = async (trackerId) => {
    const { data } = await api.patch(`/trackers/${trackerId}/enable`);

    return data;
};

// Returns the new plaintext deviceKey exactly once.
export const regenerateTrackerKey = async (trackerId) => {
    const { data } = await api.post(
        `/trackers/${trackerId}/regenerate-key`
    );

    return data;
};

export const updateTracker = async (trackerId, trackerData) => {
    const { data } = await api.put(
        `/trackers/${trackerId}`,
        trackerData
    );

    return data;
};
