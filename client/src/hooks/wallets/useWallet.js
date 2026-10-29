import { useCallback } from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    getMyWallet,
    getOperatorWallet,
    clearWalletError,
} from "../../store/wallets/walletSlice";

const useWallet = () => {
    const dispatch = useDispatch();

    const {
        wallet,
        transactions,
        pagination,
        loading,
        error,
    } = useSelector((state) => state.wallets);

    const fetchMyWallet = useCallback(
        (params) =>
            dispatch(getMyWallet(params)).unwrap(),
        [dispatch]
    );

    const fetchOperatorWallet = useCallback(
        (operatorId, params) =>
            dispatch(
                getOperatorWallet({ operatorId, params })
            ).unwrap(),
        [dispatch]
    );

    const clearError = useCallback(
        () => dispatch(clearWalletError()),
        [dispatch]
    );

    return {
        wallet,
        transactions,
        pagination,
        loading,
        error,

        fetchMyWallet,
        fetchOperatorWallet,

        clearError,
    };
};

export default useWallet;
