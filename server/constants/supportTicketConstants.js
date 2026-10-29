export const SUPPORT_TICKET_STATUS = {
    OPEN: "Open",
    IN_PROGRESS: "In Progress",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
};

export const SUPPORT_TICKET_STATUS_VALUES =
    Object.values(SUPPORT_TICKET_STATUS);

export const SUPPORT_TICKET_CATEGORY = {
    BOOKING: "Booking",
    VEHICLE: "Vehicle",
    PAYMENT: "Payment",
    ACCOUNT: "Account",
    TECHNICAL: "Technical",
    GENERAL: "General",
};

export const SUPPORT_TICKET_CATEGORY_VALUES =
    Object.values(SUPPORT_TICKET_CATEGORY);

export const SUPPORT_TICKET_CODE_PREFIX = "TCK-";

export const SUPPORT_SENDER_ROLE = {
    CUSTOMER: "customer",
    ADMIN: "admin",
};

// Realtime support-chat events (see sockets/supportEvents.js).
export const SUPPORT_TICKET_EVENT = "support:ticket";
export const SUPPORT_TYPING_EVENT = "support:typing";
export const SUPPORT_READ_EVENT = "support:read";
