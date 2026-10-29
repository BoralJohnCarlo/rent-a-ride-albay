import api from "../lib/axios";

export const createSupportTicket = async (
    ticketData
) => {
    const { data } = await api.post(
        "/support-tickets",
        ticketData
    );

    return data;
};

export const getMySupportTickets = async (
    params = {}
) => {
    const { data } = await api.get(
        "/support-tickets/mine",
        { params }
    );

    return data;
};

export const getAdminSupportTickets = async (
    params = {}
) => {
    const { data } = await api.get(
        "/support-tickets",
        { params }
    );

    return data;
};

export const getSupportTicketById = async (
    ticketId
) => {
    const { data } = await api.get(
        `/support-tickets/${ticketId}`
    );

    return data;
};

export const replySupportTicket = async (
    ticketId,
    message
) => {
    const { data } = await api.post(
        `/support-tickets/${ticketId}/replies`,
        { message }
    );

    return data;
};

export const markSupportTicketRead = async (
    ticketId
) => {
    const { data } = await api.post(
        `/support-tickets/${ticketId}/read`
    );

    return data;
};

export const getSupportUnreadCount = async () => {
    const { data } = await api.get(
        "/support-tickets/unread-count"
    );

    return data;
};

export const getSupportTicketContext = async (
    ticketId
) => {
    const { data } = await api.get(
        `/support-tickets/${ticketId}/context`
    );

    return data;
};

export const updateSupportTicketStatus = async (
    ticketId,
    status
) => {
    const { data } = await api.patch(
        `/support-tickets/${ticketId}/status`,
        { status }
    );

    return data;
};
