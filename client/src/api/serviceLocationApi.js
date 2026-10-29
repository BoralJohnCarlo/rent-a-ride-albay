import api from "../lib/axios";

export const getServiceLocations = async () => {
    const { data } = await api.get(
        "/service-locations"
    );

    return data;
};

export const getEnabledServiceLocations =
    async () => {
        const { data } = await api.get(
            "/service-locations/enabled"
        );

        return data;
    };

export const getServiceLocationById =
    async (locationId) => {
        const { data } = await api.get(
            `/service-locations/${locationId}`
        );

        return data;
    };

export const createServiceLocation =
    async (locationData) => {
        const { data } = await api.post(
            "/service-locations",
            locationData
        );

        return data;
    };

export const updateServiceLocation =
    async (locationId, locationData) => {
        const { data } = await api.put(
            `/service-locations/${locationId}`,
            locationData
        );

        return data;
    };

export const disableServiceLocation =
    async (locationId) => {
        const { data } = await api.patch(
            `/service-locations/${locationId}/disable`
        );

        return data;
    };

export const enableServiceLocation =
    async (locationId) => {
        const { data } = await api.patch(
            `/service-locations/${locationId}/enable`
        );

        return data;
    };

export const deleteServiceLocation =
    async (locationId) => {
        const { data } = await api.delete(
            `/service-locations/${locationId}`
        );

        return data;
    };
