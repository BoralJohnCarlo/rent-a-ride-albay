import api from "../lib/axios";

export const getPendingVehicles = async (params = {}) => {
    const { data } = await api.get("/pending-vehicles", { params });
    return data;
};

export const getMyPendingVehicles = async (params = {}) => {
    const { data } = await api.get("/pending-vehicles/mine", { params });
    return data;
};

export const getPendingVehicleById = async (id) => {
    const { data } = await api.get(`/pending-vehicles/${id}`);
    return data;
};

export const updatePendingVehicleStatus = async (id, statusData) => {
    const { data } = await api.put(`/pending-vehicles/${id}/status`, statusData);
    return data;
};

export const getPendingVehicleCounts = async () => {
    const { data } = await api.get("/pending-vehicles/counts");
    return data;
};

export const updatePendingVehicle = async (id, updateData) => {
    const { data } = await api.put(`/pending-vehicles/${id}`, updateData);
    return data;
};