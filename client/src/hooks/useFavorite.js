import {
    useCallback,
    useEffect,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getFavorites,
    addOrRemoveFavorite,
    checkVehicleFavorite,
    clearFavoriteError,
    clearFavorites,
    setFavoriteIds,
} from "../store/favorites";


const useFavorite = () => {
    const dispatch = useDispatch();

    const {
        favorites,
        favoriteIds,
        loading,
        error,
    } = useSelector(
        (state) =>
            state.favorites ??
            {}
    );

    const fetchUserFavorites =
        useCallback(
            () =>
                dispatch(
                    getFavorites()
                ),
            [dispatch]
        );

    const toggleVehicleFavoriteStatus =
        useCallback(
            (vehicleId) =>
                dispatch(
                    addOrRemoveFavorite(
                        vehicleId
                    )
                ),
            [dispatch]
        );

    const checkIfFavorited =
        useCallback(
            (vehicleId) =>
                dispatch(
                    checkVehicleFavorite(
                        vehicleId
                    )
                ),
            [dispatch]
        );

    const clearError =
        useCallback(
            () =>
                dispatch(
                    clearFavoriteError()
                ),
            [dispatch]
        );

    const resetFavorites =
        useCallback(
            () =>
                dispatch(
                    clearFavorites()
                ),
            [dispatch]
        );

    const updateFavoriteIds =
        useCallback(
            (ids) =>
                dispatch(
                    setFavoriteIds(ids)
                ),
            [dispatch]
        );

    const isFavorited =
        useCallback(
            (vehicleId) =>
                favoriteIds.includes(
                    vehicleId
                ),
            [favoriteIds]
        );

    return {
        favorites,
        favoriteIds,
        loading,
        error,
        fetchUserFavorites,
        toggleVehicleFavoriteStatus,
        checkIfFavorited,
        clearError,
        resetFavorites,
        updateFavoriteIds,
        isFavorited,
    };
};


const useFavoriteEffect = (
    shouldFetch = true
) => {
    const {
        fetchUserFavorites,
    } = useFavorite();

    useEffect(() => {
        if (!shouldFetch) {
            return;
        }

        void fetchUserFavorites();
    }, [shouldFetch, fetchUserFavorites]);
};


export {
    useFavorite,
    useFavoriteEffect,
};

export default useFavorite;
