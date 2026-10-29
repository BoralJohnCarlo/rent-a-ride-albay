import { getIO } from "./index.js";
import { ADMIN_ROOM, userRoom } from "./rooms.js";

import {
    SUPPORT_READ_EVENT,
    SUPPORT_SENDER_ROLE,
    SUPPORT_TICKET_EVENT,
} from "../constants/supportTicketConstants.js";

import { serializeSupportTicket } from "../utils/serializeSupportTicket.js";

const customerIdOf = (ticket) =>
    String(ticket.customer?._id ?? ticket.customer);

/*
 * Pushes the latest state of a (populated) ticket to both sides of the
 * conversation - the customer's own room gets the customer-shaped payload,
 * the admin room the admin-shaped one - so open chats and inbox lists update
 * without a refetch.
 */
export const broadcastSupportTicket = (ticket) => {
    const io = getIO();

    if (!io || !ticket) {
        return;
    }

    io.to(userRoom(customerIdOf(ticket))).emit(
        SUPPORT_TICKET_EVENT,
        serializeSupportTicket(ticket, SUPPORT_SENDER_ROLE.CUSTOMER)
    );

    io.to(ADMIN_ROOM).emit(
        SUPPORT_TICKET_EVENT,
        serializeSupportTicket(ticket, SUPPORT_SENDER_ROLE.ADMIN)
    );
};

/*
 * One side opened the conversation: the other side flips its last message
 * to "Seen", and other admin tabs clear their unread badge for it.
 */
export const broadcastSupportRead = ({
    ticketId,
    customerId,
    role,
    readAt,
}) => {
    const io = getIO();

    if (!io) {
        return;
    }

    io.to(userRoom(String(customerId)))
        .to(ADMIN_ROOM)
        .emit(SUPPORT_READ_EVENT, {
            ticketId: String(ticketId),
            role,
            readAt,
        });
};
