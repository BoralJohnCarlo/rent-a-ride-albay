import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    getSettings,
    updateSettings,
    clearError,
} from "../../store/settings";


const useSettings = () => {
    const dispatch = useDispatch();

    const {
        settings,
        loading,
        error,
    } = useSelector(
        (state) => state.settings
    );

    const fetchSettings =
        useCallback(
            () =>
                dispatch(
                    getSettings()
                ),
            [dispatch]
        );

    const updateSettingsAction =
        useCallback(
            (settingsData) =>
                dispatch(
                    updateSettings(
                        settingsData
                    )
                ),
            [dispatch]
        );

    const clearErrorAction =
        useCallback(
            () =>
                dispatch(
                    clearError()
                ),
            [dispatch]
        );

    return {
        settings,
        loading,
        error,

        getSettings:
            fetchSettings,
        updateSettings:
            updateSettingsAction,
        clearError:
            clearErrorAction,
    };
};

export default useSettings;
