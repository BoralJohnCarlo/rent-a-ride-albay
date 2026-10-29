import {
    useCallback,
} from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getVouchers,
    getVoucherById,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    getAvailableVouchers,
    applyVoucher,
    clearVoucherError,
    clearSelectedVoucher,
    clearAppliedVoucher,
    setVoucherFilters,
    resetVoucherFilters,
} from "../../store/promotions";


/*
 * Admin create/update/delete are unwrapped: they resolve with the server
 * response and throw { message, errors } on failure. Previously a rejected
 * request still resolved, so the page reported "Voucher created" for
 * vouchers the server had refused.
 */
const useVoucher = () => {
    const dispatch =
        useDispatch();

    const {
        vouchers,
        selectedVoucher,
        availableVouchers,
        appliedVoucher,
        loading,
        error,
        filters,
    } = useSelector(
        (state) =>
            state.promotions
    );


    const fetchVouchers =
        useCallback(
            (voucherFilters = {}) =>
                dispatch(
                    getVouchers(
                        voucherFilters
                    )
                ),
            [dispatch]
        );


    const fetchVoucherById =
        useCallback(
            (voucherId) =>
                dispatch(
                    getVoucherById(
                        voucherId
                    )
                ),
            [dispatch]
        );


    const addVoucher =
        useCallback(
            (voucherData) =>
                dispatch(
                    createVoucher(
                        voucherData
                    )
                ).unwrap(),
            [dispatch]
        );


    const editVoucher =
        useCallback(
            (
                voucherId,
                voucherData
            ) =>
                dispatch(
                    updateVoucher({
                        voucherId,
                        voucherData,
                    })
                ).unwrap(),
            [dispatch]
        );


    const removeVoucher =
        useCallback(
            (voucherId) =>
                dispatch(
                    deleteVoucher(
                        voucherId
                    )
                ).unwrap(),
            [dispatch]
        );


    const fetchAvailableVouchers =
        useCallback(
            () =>
                dispatch(
                    getAvailableVouchers()
                ),
            [dispatch]
        );


    const applyExistingVoucher =
        useCallback(
            (
                code,
                pricing
            ) =>
                dispatch(
                    applyVoucher({
                        code,
                        pricing,
                    })
                ),
            [dispatch]
        );


    const clearError =
        useCallback(
            () =>
                dispatch(
                    clearVoucherError()
                ),
            [dispatch]
        );


    const clearSelected =
        useCallback(
            () =>
                dispatch(
                    clearSelectedVoucher()
                ),
            [dispatch]
        );


    const clearAppliedVoucherAction =
        useCallback(
            () =>
                dispatch(
                    clearAppliedVoucher()
                ),
            [dispatch]
        );


    const updateFilters =
        useCallback(
            (filterUpdates) =>
                dispatch(
                    setVoucherFilters(
                        filterUpdates
                    )
                ),
            [dispatch]
        );


    const resetFilters =
        useCallback(
            () =>
                dispatch(
                    resetVoucherFilters()
                ),
            [dispatch]
        );


    return {
        vouchers,
        selectedVoucher,
        availableVouchers,
        appliedVoucher,
        loading,
        error,
        filters,

        fetchVouchers,
        fetchVoucherById,
        addVoucher,
        editVoucher,
        removeVoucher,
        fetchAvailableVouchers,
        applyExistingVoucher,

        clearError,
        clearSelected,
        clearAppliedVoucherAction,

        updateFilters,
        resetFilters,
    };
};


export default useVoucher;
