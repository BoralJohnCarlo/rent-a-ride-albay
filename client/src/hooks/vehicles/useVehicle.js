import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    getVehicles,
    getMyVehicles,
    getVehicleCounts,
    getVehicleById,
    createVehicle,
    updateVehicle,
    archiveVehicle,
    restoreVehicle,
    updateVehicleStatus,
    updateVehicleCondition,
    updateVehicleBooking,
    updateFeaturedVehicle,
    addBlockedVehicleDate,
    removeBlockedVehicleDate,
    renewVehicleRegistrationThunk,
    setVehicleRegistrationAvailabilityThunk,
    getVehicleRegistrationRenewalEligibilityThunk,
    requestVehicleRegistrationRenewalAttemptThunk,
    grantVehicleRegistrationRenewalAttemptThunk,
    clearVehicleError,
    clearSelectedVehicle,
    clearRegistrationRenewalEligibility,
    setVehicleFilters,
    resetVehicleFilters,
} from "../../store/vehicles";

const useVehicle = () => {
    const dispatch = useDispatch();

    const {
        vehicles,
        counts,
        selectedVehicle,
        loading,
        error,
        filters,
        registrationRenewalEligibility,
    } = useSelector(
        (state) => state.vehicles
    );

    const fetchVehicles =
        useCallback(
            (filters = {}) =>
                dispatch(
                    getVehicles(filters)
                ),
            [dispatch]
        );

    const fetchMyVehicles =
        useCallback(
            (filters = {}) =>
                dispatch(
                    getMyVehicles(filters)
                ),
            [dispatch]
        );

    const fetchVehicleById =
        useCallback(
            (vehicleId) =>
                dispatch(
                    getVehicleById(
                        vehicleId
                    )
                ),
            [dispatch]
        );

        const fetchVehicleCounts =
    useCallback(
        (filters = {}) =>
            dispatch(
                getVehicleCounts(filters)
            ),
        [dispatch]
    );

    const createVehicleAction =
        useCallback(
            (vehicleData) =>
                dispatch(
                    createVehicle(
                        vehicleData
                    )
                ),
            [dispatch]
        );

    const updateVehicleAction =
        useCallback(
            (
                vehicleId,
                vehicleData
            ) =>
                dispatch(
                    updateVehicle({
                        vehicleId,
                        vehicleData,
                    })
                ),
            [dispatch]
        );

    const archiveVehicleAction =
        useCallback(
            (
                vehicleId,
                archiveReason = ""
            ) =>
                dispatch(
                    archiveVehicle({
                        vehicleId,
                        archiveReason,
                    })
                ),
            [dispatch]
        );

    const restoreVehicleAction =
        useCallback(
            (vehicleId) =>
                dispatch(
                    restoreVehicle(
                        vehicleId
                    )
                ),
            [dispatch]
        );

    const updateVehicleStatusAction =
        useCallback(
            (
                vehicleId,
                status
            ) =>
                dispatch(
                    updateVehicleStatus({
                        vehicleId,
                        status,
                    })
                ),
            [dispatch]
        );

    const updateVehicleConditionAction =
        useCallback(
            (
                vehicleId,
                condition
            ) =>
                dispatch(
                    updateVehicleCondition({
                        vehicleId,
                        condition,
                    })
                ),
            [dispatch]
        );

    const updateVehicleBookingAction =
        useCallback(
            (
                vehicleId,
                availability
            ) =>
                dispatch(
                    updateVehicleBooking({
                        vehicleId,
                        availability,
                    })
                ),
            [dispatch]
        );

    const updateFeaturedVehicleAction =
        useCallback(
            (
                vehicleId,
                isFeatured
            ) =>
                dispatch(
                    updateFeaturedVehicle({
                        vehicleId,
                        isFeatured,
                    })
                ),
            [dispatch]
        );

    const addBlockedVehicleDateAction =
        useCallback(
            (
                vehicleId,
                blockedDateData
            ) =>
                dispatch(
                    addBlockedVehicleDate({
                        vehicleId,
                        blockedDateData,
                    })
                ),
            [dispatch]
        );

    const removeBlockedVehicleDateAction =
        useCallback(
            (
                vehicleId,
                blockedDateId
            ) =>
                dispatch(
                    removeBlockedVehicleDate({
                        vehicleId,
                        blockedDateId,
                    })
                ),
            [dispatch]
        );

    const renewVehicleRegistrationAction =
        useCallback(
            (
                vehicleId,
                officialReceipt,
                expirationDate
            ) =>
                dispatch(
                    renewVehicleRegistrationThunk({
                        vehicleId,
                        officialReceipt,
                        expirationDate,
                    })
                ),
            [dispatch]
        );

    const setVehicleRegistrationAvailabilityAction =
        useCallback(
            (
                vehicleId,
                availableFrom
            ) =>
                dispatch(
                    setVehicleRegistrationAvailabilityThunk(
                        {
                            vehicleId,
                            availableFrom,
                        }
                    )
                ),
            [dispatch]
        );

    const getVehicleRegistrationRenewalEligibilityAction =
        useCallback(
            (vehicleId) =>
                dispatch(
                    getVehicleRegistrationRenewalEligibilityThunk(
                        vehicleId
                    )
                ),
            [dispatch]
        );

    const requestVehicleRegistrationRenewalAttemptAction =
        useCallback(
            (vehicleId) =>
                dispatch(
                    requestVehicleRegistrationRenewalAttemptThunk(
                        vehicleId
                    )
                ),
            [dispatch]
        );

    const grantVehicleRegistrationRenewalAttemptAction =
        useCallback(
            (
                vehicleId,
                amount
            ) =>
                dispatch(
                    grantVehicleRegistrationRenewalAttemptThunk(
                        {
                            vehicleId,
                            amount,
                        }
                    )
                ),
            [dispatch]
        );

    const clearVehicleErrorAction =
        useCallback(
            () =>
                dispatch(
                    clearVehicleError()
                ),
            [dispatch]
        );

    const clearSelectedVehicleAction =
        useCallback(
            () =>
                dispatch(
                    clearSelectedVehicle()
                ),
            [dispatch]
        );

    const clearRegistrationRenewalEligibilityAction =
        useCallback(
            () =>
                dispatch(
                    clearRegistrationRenewalEligibility()
                ),
            [dispatch]
        );

    const setVehicleFiltersAction =
        useCallback(
            (filters) =>
                dispatch(
                    setVehicleFilters(
                        filters
                    )
                ),
            [dispatch]
        );

    const resetVehicleFiltersAction =
        useCallback(
            () =>
                dispatch(
                    resetVehicleFilters()
                ),
            [dispatch]
        );

    return {
        dispatch,

        // State
        vehicles,
        counts,
        selectedVehicle,
        loading,
        error,
        filters,
        registrationRenewalEligibility,

        // CRUD
        getVehicles:
            fetchVehicles,
        getMyVehicles:
            fetchMyVehicles,
        getVehicleCounts:
            fetchVehicleCounts,
        getVehicleById:
            fetchVehicleById,
        createVehicle:
            createVehicleAction,
        updateVehicle:
            updateVehicleAction,
        

        // Archive
        archiveVehicle:
            archiveVehicleAction,
        restoreVehicle:
            restoreVehicleAction,

        // Updates
        updateVehicleStatus:
            updateVehicleStatusAction,
        updateVehicleCondition:
            updateVehicleConditionAction,
        updateVehicleBooking:
            updateVehicleBookingAction,
        updateFeaturedVehicle:
            updateFeaturedVehicleAction,

        // Availability
        addVehicleBlockedDate:
            addBlockedVehicleDateAction,
        removeVehicleBlockedDate:
            removeBlockedVehicleDateAction,

        // Registration renewal
        renewVehicleRegistration:
            renewVehicleRegistrationAction,
        setVehicleRegistrationAvailability:
            setVehicleRegistrationAvailabilityAction,
        getVehicleRegistrationRenewalEligibility:
            getVehicleRegistrationRenewalEligibilityAction,
        requestVehicleRegistrationRenewalAttempt:
            requestVehicleRegistrationRenewalAttemptAction,
        grantVehicleRegistrationRenewalAttempt:
            grantVehicleRegistrationRenewalAttemptAction,

        // Utilities
        clearVehicleError:
            clearVehicleErrorAction,
        clearSelectedVehicle:
            clearSelectedVehicleAction,
        clearRegistrationRenewalEligibility:
            clearRegistrationRenewalEligibilityAction,
        setVehicleFilters:
            setVehicleFiltersAction,
        resetVehicleFilters:
            resetVehicleFiltersAction,
    };
};

export default useVehicle;