import api from "../lib/axios";

export const getPayoutRequests = async (params = {}) => {
    const { data } = await api.get("/payouts", { params });
    return data;
};

export const getPayoutRequestById = async (id) => {
    const { data } = await api.get(`/payouts/${id}`);
    return data;
};

export const getPayoutRequestsByOperator = async (params = {}) => {
    const { data } = await api.get("/payouts/my", { params });
    return data;
};

export const getOperatorPayoutSummary = async () => {
    const { data } = await api.get("/payouts/my/summary");
    return data;
};

export const getPayoutStats = async () => {
    const { data } = await api.get("/payouts/stats");
    return data;
};

export const approvePayout = async (id) => {
    const { data } = await api.put(`/payouts/${id}/approve`);
    return data;
};

export const rejectPayout = async (id, reason) => {
    const { data } = await api.put(`/payouts/${id}/reject`, { reason });
    return data;
};

export const markPayoutAsPaid = async (id, paidVia) => {
    const { data } = await api.put(`/payouts/${id}/pay`, { paidVia });
    return data;
};

export const cancelPayout = async (
    id,
    reason = ""
) => {
    const { data } = await api.delete(
        `/payouts/${id}`,
        { data: { reason } }
    );
    return data;
};

export const getPayoutSettings = async () => {
    const { data } = await api.get("/payouts/settings");
    return data;
};

export const updatePayoutSettings = async (settingsData) => {
    const { data } = await api.put("/payouts/settings", settingsData);
    return data;
};

export const createPayoutRequest = async (payoutData) => {
    const { data } = await api.post("/payouts/request", payoutData);
    return data;
};