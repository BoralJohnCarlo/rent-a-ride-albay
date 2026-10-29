import { useDispatch, useSelector } from "react-redux";

import {
    getVehicleCategories,
    getVehicleCategoryById,
    createVehicleCategory,
    updateVehicleCategory,
    updateVehicleCategoryStatus,
    deleteVehicleCategory,
    clearVehicleCategoryError,
    clearSelectedVehicleCategory,
    setVehicleCategoryFilters,
    resetVehicleCategoryFilters,
} from "../../store/categories";

const useVehicleCategory = () => {
    const dispatch = useDispatch();

    const {
        vehicleCategories,
        selectedVehicleCategory,
        loading,
        error,
        filters,
    } = useSelector(
        (state) => state.categories
    );

    return {
        dispatch,

        vehicleCategories,
        selectedVehicleCategory,
        loading,
        error,
        filters,

        getVehicleCategories: (
            filters = {}
        ) =>
            dispatch(
                getVehicleCategories(filters)
            ),

        getVehicleCategoryById: (
            categoryId
        ) =>
            dispatch(
                getVehicleCategoryById(
                    categoryId
                )
            ),

        createVehicleCategory: (
            categoryData
        ) =>
            dispatch(
                createVehicleCategory(
                    categoryData
                )
            ),

        updateVehicleCategory: (
            categoryId,
            categoryData
        ) =>
            dispatch(
                updateVehicleCategory({
                    categoryId,
                    categoryData,
                })
            ),

        updateVehicleCategoryStatus: (
            categoryId,
            status
        ) =>
            dispatch(
                updateVehicleCategoryStatus({
                    categoryId,
                    status,
                })
            ),

        deleteVehicleCategory: (
            categoryId
        ) =>
            dispatch(
                deleteVehicleCategory(
                    categoryId
                )
            ),

        clearVehicleCategoryError: () =>
            dispatch(
                clearVehicleCategoryError()
            ),

        clearSelectedVehicleCategory:
            () =>
                dispatch(
                    clearSelectedVehicleCategory()
                ),

        setVehicleCategoryFilters: (
            filters
        ) =>
            dispatch(
                setVehicleCategoryFilters(
                    filters
                )
            ),

        resetVehicleCategoryFilters:
            () =>
                dispatch(
                    resetVehicleCategoryFilters()
                ),
    };
};

export default useVehicleCategory;