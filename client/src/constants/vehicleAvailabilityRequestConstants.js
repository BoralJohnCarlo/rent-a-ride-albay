export const AVAILABILITY_REQUEST_REASON = {
    MAINTENANCE: "Maintenance",
    PERSONAL_USE: "Personal Use",
    REPAIR_SERVICE: "Repair / Service",
    OTHERS: "Others",
};

export const AVAILABILITY_REQUEST_REASON_OPTIONS = [
    {
        label: "Select a reason",
        value: "",
    },
    ...Object.values(AVAILABILITY_REQUEST_REASON).map(
        (value) => ({
            label: value,
            value,
        })
    ),
];

export const AVAILABILITY_REQUEST_STATUS = {
    PENDING: "Pending",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
};
