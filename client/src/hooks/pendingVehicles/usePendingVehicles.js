import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import { fetchPendingVehicles, fetchMyPendingVehicles, fetchPendingVehicleCounts, clearPendingVehicles } from "../../store/pendingVehicles";

export const usePendingVehicles = () => {
    const dispatch = useDispatch();
    const {
        pendingVehicles,
        loading,
        success,
        error,
        pagination,
        counts
    } = useSelector((state) => state.pendingVehicles);

    const loadPendingVehicles = useCallback(
        (params = {}) => {
            dispatch(fetchPendingVehicles(params));
        },
        [dispatch]
    );

    const loadMyPendingVehicles = useCallback(
        (params = {}) => {
            dispatch(fetchMyPendingVehicles(params));
        },
        [dispatch]
    );

    const loadPendingVehicleCounts = useCallback(() => {
        dispatch(fetchPendingVehicleCounts());
    }, [dispatch]);

    const clearData = useCallback(() => {
        dispatch(clearPendingVehicles());
    }, [dispatch]);

    return {
        pendingVehicles,
        loading,
        success,
        error,
        pagination,
        counts,
        loadPendingVehicles,
        loadMyPendingVehicles,
        loadPendingVehicleCounts,
        clearData
    };
};

export { usePendingVehicles as default };