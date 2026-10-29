import {
    createPayment,
    verifyPayment,
    cancelPayment,
    getPaymentById,
    getPayments,
    createCheckout,
    reconcilePayment,
    reconcilePaymentRefund,
    sendPaymentRefund,
    completePaymentRefund,
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

export const reconcileExistingPayment = async (
    paymentId
) => {
    return await reconcilePayment(paymentId);
};

export const reconcileExistingPaymentRefund = async (
    paymentId
) => {
    return await reconcilePaymentRefund(paymentId);
};

export const sendExistingPaymentRefund = async (
    paymentId
) => {
    return await sendPaymentRefund(paymentId);
};

export const completeExistingPaymentRefund = async (
    paymentId,
    options = {}
) => {
    return await completePaymentRefund(
        paymentId,
        options
    );
};
