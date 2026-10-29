import {
    createWithdrawal,
    getMyWithdrawals,
    getAllWithdrawals,
} from "../api/withdrawalApi";

export const submitWithdrawal = async (
    withdrawalData
) => {
    return await createWithdrawal(withdrawalData);
};

export const fetchMyWithdrawals = async (
    params
) => {
    return await getMyWithdrawals(params);
};

export const fetchAllWithdrawals = async (
    params
) => {
    return await getAllWithdrawals(params);
};
