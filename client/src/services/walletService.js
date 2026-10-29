import {
    getMyWallet,
    getOperatorWallet,
} from "../api/walletApi";

export const fetchMyWallet = async (params) => {
    return await getMyWallet(params);
};

export const fetchOperatorWallet = async (
    operatorId,
    params
) => {
    return await getOperatorWallet(
        operatorId,
        params
    );
};
