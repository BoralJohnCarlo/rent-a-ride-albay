import api from "../lib/axios";

export const createPayment = async (
    bookingId,
    paymentMethod
) => {
    const { data } = await api.post(
        "/payments",
        {
            bookingId,
            paymentMethod,
        }
    );

    return data;
};

export const verifyPayment = async (
    paymentId,
    force = false
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/verify`,
        { force }
    );

    return data;
};

export const cancelPayment = async (
    paymentId
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/cancel`
    );

    return data;
};

export const reportPaymentFailure = async (
    paymentId
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/report-failure`
    );

    return data;
};

export const reconcilePayment = async (
    paymentId
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/reconcile`
    );

    return data;
};

export const getPaymentById = async (
    paymentId
) => {
    const { data } = await api.get(
        `/payments/${paymentId}`
    );

    return data;
};

export const getPayments = async (
    filters = {}
) => {
    const { data } = await api.get(
        "/payments",
        {
            params: filters,
        }
    );

    return data;
};

export const createCheckout = async (
    paymentId,
    force = false
) => {
    const { data } = await api.post(
        `/payments/${paymentId}/checkout`,
        { force }
    );

    return data;
};

export const reconcilePaymentRefund = async (
    paymentId
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/refund/reconcile`
    );

    return data;
};

export const sendPaymentRefund = async (
    paymentId
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/refund/send`
    );

    return data;
};

export const completePaymentRefund = async (
    paymentId,
    { succeeded = true, notes = "" } = {}
) => {
    const { data } = await api.patch(
        `/payments/${paymentId}/refund/complete`,
        { succeeded, notes }
    );

    return data;
};
