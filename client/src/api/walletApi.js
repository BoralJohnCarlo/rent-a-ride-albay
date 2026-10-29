import api from "../lib/axios";

export const getMyWallet = async (
    params = {}
) => {
    const { data } = await api.get("/wallet", {
        params,
    });

    return data;
};

export const getOperatorWallet = async (
    operatorId,
    params = {}
) => {
    const { data } = await api.get(
        `/wallet/${operatorId}`,
        { params }
    );

    return data;
};
