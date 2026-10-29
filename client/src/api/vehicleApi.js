import api from "../lib/axios";

export const getVehicles = async (params = {}) => {
    const { data } = await api.get(
        "/vehicles",
        {
            params,
        }
    );

    return data;
};

export const getVehicleCounts = async (
    params = {}
) => {
    const { data } = await api.get(
        "/vehicles/counts",
        {
            params,
        }
    );

    return data;
};

export const getVehicleById = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}`
    );

    return data;
};

export const createVehicle = async (
    vehicleData
) => {
    const { data } = await api.post(
        "/vehicles",
        vehicleData
    );

    return data;
};

export const updateVehicle = async (
    vehicleId,
    vehicleData
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}`,
        vehicleData
    );

    return data;
};

export const archiveVehicle = async (
    vehicleId,
    archiveReason = ""
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/archive`,
        {
            archiveReason,
        }
    );

    return data;
};

export const restoreVehicle = async (
    vehicleId
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/restore`
    );

    return data;
};

export const updateVehicleStatus = async (
    vehicleId,
    status
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/status`,
        {
            status,
        }
    );

    return data;
};

export const updateVehicleCondition = async (
    vehicleId,
    condition
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/condition`,
        {
            condition,
        }
    );

    return data;
};

export const updateVehicleBooking = async (
    vehicleId,
    availability
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/booking`,
        availability
    );

    return data;
};

export const getVehicleAvailability = async (
    vehicleId
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/availability`
    );

    return data;
};

export const checkVehicleAvailability = async (
    vehicleId,
    startDate,
    endDate
) => {
    const { data } = await api.get(
        `/vehicles/${vehicleId}/availability/check`,
        {
            params: {
                startDate,
                endDate,
            },
        }
    );

    return data;
};

export const addVehicleBlockedDate = async (
    vehicleId,
    blockedDateData
) => {
    const { data } = await api.post(
        `/vehicles/${vehicleId}/blocked-dates`,
        blockedDateData
    );

    return data;
};

export const removeVehicleBlockedDate = async (
    vehicleId,
    blockedDateId
) => {
    const { data } = await api.delete(
        `/vehicles/${vehicleId}/blocked-dates/${blockedDateId}`
    );

    return data;
};

export const updateFeaturedVehicle = async (
    vehicleId,
    isFeatured
) => {
    const { data } = await api.patch(
        `/vehicles/${vehicleId}/featured`,
        {
            isFeatured,
        }
    );

    return data;
};

export const uploadVehicleImage = async (
    file
) => {
    const formData = new FormData();

    formData.append("image", file);

    const { data } = await api.post(
        "/vehicles/upload-image",
        formData,
        {
            headers: {
                "Content-Type":
                    undefined,
            },
        }
    );

    return data;
};