import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    getServiceLocations,
    getEnabledServiceLocations,
    getServiceLocationById,
    createServiceLocation,
    updateServiceLocation,
    disableServiceLocation,
    enableServiceLocation,
    deleteServiceLocation,
    clearServiceLocationError,
    clearSelectedServiceLocation,
} from "../../store/serviceLocations";


const useServiceLocation = () => {
    const dispatch = useDispatch();

    const {
        serviceLocations,
        selectedServiceLocation,
        loading,
        error,
    } = useSelector(
        (state) => state.serviceLocations
    );

    const fetchServiceLocations =
        useCallback(
            () =>
                dispatch(
                    getServiceLocations()
                ),
            [dispatch]
        );

    const fetchEnabledServiceLocations =
        useCallback(
            () =>
                dispatch(
                    getEnabledServiceLocations()
                ),
            [dispatch]
        );

    const fetchServiceLocationById =
        useCallback(
            (locationId) =>
                dispatch(
                    getServiceLocationById(
                        locationId
                    )
                ),
            [dispatch]
        );

    const createServiceLocationAction =
        useCallback(
            (locationData) =>
                dispatch(
                    createServiceLocation(
                        locationData
                    )
                ),
            [dispatch]
        );

    const updateServiceLocationAction =
        useCallback(
            ({ locationId, locationData }) =>
                dispatch(
                    updateServiceLocation({
                        locationId,
                        locationData,
                    })
                ),
            [dispatch]
        );

    const disableServiceLocationAction =
        useCallback(
            (locationId) =>
                dispatch(
                    disableServiceLocation(
                        locationId
                    )
                ),
            [dispatch]
        );

    const enableServiceLocationAction =
        useCallback(
            (locationId) =>
                dispatch(
                    enableServiceLocation(
                        locationId
                    )
                ),
            [dispatch]
        );

    const deleteServiceLocationAction =
        useCallback(
            (locationId) =>
                dispatch(
                    deleteServiceLocation(
                        locationId
                    )
                ),
            [dispatch]
        );

    const clearErrorAction =
        useCallback(
            () =>
                dispatch(
                    clearServiceLocationError()
                ),
            [dispatch]
        );

    const clearSelectedAction =
        useCallback(
            () =>
                dispatch(
                    clearSelectedServiceLocation()
                ),
            [dispatch]
        );

    return {
        serviceLocations,
        selectedServiceLocation,
        loading,
        error,

        getServiceLocations:
            fetchServiceLocations,
        getEnabledServiceLocations:
            fetchEnabledServiceLocations,
        getServiceLocationById:
            fetchServiceLocationById,
        createServiceLocation:
            createServiceLocationAction,
        updateServiceLocation:
            updateServiceLocationAction,
        disableServiceLocation:
            disableServiceLocationAction,
        enableServiceLocation:
            enableServiceLocationAction,
        deleteServiceLocation:
            deleteServiceLocationAction,
        clearError: clearErrorAction,
        clearSelectedServiceLocation:
            clearSelectedAction,
    };
};

export default useServiceLocation;
