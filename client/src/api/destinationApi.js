import api from "../lib/axios";

/* { destinations, heroWidget } — active destinations for /explore and the
   three shown in the home hero's Albay widget. */
export const getPublicDestinations = async () => {
    const { data } = await api.get("/destinations/public");

    return data;
};

export const getAllDestinations = async () => {
    const { data } = await api.get("/destinations");

    return data;
};

export const createDestination = async (destinationData) => {
    const { data } = await api.post("/destinations", destinationData);

    return data;
};

export const updateDestination = async (id, destinationData) => {
    const { data } = await api.put(
        `/destinations/${id}`,
        destinationData
    );

    return data;
};

export const reorderDestinations = async (ids) => {
    const { data } = await api.put("/destinations/reorder", { ids });

    return data;
};

export const deleteDestination = async (id) => {
    const { data } = await api.delete(`/destinations/${id}`);

    return data;
};

export const uploadDestinationImage = async (file) => {
    const formData = new FormData();

    formData.append("image", file);

    const { data } = await api.post(
        "/destinations/upload-image",
        formData,
        {
            headers: {
                "Content-Type": undefined,
            },
        }
    );

    return data;
};
