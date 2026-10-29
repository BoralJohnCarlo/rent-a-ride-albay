import {
    getSettings,
    updateSettings,
} from "../api/settingsApi";


export const fetchSettings =
    async () => {
        return await getSettings();
    };


export const updateSettingsAction =
    async (settingsData) => {
        return await updateSettings(
            settingsData
        );
    };
