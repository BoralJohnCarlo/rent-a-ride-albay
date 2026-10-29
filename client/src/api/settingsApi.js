import api from "../lib/axios";

export const getSettings = async () => {
    const { data } = await api.get("/settings");

    return data;
};

export const updateSettings = async (settingsData) => {
    const { data } = await api.put("/settings", settingsData);

    return data;
};
