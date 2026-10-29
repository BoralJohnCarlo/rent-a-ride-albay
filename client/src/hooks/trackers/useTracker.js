import { useDispatch, useSelector } from "react-redux";

import {
    getTrackers,
    registerTracker,
    assignTracker,
    unassignTracker,
    disableTracker,
    enableTracker,
    regenerateTrackerKey,
    updateTracker,
    clearTrackerError,
} from "../../store/trackers";

const useTracker = () => {
    const dispatch = useDispatch();

    const { trackers, loading, error } = useSelector(
        (state) => state.trackers
    );

    return {
        trackers,
        loading,
        error,

        getTrackers: () => dispatch(getTrackers()),

        registerTracker: (trackerData) =>
            dispatch(registerTracker(trackerData)),

        assignTracker: (trackerId, vehicleId) =>
            dispatch(assignTracker({ trackerId, vehicleId })),

        unassignTracker: (trackerId) =>
            dispatch(unassignTracker(trackerId)),

        disableTracker: (trackerId) =>
            dispatch(disableTracker(trackerId)),

        enableTracker: (trackerId) =>
            dispatch(enableTracker(trackerId)),

        regenerateTrackerKey: (trackerId) =>
            dispatch(regenerateTrackerKey(trackerId)),

        updateTracker: (trackerId, trackerData) =>
            dispatch(updateTracker({ trackerId, trackerData })),

        clearTrackerError: () => dispatch(clearTrackerError()),
    };
};

export default useTracker;
