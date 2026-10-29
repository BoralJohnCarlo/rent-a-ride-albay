import api from "../lib/axios";

export const getSettings = async () => {
    const { data } = await api.get("/settings");

    return data;
};

export const getPublicSettings = async () => {
    const { data } = await api.get("/settings/public");

    return data;
};

export const updateSettings = async (settingsData) => {
    const { data } = await api.put("/settings", settingsData);

    return data;
};

/* Hero background video (Settings → Themes & Display). Uploading applies it
   immediately; `onProgress` receives 0–100 as the file is sent. */
export const uploadHeroVideo = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("video", file);

    const { data } = await api.post("/settings/hero-video", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
            if (onProgress && event.total) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        },
    });

    return data;
};

export const resetHeroVideo = async () => {
    const { data } = await api.delete("/settings/hero-video");

    return data;
};

/* Hero still image (Settings → Themes & Display, Image mode). */
export const uploadHeroImage = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("image", file);

    const { data } = await api.post("/settings/hero-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
            if (onProgress && event.total) {
                onProgress(Math.round((event.loaded / event.total) * 100));
            }
        },
    });

    return data;
};

export const resetHeroImage = async () => {
    const { data } = await api.delete("/settings/hero-image");

    return data;
};
