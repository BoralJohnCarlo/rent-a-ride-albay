import api from "../lib/axios";

export const createAvailabilityRequest = async (payload) => {
    const { data } = await api.post(
        "/availability-requests",
        payload
    );
    return data;
};

export const getMyAvailabilityRequests = async (
    params = {}
) => {
    const { data } = await api.get(
        "/availability-requests/mine",
        { params }
    );
    return data;
};

export const getAvailabilityRequests = async (
    params = {}
) => {
    const { data } = await api.get(
        "/availability-requests",
        { params }
    );
    return data;
};

export const approveAvailabilityRequest = async (
    id,
    remarks = ""
) => {
    const { data } = await api.put(
        `/availability-requests/${id}/approve`,
        { remarks }
    );
    return data;
};

export const rejectAvailabilityRequest = async (
    id,
    rejectionReason
) => {
    const { data } = await api.put(
        `/availability-requests/${id}/reject`,
        { rejectionReason }
    );
    return data;
};

export const cancelAvailabilityRequest = async (id) => {
    const { data } = await api.delete(
        `/availability-requests/${id}`
    );
    return data;
};
