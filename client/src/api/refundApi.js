import api from "../lib/axios";

export const getCustomerRefunds = async (
    params = {}
) => {
    const { data } = await api.get(
        "/refunds/customer",
        {
            params,
        }
    );

    return data;
};

export const getCustomerRefundById = async (
    id
) => {
    const { data } = await api.get(
        `/refunds/customer/${id}`
    );

    return data;
};

export const removeCustomerRefund = async (
    id
) => {
    const { data } = await api.delete(
        `/refunds/customer/${id}`
    );

    return data;
};

export const requestCustomerRefund = async (
    rentalId,
    refundData
) => {
    const { data } = await api.post(
        `/refunds/customer/${rentalId}/refunds`,
        refundData
    );

    return data;
};

export const recordBookingRefund = async (
    rentalId,
    refundData
) => {
    const { data } = await api.post(
        `/refunds/${rentalId}/refunds`,
        refundData
    );

    return data;
};

export const getRefunds = async (
    params = {}
) => {
    const { data } = await api.get(
        "/refunds",
        {
            params,
        }
    );

    return data;
};

export const approveRefund = async (
    rentalId,
    refundId,
    amount
) => {
    const { data } = await api.post(
        `/refunds/${rentalId}/refunds/${refundId}/approve`,
        amount != null ? { amount } : {}
    );

    return data;
};

/*
 * Confirms a refund that had to be paid outside the app (or couldn't be).
 * `succeeded` defaults to true.
 */
export const settleRefund = async (
    rentalId,
    refundId,
    { succeeded = true, notes = "" } = {}
) => {
    const { data } = await api.post(
        `/refunds/${rentalId}/refunds/${refundId}/settle`,
        { succeeded, notes }
    );

    return data;
};

export const rejectRefund = async (
    rentalId,
    refundId,
    note = ""
) => {
    const { data } = await api.post(
        `/refunds/${rentalId}/refunds/${refundId}/reject`,
        { note }
    );

    return data;
};
/*
 * Refunds owed by hand — ones no payment could carry, e.g. a cancellation
 * after the reservation payment was already partly refunded by a reschedule.
 */
export const getOwedRefunds = async (params = {}) => {
    const { data } = await api.get("/refunds/owed", { params });

    return data;
};

export const settleOwedRefund = async (
    id,
    { succeeded = true, notes = "" } = {}
) => {
    const { data } = await api.post(`/refunds/owed/${id}/settle`, {
        succeeded,
        notes,
    });

    return data;
};
