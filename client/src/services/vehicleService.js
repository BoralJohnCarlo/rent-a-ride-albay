import {
    getVehicles,
    getVehicleCounts,
    getVehicleById,
    createVehicle,
    updateVehicle,
    archiveVehicle,
    restoreVehicle,
    updateVehicleStatus,
    updateVehicleCondition,
    updateVehicleBooking,
    getVehicleAvailability,
    checkVehicleAvailability as checkVehicleAvailabilityApi,
    addVehicleBlockedDate,
    removeVehicleBlockedDate,
    updateFeaturedVehicle,
    uploadVehicleImage as uploadVehicleImageApi,
} from "../api/vehicleApi";


export const fetchVehicles = async (
    filters = {}
) => {
    return await getVehicles(filters);
};


export const fetchVehicleCounts = async (
    filters = {}
) => {
    return await getVehicleCounts(filters);
};


export const fetchVehicleById = async (
    vehicleId
) => {
    return await getVehicleById(vehicleId);
};


export const createNewVehicle = async (
    vehicleData
) => {
    return await createVehicle(vehicleData);
};


export const updateExistingVehicle = async (
    vehicleId,
    vehicleData
) => {
    return await updateVehicle(
        vehicleId,
        vehicleData
    );
};


export const archiveExistingVehicle = async (
    vehicleId,
    archiveReason = ""
) => {
    return await archiveVehicle(
        vehicleId,
        archiveReason
    );
};


export const restoreExistingVehicle = async (
    vehicleId
) => {
    return await restoreVehicle(vehicleId);
};


export const changeVehicleStatus = async (
    vehicleId,
    status
) => {
    return await updateVehicleStatus(
        vehicleId,
        status
    );
};


export const changeVehicleCondition = async (
    vehicleId,
    condition
) => {
    return await updateVehicleCondition(
        vehicleId,
        condition
    );
};


export const changeVehicleBooking = async (
    vehicleId,
    availability
) => {
    return await updateVehicleBooking(
        vehicleId,
        availability
    );
};


export const fetchVehicleAvailability = async (
    vehicleId
) => {
    return await getVehicleAvailability(
        vehicleId
    );
};


export const checkVehicleAvailability = async (
    vehicleId,
    startDate,
    endDate
) => {
    return await checkVehicleAvailabilityApi(
        vehicleId,
        startDate,
        endDate
    );
};


export const addBlockedVehicleDate = async (
    vehicleId,
    blockedDateData
) => {
    return await addVehicleBlockedDate(
        vehicleId,
        blockedDateData
    );
};


export const removeBlockedVehicleDate = async (
    vehicleId,
    blockedDateId
) => {
    return await removeVehicleBlockedDate(
        vehicleId,
        blockedDateId
    );
};


export const changeFeaturedVehicle = async (
    vehicleId,
    isFeatured
) => {
    return await updateFeaturedVehicle(
        vehicleId,
        isFeatured
    );
};


export const uploadVehicleImage = async (
    file
) => {
    return await uploadVehicleImageApi(
        file
    );
};