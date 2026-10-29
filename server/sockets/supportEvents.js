import mongoose from "mongoose";

import SupportTicket from "../models/SupportTicket.js";

import { ADMIN_ROOM, userRoom } from "./rooms.js";

import {
    SUPPORT_SENDER_ROLE,
    SUPPORT_TICKET_STATUS,
    SUPPORT_TYPING_EVENT,
} from "../constants/supportTicketConstants.js";

/*
 * Typing indicators for support chat. Nothing is persisted; the server
 * checks the sender may see the ticket, then relays to the other side only
 * (socket.to excludes the sender). Customers see "Support is typing", never
 * an agent's name; other admins see which agent is typing so two people
 * don't answer the same customer at once.
 */
export const registerSupportEvents = (socket) => {
    socket.on(SUPPORT_TYPING_EVENT, async (payload) => {
        try {
            const ticketId = payload?.ticketId;

            if (!ticketId || !mongoose.isValidObjectId(ticketId)) {
                return;
            }

            const ticket = await SupportTicket.findById(ticketId)
                .select("customer status")
                .lean();

            if (
                !ticket ||
                ticket.status === SUPPORT_TICKET_STATUS.CLOSED
            ) {
                return;
            }

            const isAdmin = socket.user?.role === "admin";
            const customerId = String(ticket.customer);

            if (!isAdmin && customerId !== String(socket.user?._id)) {
                return;
            }

            const event = {
                ticketId: String(ticketId),
                typing: Boolean(payload?.typing),
            };

            if (isAdmin) {
                socket.to(userRoom(customerId)).emit(SUPPORT_TYPING_EVENT, {
                    ...event,
                    role: SUPPORT_SENDER_ROLE.ADMIN,
                });

                socket.to(ADMIN_ROOM).emit(SUPPORT_TYPING_EVENT, {
                    ...event,
                    role: SUPPORT_SENDER_ROLE.ADMIN,
                    agentId: String(socket.user._id),
                    agentName:
                        [socket.user.firstName, socket.user.lastName]
                            .filter(Boolean)
                            .join(" ") || "An admin",
                });

                return;
            }

            socket.to(ADMIN_ROOM).emit(SUPPORT_TYPING_EVENT, {
                ...event,
                role: SUPPORT_SENDER_ROLE.CUSTOMER,
            });
        } catch (error) {
            console.error("Support typing relay failed:", error);
        }
    });
};
