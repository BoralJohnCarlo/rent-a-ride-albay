import {
    getCustomerRefunds,
    getCustomerRefundById,
    removeCustomerRefund as removeCustomerRefundApi,
    requestCustomerRefund as requestCustomerRefundApi,
    recordBookingRefund as recordBookingRefundApi,
    getRefunds,
    approveRefund as approveRefundApi,
    rejectRefund as rejectRefundApi,
    settleRefund as settleRefundApi,
} from "../api/refundApi";

export const fetchCustomerRefunds = async (params = {}) => {
    return await getCustomerRefunds(params);
};

export const fetchCustomerRefundById = async (id) => {
    return await getCustomerRefundById(id);
};

export const removeCustomerRefund = async (id) => {
    return await removeCustomerRefundApi(id);
};

export const requestCustomerRefund = async (rentalId, refundData) => {
    return await requestCustomerRefundApi(rentalId, refundData);
};

export const recordBookingRefund = async (rentalId, refundData) => {
    return await recordBookingRefundApi(rentalId, refundData);
};

export const fetchRefunds = async (params = {}) => {
    return await getRefunds(params);
};

export const approveRefundRequest = async (rentalId, refundId, amount) => {
    return await approveRefundApi(rentalId, refundId, amount);
};

export const rejectRefundRequest = async (rentalId, refundId, note = "") => {
    return await rejectRefundApi(rentalId, refundId, note);
};

export const settleRefundRequest = async (rentalId, refundId, options = {}) => {
    return await settleRefundApi(rentalId, refundId, options);
};