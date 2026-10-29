import { useEffect } from "react";

const UNREAD_FIELD = {
    customer: "unreadForCustomer",
    admin: "unreadForAdmin",
};

/*
 * While a conversation is open and the tab is visible, anything new in it
 * counts as read - clears this side's badge and gives the other side its
 * "Seen" receipt. Re-checks when the tab comes back into view.
 */
const useAutoMarkRead = (ticket, viewerRole, markRead) => {
    const ticketId = ticket?._id;
    const unread = ticket?.[UNREAD_FIELD[viewerRole]] || 0;

    useEffect(() => {
        if (!ticketId || unread <= 0) {
            return undefined;
        }

        const markIfVisible = () => {
            if (document.visibilityState === "visible") {
                markRead(ticketId).catch(() => {
                    // Quiet: the badge just stays until the next attempt.
                });
            }
        };

        markIfVisible();
        document.addEventListener("visibilitychange", markIfVisible);

        return () => {
            document.removeEventListener("visibilitychange", markIfVisible);
        };
    }, [ticketId, unread, markRead]);
};

export default useAutoMarkRead;
