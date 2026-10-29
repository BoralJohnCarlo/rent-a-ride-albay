import {
    createSupportTicket,
    getMySupportTickets,
    getAdminSupportTickets,
    getSupportTicketById,
    replySupportTicket,
    markSupportTicketRead,
    getSupportUnreadCount,
    getSupportTicketContext,
    updateSupportTicketStatus,
} from "../api/supportTicketApi";

export const submitSupportTicket = async (
    ticketData
) => {
    return await createSupportTicket(
        ticketData
    );
};

export const fetchMySupportTickets = async (
    params
) => {
    return await getMySupportTickets(params);
};

export const fetchAdminSupportTickets = async (
    params
) => {
    return await getAdminSupportTickets(params);
};

export const fetchSupportTicketById = async (
    ticketId
) => {
    return await getSupportTicketById(ticketId);
};

export const sendSupportTicketReply = async (
    ticketId,
    message
) => {
    return await replySupportTicket(
        ticketId,
        message
    );
};

export const readSupportTicket = async (
    ticketId
) => {
    return await markSupportTicketRead(ticketId);
};

export const fetchSupportUnreadCount = async () => {
    return await getSupportUnreadCount();
};

export const fetchSupportTicketContext = async (
    ticketId
) => {
    return await getSupportTicketContext(ticketId);
};

export const changeSupportTicketStatus = async (
    ticketId,
    status
) => {
    return await updateSupportTicketStatus(
        ticketId,
        status
    );
};
