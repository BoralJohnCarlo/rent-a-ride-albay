import {
    getTrackers,
    createTracker,
    assignTracker,
    unassignTracker,
    disableTracker,
    enableTracker,
    regenerateTrackerKey,
    updateTracker,
} from "../api/trackerApi";

export const fetchTrackers = async () => {
    return await getTrackers();
};

export const createNewTracker = async (trackerData) => {
    return await createTracker(trackerData);
};

export const assignExistingTracker = async (trackerId, vehicleId) => {
    return await assignTracker(trackerId, vehicleId);
};

export const unassignExistingTracker = async (trackerId) => {
    return await unassignTracker(trackerId);
};

export const disableExistingTracker = async (trackerId) => {
    return await disableTracker(trackerId);
};

export const enableExistingTracker = async (trackerId) => {
    return await enableTracker(trackerId);
};

export const regenerateExistingTrackerKey = async (trackerId) => {
    return await regenerateTrackerKey(trackerId);
};

export const updateExistingTracker = async (
    trackerId,
    trackerData
) => {
    return await updateTracker(trackerId, trackerData);
};
