import Badge from "./Badge";

const STATUS_MAP = {
    available: {
        label: "Available",
        variant: "success",
    },

    rented: {
        label: "Rented",
        variant: "info",
    },

    maintenance: {
        label: "Maintenance",
        variant: "warning",
    },

    unavailable: {
        label: "Unavailable",
        variant: "danger",
    },

    pending: {
        label: "Pending",
        variant: "warning",
    },

    submitted: {
        label: "Submitted",
        variant: "info",
    },

    verified: {
        label: "Verified",
        variant: "success",
    },

    confirmed: {
        label: "Confirmed",
        variant: "success",
    },

    completed: {
        label: "Completed",
        variant: "success",
    },

    cancelled: {
        label: "Cancelled",
        variant: "danger",
    },

    paid: {
        label: "Paid",
        variant: "success",
    },

    refunded: {
        label: "Refunded",
        variant: "info",
    },

    failed: {
        label: "Failed",
        variant: "danger",
    },

    active: {
        label: "Active",
        variant: "success",
    },

    inactive: {
        label: "Inactive",
        variant: "default",
    },

    suspended: {
        label: "Suspended",
        variant: "danger",
    },

    approved: {
        label: "Approved",
        variant: "success",
    },

    rejected: {
        label: "Rejected",
        variant: "danger",
    },

    draft: {
        label: "Draft",
        variant: "secondary",
    },

    "under review": {
        label: "Under Review",
        variant: "info",
    },

    "revision requested": {
        label: "Revision Requested",
        variant: "warning",
    },

    "payment received": {
        label: "Payment Received",
        variant: "info",
    },

    withdrawn: {
        label: "Withdrawn",
        variant: "danger",
    },

    archived: {
        label: "Archived",
        variant: "default",
    },
};

const StatusChip = ({
    status,
    className = "",
    size = "md",
}) => {
    const config =
        STATUS_MAP[status?.toLowerCase()] || {
            label: status || "Unknown",
            variant: "default",
        };

    return (
        <Badge
            variant={config.variant}
            size={size}
            className={className}
        >
            {config.label}
        </Badge>
    );
};

export default StatusChip;