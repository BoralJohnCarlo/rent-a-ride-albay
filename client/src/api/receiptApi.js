import api from "../lib/axios";

export const getReceipt = async (receiptId) => {
    const { data } = await api.get(`/receipts/${receiptId}`);

    return data;
};

export const getBookingStatement = async (bookingId) => {
    const { data } = await api.get(`/receipts/statements/${bookingId}`);

    return data;
};
