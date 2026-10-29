import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";

import {
    submitAvailabilityRequest,
    fetchMyAvailabilityRequests,
    fetchAvailabilityRequests,
    approveAvailabilityRequestHandler,
    rejectAvailabilityRequestHandler,
    cancelAvailabilityRequestHandler,
    clearAvailabilityRequests,
} from "../../store/vehicleAvailabilityRequests";

const useVehicleAvailabilityRequests = () => {
    const dispatch = useDispatch();

    const { requests, loading, success, error } = useSelector(
        (state) => state.vehicleAvailabilityRequests
    );

    const submitRequest = useCallback(
        (payload) =>
            dispatch(submitAvailabilityRequest(payload)).unwrap(),
        [dispatch]
    );

    const loadMyRequests = useCallback(
        (params = {}) =>
            dispatch(fetchMyAvailabilityRequests(params)).unwrap(),
        [dispatch]
    );

    const loadAllRequests = useCallback(
        (params = {}) =>
            dispatch(fetchAvailabilityRequests(params)).unwrap(),
        [dispatch]
    );

    const approveRequest = useCallback(
        (id, remarks = "") =>
            dispatch(
                approveAvailabilityRequestHandler({ id, remarks })
            ).unwrap(),
        [dispatch]
    );

    const rejectRequest = useCallback(
        (id, rejectionReason) =>
            dispatch(
                rejectAvailabilityRequestHandler({
                    id,
                    rejectionReason,
                })
            ).unwrap(),
        [dispatch]
    );

    const cancelRequest = useCallback(
        (id) =>
            dispatch(cancelAvailabilityRequestHandler(id)).unwrap(),
        [dispatch]
    );

    const clearRequests = useCallback(() => {
        dispatch(clearAvailabilityRequests());
    }, [dispatch]);

    return {
        requests,
        loading,
        success,
        error,
        submitRequest,
        loadMyRequests,
        loadAllRequests,
        approveRequest,
        rejectRequest,
        cancelRequest,
        clearRequests,
    };
};

export default useVehicleAvailabilityRequests;
