import {
    getServiceLocations,
    getEnabledServiceLocations,
    getServiceLocationById,
    createServiceLocation,
    updateServiceLocation,
    disableServiceLocation,
    enableServiceLocation,
    deleteServiceLocation,
} from "../api/serviceLocationApi";


export const fetchServiceLocations =
    async () => {
        return await getServiceLocations();
    };


export const fetchEnabledServiceLocations =
    async () => {
        return await getEnabledServiceLocations();
    };


export const fetchServiceLocationById =
    async (locationId) => {
        return await getServiceLocationById(
            locationId
        );
    };


export const createNewServiceLocation =
    async (locationData) => {
        return await createServiceLocation(
            locationData
        );
    };


export const updateExistingServiceLocation =
    async (locationId, locationData) => {
        return await updateServiceLocation(
            locationId,
            locationData
        );
    };


export const disableServiceLocationAction =
    async (locationId) => {
        return await disableServiceLocation(
            locationId
        );
    };


export const enableServiceLocationAction =
    async (locationId) => {
        return await enableServiceLocation(
            locationId
        );
    };


export const deleteServiceLocationAction =
    async (locationId) => {
        return await deleteServiceLocation(
            locationId
        );
    };
