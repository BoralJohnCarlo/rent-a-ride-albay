import api from "../lib/axios";

export const getVouchers = async (
    params = {}
) => {
    const { data } = await api.get(
        "/vouchers",
        {
            params,
        }
    );

    return data;
};

export const getVoucherById = async (
    voucherId
) => {
    const { data } = await api.get(
        `/vouchers/${voucherId}`
    );

    return data;
};

export const createVoucher = async (
    voucherData
) => {
    const { data } = await api.post(
        "/vouchers",
        voucherData
    );

    return data;
};

export const updateVoucher = async (
    voucherId,
    voucherData
) => {
    const { data } = await api.patch(
        `/vouchers/${voucherId}`,
        voucherData
    );

    return data;
};

export const deleteVoucher = async (
    voucherId
) => {
    const { data } = await api.delete(
        `/vouchers/${voucherId}`
    );

    return data;
};

export const getAvailableVouchers =
    async () => {
        const { data } = await api.get(
            "/vouchers/available"
        );

        return data;
    };

export const applyVoucher = async (
    code,
    pricing
) => {
    const { data } = await api.post(
        "/vouchers/apply",
        {
            code,
            pricing,
        }
    );

    return data;
};

export const recordVoucherUsage = async (
    voucherId,
    userId,
    bookingId
) => {
    const { data } = await api.post(
        `/vouchers/${voucherId}/usage`,
        {
            userId,
            bookingId,
        }
    );

    return data;
};
