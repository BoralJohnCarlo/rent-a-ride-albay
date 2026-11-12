import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { listenForGpsAssignmentChanges } from "../../utils/gpsAssignmentSync";

const useGpsAssignmentSync = (socket, refresh) => {
    const assignments = useSelector(state => state.gps.assignedTrackerByVehicleId);
    const latest = useRef({ assignments, refresh });
    useEffect(() => { latest.current = { assignments, refresh }; }, [assignments, refresh]);
    useEffect(() => listenForGpsAssignmentChanges(socket,
        () => latest.current.assignments, () => latest.current.refresh()), [socket]);
};
export default useGpsAssignmentSync;
