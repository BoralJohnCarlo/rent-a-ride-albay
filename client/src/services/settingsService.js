import {
    getSettings,
    getPublicSettings,
    updateSettings,
} from "../api/settingsApi";


export const fetchSettings =
    async () => {
        return await getSettings();
    };


export const fetchPublicSettings =
    async () => {
        return await getPublicSettings();
    };


export const updateSettingsAction =
    async (settingsData) => {
        return await updateSettings(
            settingsData
        );
    };
