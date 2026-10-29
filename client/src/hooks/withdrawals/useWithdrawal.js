import { useCallback } from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    createWithdrawal,
    getMyWithdrawals,
    getAllWithdrawals,
    clearWithdrawalError,
} from "../../store/withdrawals/withdrawalSlice";

const useWithdrawal = () => {
    const dispatch = useDispatch();

    const {
        withdrawals,
        pagination,
        loading,
        error,
    } = useSelector((state) => state.withdrawals);

    const submitWithdrawal = useCallback(
        (withdrawalData) =>
            dispatch(
                createWithdrawal(withdrawalData)
            ).unwrap(),
        [dispatch]
    );

    const fetchMyWithdrawals = useCallback(
        (params) =>
            dispatch(
                getMyWithdrawals(params)
            ).unwrap(),
        [dispatch]
    );

    const fetchAllWithdrawals = useCallback(
        (params) =>
            dispatch(
                getAllWithdrawals(params)
            ).unwrap(),
        [dispatch]
    );

    const clearError = useCallback(
        () => dispatch(clearWithdrawalError()),
        [dispatch]
    );

    return {
        withdrawals,
        pagination,
        loading,
        error,

        submitWithdrawal,
        fetchMyWithdrawals,
        fetchAllWithdrawals,

        clearError,
    };
};

export default useWithdrawal;
