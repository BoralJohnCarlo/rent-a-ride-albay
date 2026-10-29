import {
    getVehicleCategories,
    getVehicleCategoryById,
    createVehicleCategory,
    updateVehicleCategory,
    updateVehicleCategoryStatus,
    deleteVehicleCategory,
} from "../api/vehicleCategoryApi";

export const fetchVehicleCategories = async (
    filters = {}
) => {
    return await getVehicleCategories(filters);
};

export const fetchVehicleCategoryById = async (
    categoryId
) => {
    return await getVehicleCategoryById(categoryId);
};

export const createNewVehicleCategory = async (
    categoryData
) => {
    return await createVehicleCategory(categoryData);
};

export const updateExistingVehicleCategory = async (
    categoryId,
    categoryData
) => {
    return await updateVehicleCategory(
        categoryId,
        categoryData
    );
};

export const changeVehicleCategoryStatus = async (
    categoryId,
    status
) => {
    return await updateVehicleCategoryStatus(
        categoryId,
        status
    );
};

export const removeVehicleCategory = async (
    categoryId
) => {
    return await deleteVehicleCategory(categoryId);
};