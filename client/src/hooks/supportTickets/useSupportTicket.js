import { useCallback } from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";

import {
    createTicket,
    getMyTickets,
    getAdminTickets,
    getTicketById,
    replyToTicket,
    markTicketRead,
    getSupportUnread,
    updateTicketStatus,
    clearSupportTicketError,
    clearSelectedTicket,
} from "../../store/supportTickets/supportTicketSlice";

const useSupportTicket = () => {
    const dispatch = useDispatch();

    const {
        tickets,
        pagination,
        counts,
        unreadCount,
        selectedTicket,
        loading,
        threadLoading,
        error,
    } = useSelector(
        (state) => state.supportTickets
    );

    const submitTicket = useCallback(
        (ticketData) =>
            dispatch(
                createTicket(ticketData)
            ).unwrap(),
        [dispatch]
    );

    const fetchMyTickets = useCallback(
        (params) =>
            dispatch(
                getMyTickets(params)
            ).unwrap(),
        [dispatch]
    );

    const fetchAdminTickets = useCallback(
        (params) =>
            dispatch(
                getAdminTickets(params)
            ).unwrap(),
        [dispatch]
    );

    const fetchTicketById = useCallback(
        (ticketId) =>
            dispatch(
                getTicketById(ticketId)
            ).unwrap(),
        [dispatch]
    );

    const sendReply = useCallback(
        (ticketId, message) =>
            dispatch(
                replyToTicket({
                    ticketId,
                    message,
                })
            ).unwrap(),
        [dispatch]
    );

    const markRead = useCallback(
        (ticketId) =>
            dispatch(
                markTicketRead(ticketId)
            ).unwrap(),
        [dispatch]
    );

    const fetchUnreadCount = useCallback(
        () =>
            dispatch(
                getSupportUnread()
            ).unwrap(),
        [dispatch]
    );

    const changeStatus = useCallback(
        (ticketId, status) =>
            dispatch(
                updateTicketStatus({
                    ticketId,
                    status,
                })
            ).unwrap(),
        [dispatch]
    );

    const clearError = useCallback(
        () => dispatch(clearSupportTicketError()),
        [dispatch]
    );

    const clearSelected = useCallback(
        () => dispatch(clearSelectedTicket()),
        [dispatch]
    );

    return {
        tickets,
        pagination,
        counts,
        unreadCount,
        selectedTicket,
        loading,
        threadLoading,
        error,

        submitTicket,
        fetchMyTickets,
        fetchAdminTickets,
        fetchTicketById,
        sendReply,
        markRead,
        fetchUnreadCount,
        changeStatus,

        clearError,
        clearSelected,
    };
};

export default useSupportTicket;
