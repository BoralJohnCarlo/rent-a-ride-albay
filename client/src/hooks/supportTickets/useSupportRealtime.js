import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";

import useSocket from "../shared/useSocket";

import {
    supportReadReceived,
    supportTicketReceived,
} from "../../store/supportTickets/supportTicketSlice";

import {
    SUPPORT_READ_EVENT,
    SUPPORT_TICKET_EVENT,
    SUPPORT_TYPING_EVENT,
} from "../../constants/supportTicketConstants";

// A typing flag with no refresh for this long is treated as stopped (a
// closed tab never sends typing:false).
const TYPING_STALE_MS = 6000;

/*
 * Live support chat over the app's shared Socket.IO connection: keeps the
 * store in step with new messages, status changes and read receipts, and
 * tracks who is typing in which conversation.
 *
 * `onEvent` runs after every ticket/read event so pages can refresh things
 * the event doesn't carry (inbox counts, a filtered list, badges).
 */
const useSupportRealtime = ({ onEvent } = {}) => {
    const dispatch = useDispatch();
    const { socket, connected, reconnecting } = useSocket();

    const [typing, setTyping] = useState({});
    const timers = useRef({});
    const onEventRef = useRef(onEvent);

    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);

    const clearTyping = useCallback((ticketId) => {
        clearTimeout(timers.current[ticketId]);
        delete timers.current[ticketId];

        setTyping((current) => {
            if (!current[ticketId]) {
                return current;
            }

            const next = { ...current };
            delete next[ticketId];
            return next;
        });
    }, []);

    useEffect(() => {
        const handleTicket = (ticket) => {
            dispatch(supportTicketReceived(ticket));

            // Whoever was typing most likely just sent this.
            clearTyping(ticket?._id);
            onEventRef.current?.({ type: "ticket", ticket });
        };

        const handleRead = (event) => {
            dispatch(supportReadReceived(event));
            onEventRef.current?.({ type: "read", ...event });
        };

        const handleTyping = (event) => {
            const ticketId = event?.ticketId;

            if (!ticketId) {
                return;
            }

            if (!event.typing) {
                clearTyping(ticketId);
                return;
            }

            setTyping((current) => ({
                ...current,
                [ticketId]: {
                    role: event.role,
                    agentId: event.agentId || null,
                    agentName: event.agentName || null,
                },
            }));

            clearTimeout(timers.current[ticketId]);
            timers.current[ticketId] = setTimeout(
                () => clearTyping(ticketId),
                TYPING_STALE_MS
            );
        };

        socket.on(SUPPORT_TICKET_EVENT, handleTicket);
        socket.on(SUPPORT_READ_EVENT, handleRead);
        socket.on(SUPPORT_TYPING_EVENT, handleTyping);

        return () => {
            socket.off(SUPPORT_TICKET_EVENT, handleTicket);
            socket.off(SUPPORT_READ_EVENT, handleRead);
            socket.off(SUPPORT_TYPING_EVENT, handleTyping);
        };
    }, [socket, dispatch, clearTyping]);

    useEffect(() => {
        const pending = timers.current;

        return () => {
            Object.values(pending).forEach(clearTimeout);
        };
    }, []);

    const emitTyping = useCallback(
        (ticketId, isTyping) => {
            if (!ticketId || !socket.connected) {
                return;
            }

            socket.emit(SUPPORT_TYPING_EVENT, {
                ticketId,
                typing: Boolean(isTyping),
            });
        },
        [socket]
    );

    return {
        connected,
        reconnecting,
        typing,
        emitTyping,
    };
};

export default useSupportRealtime;
