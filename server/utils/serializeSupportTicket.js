import { SUPPORT_SENDER_ROLE } from "../constants/supportTicketConstants.js";

const fullName = (person) =>
    [person?.firstName, person?.lastName]
        .filter(Boolean)
        .join(" ");

/*
 * Shapes a populated SupportTicket for one side of the conversation.
 *
 * Customers only ever see "Support" on staff messages - never which admin
 * replied or that admin's email - so staff senders are stripped to null.
 * The admin-side counters (unreadForAdmin) are dropped too; adminLastReadAt
 * stays because it drives the customer's "Seen" receipt.
 *
 * Admins get each staff message's agent name so several admins working the
 * same inbox can tell who said what.
 */
export const serializeSupportTicket = (ticket, role) => {
    if (!ticket) {
        return null;
    }

    const plain =
        typeof ticket.toObject === "function"
            ? ticket.toObject()
            : { ...ticket };

    const messages = (plain.messages || []).map((entry) => {
        const isCustomerMessage =
            entry.senderRole === SUPPORT_SENDER_ROLE.CUSTOMER;

        if (role === SUPPORT_SENDER_ROLE.ADMIN) {
            return {
                ...entry,
                agentName: isCustomerMessage
                    ? null
                    : fullName(entry.sender) || "Support",
            };
        }

        return {
            ...entry,
            sender: isCustomerMessage ? entry.sender : null,
        };
    });

    if (role === SUPPORT_SENDER_ROLE.ADMIN) {
        return { ...plain, messages };
    }

    const { unreadForAdmin, ...customerView } = plain;

    return { ...customerView, messages };
};

export default serializeSupportTicket;
