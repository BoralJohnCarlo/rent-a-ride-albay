import api from "../lib/axios";

export const createWithdrawal = async (
    withdrawalData
) => {
    const { data } = await api.post(
        "/withdrawals",
        withdrawalData
    );

    return data;
};

export const getMyWithdrawals = async (
    params = {}
) => {
    const { data } = await api.get(
        "/withdrawals/mine",
        { params }
    );

    return data;
};

export const getAllWithdrawals = async (
    params = {}
) => {
    const { data } = await api.get(
        "/withdrawals",
        { params }
    );

    return data;
};
