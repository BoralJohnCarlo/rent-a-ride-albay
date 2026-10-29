import {
    createPayment,
    verifyPayment,
    rejectPayment,
    cancelPayment,
    getPaymentById,
    getPayments,
    createCheckout,
} from "../api/paymentApi";

export const fetchPayments = async (
    filters = {}
) => {
    return await getPayments(filters);
};

export const fetchPaymentById = async (
    paymentId
) => {
    return await getPaymentById(paymentId);
};

export const createNewPayment = async (
    bookingId,
    paymentMethod
) => {
    return await createPayment(
        bookingId,
        paymentMethod
    );
};

export const verifyExistingPayment = async (
    paymentId,
    force = false
) => {
    return await verifyPayment(
        paymentId,
        force
    );
};

export const rejectExistingPayment = async (
    paymentId,
    reason
) => {
    return await rejectPayment(
        paymentId,
        reason
    );
};

export const cancelExistingPayment = async (
    paymentId
) => {
    return await cancelPayment(paymentId);
};

export const createNewCheckout = async (
    paymentId,
    force = false
) => {
    return await createCheckout(
        paymentId,
        force
    );
};
