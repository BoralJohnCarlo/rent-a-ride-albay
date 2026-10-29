export const AVAILABILITY_REQUEST_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};

export const AVAILABILITY_REQUEST_STATUS_VALUES = Object.values(
    AVAILABILITY_REQUEST_STATUS
);

export const AVAILABILITY_REQUEST_REASON = {
    MAINTENANCE: "Maintenance",
    PERSONAL_USE: "Personal Use",
    REPAIR_SERVICE: "Repair / Service",
    OTHERS: "Others",
};

export const AVAILABILITY_REQUEST_REASON_VALUES = Object.values(
    AVAILABILITY_REQUEST_REASON
);

export const MAX_AVAILABILITY_REQUEST_DATE_RANGES = 20;
