import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    getDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    archiveDriver,
    restoreDriver,
    updateDriverStatus,
    updateDriverAvailability,
    clearDriverError,
    clearSelectedDriver,
    setDriverFilters,
    resetDriverFilters,
} from "../../store/drivers";

const useDriver = () => {
    const dispatch = useDispatch();

    const {
        drivers,
        selectedDriver,
        loading,
        error,
        filters,
    } = useSelector(
        (state) => state.drivers
    );

    const fetchDrivers =
        useCallback(
            (filters = {}) =>
                dispatch(
                    getDrivers(filters)
                ),
            [dispatch]
        );

    const fetchDriverById =
        useCallback(
            (driverId) =>
                dispatch(
                    getDriverById(
                        driverId
                    )
                ),
            [dispatch]
        );

    const createDriverAction =
        useCallback(
            (driverData) =>
                dispatch(
                    createDriver(
                        driverData
                    )
                ),
            [dispatch]
        );

    const updateDriverAction =
        useCallback(
            (
                driverId,
                driverData
            ) =>
                dispatch(
                    updateDriver({
                        driverId,
                        driverData,
                    })
                ),
            [dispatch]
        );

    const archiveDriverAction =
        useCallback(
            (
                driverId,
                reason = ""
            ) =>
                dispatch(
                    archiveDriver({
                        driverId,
                        reason,
                    })
                ),
            [dispatch]
        );

    const restoreDriverAction =
        useCallback(
            (driverId) =>
                dispatch(
                    restoreDriver(
                        driverId
                    )
                ),
            [dispatch]
        );

    const updateDriverStatusAction =
        useCallback(
            (
                driverId,
                status
            ) =>
                dispatch(
                    updateDriverStatus({
                        driverId,
                        status,
                    })
                ),
            [dispatch]
        );

    const updateDriverAvailabilityAction =
        useCallback(
            (
                driverId,
                availability
            ) =>
                dispatch(
                    updateDriverAvailability({
                        driverId,
                        availability,
                    })
                ),
            [dispatch]
        );

    const clearDriverErrorAction =
        useCallback(
            () =>
                dispatch(
                    clearDriverError()
                ),
            [dispatch]
        );

    const clearSelectedDriverAction =
        useCallback(
            () =>
                dispatch(
                    clearSelectedDriver()
                ),
            [dispatch]
        );

    const setDriverFiltersAction =
        useCallback(
            (filters) =>
                dispatch(
                    setDriverFilters(
                        filters
                    )
                ),
            [dispatch]
        );

    const resetDriverFiltersAction =
        useCallback(
            () =>
                dispatch(
                    resetDriverFilters()
                ),
            [dispatch]
        );

    return {
        dispatch,

        // State
        drivers,
        selectedDriver,
        loading,
        error,
        filters,

        // CRUD
        getDrivers:
            fetchDrivers,
        getDriverById:
            fetchDriverById,
        createDriver:
            createDriverAction,
        updateDriver:
            updateDriverAction,

        // Archive
        archiveDriver:
            archiveDriverAction,
        restoreDriver:
            restoreDriverAction,

        // Updates
        updateDriverStatus:
            updateDriverStatusAction,
        updateDriverAvailability:
            updateDriverAvailabilityAction,

        // Utilities
        clearDriverError:
            clearDriverErrorAction,
        clearSelectedDriver:
            clearSelectedDriverAction,
        setDriverFilters:
            setDriverFiltersAction,
        resetDriverFilters:
            resetDriverFiltersAction,
    };
};

export default useDriver;