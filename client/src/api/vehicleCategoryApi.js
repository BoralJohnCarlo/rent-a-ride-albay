import api from "../lib/axios";

export const getVehicleCategories = async (
    params = {}
) => {
    const { data } = await api.get(
        "/vehicle-categories",
        {
            params,
        }
    );

    return data;
};

export const getVehicleCategoryById = async (
    categoryId
) => {
    const { data } = await api.get(
        `/vehicle-categories/${categoryId}`
    );

    return data;
};

export const createVehicleCategory = async (
    categoryData
) => {
    const { data } = await api.post(
        "/vehicle-categories",
        categoryData
    );

    return data;
};

export const updateVehicleCategory = async (
    categoryId,
    categoryData
) => {
    const { data } = await api.patch(
        `/vehicle-categories/${categoryId}`,
        categoryData
    );

    return data;
};

export const updateVehicleCategoryStatus = async (
    categoryId,
    status
) => {
    const { data } = await api.patch(
        `/vehicle-categories/${categoryId}/status`,
        {
            status,
        }
    );

    return data;
};

export const deleteVehicleCategory = async (
    categoryId
) => {
    const { data } = await api.delete(
        `/vehicle-categories/${categoryId}`
    );

    return data;
};