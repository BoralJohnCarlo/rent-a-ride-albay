import {
    getDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    updateDriverStatus,
    updateDriverAvailability,
    archiveDriver,
    restoreDriver,
} from "../api/driverApi";


export const fetchDrivers = async (
    filters = {}
) => {
    return await getDrivers(filters);
};


export const fetchDriverById = async (
    driverId
) => {
    return await getDriverById(driverId);
};


export const createNewDriver = async (
    driverData
) => {
    return await createDriver(driverData);
};


export const updateExistingDriver = async (
    driverId,
    driverData
) => {
    return await updateDriver(
        driverId,
        driverData
    );
};


export const changeDriverStatus = async (
    driverId,
    status
) => {
    return await updateDriverStatus(
        driverId,
        status
    );
};


export const changeDriverAvailability =
    async (
        driverId,
        availability
    ) => {
        return await updateDriverAvailability(
            driverId,
            availability
        );
    };


export const archiveExistingDriver = async (
    driverId,
    reason = ""
) => {
    return await archiveDriver(
        driverId,
        reason
    );
};


export const restoreExistingDriver = async (
    driverId
) => {
    return await restoreDriver(driverId);
};