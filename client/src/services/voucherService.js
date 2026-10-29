import {
    getVouchers,
    getVoucherById,
    createVoucher,
    updateVoucher,
    deleteVoucher,
    getAvailableVouchers,
    applyVoucher,
    recordVoucherUsage,
} from "../api/voucherApi";

export const fetchVouchers = async (
    filters = {}
) => {
    return await getVouchers(filters);
};

export const fetchVoucherById = async (
    voucherId
) => {
    return await getVoucherById(voucherId);
};

export const createNewVoucher = async (
    voucherData
) => {
    return await createVoucher(voucherData);
};

export const updateExistingVoucher = async (
    voucherId,
    voucherData
) => {
    return await updateVoucher(
        voucherId,
        voucherData
    );
};

export const deleteExistingVoucher = async (
    voucherId
) => {
    return await deleteVoucher(voucherId);
};

export const fetchAvailableVouchers =
    async () => {
        return await getAvailableVouchers();
    };

export const applyExistingVoucher = async (
    code,
    pricing
) => {
    return await applyVoucher(
        code,
        pricing
    );
};

export const recordExistingVoucherUsage =
    async (
        voucherId,
        userId,
        bookingId
    ) => {
        return await recordVoucherUsage(
            voucherId,
            userId,
            bookingId
        );
    };
