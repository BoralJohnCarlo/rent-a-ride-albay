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

    registrationexpired: {
        label: "Registration Expired",
        variant: "danger",
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

    // A refund owed by hand (Payments → Owed Refunds).
    owed: {
        label: "Owed",
        variant: "warning",
    },

    "not paid": {
        label: "Not Paid",
        variant: "danger",
    },

    refunded: {
        label: "Refunded",
        variant: "info",
    },

    failed: {
        label: "Failed",
        variant: "danger",
    },

    passed: {
        label: "Passed",
        variant: "success",
    },

    "conditional pass": {
        label: "Conditional Pass",
        variant: "warning",
    },

    active: {
        label: "Active",
        variant: "success",
    },

    inactive: {
        label: "Inactive",
        variant: "default",
    },

    unassigned: {
        label: "Unassigned",
        variant: "secondary",
    },

    suspended: {
        label: "Suspended",
        variant: "danger",
    },

    operator: {
        label: "Partner",
        variant: "info",
    },

    approved: {
        label: "Approved",
        variant: "success",
    },

    rejected: {
        label: "Rejected",
        variant: "danger",
    },

    "no show": {
        label: "No Show",
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

    // A booking whose vehicle has been handed over — the trip is under way.
    ongoing: {
        label: "Ongoing",
        variant: "primary",
    },

    withdrawn: {
        label: "Withdrawn",
        variant: "danger",
    },

    archived: {
        label: "Archived",
        variant: "default",
    },

    processing: {
        label: "Processing",
        variant: "warning",
    },

    succeeded: {
        label: "Succeeded",
        variant: "success",
    },

    requires_manual_action: {
        label: "Requires Manual Action",
        variant: "danger",
    },

    open: {
        label: "Open",
        variant: "warning",
    },

    "in progress": {
        label: "In Progress",
        variant: "info",
    },

    resolved: {
        label: "Resolved",
        variant: "success",
    },

    closed: {
        label: "Closed",
        variant: "default",
    },
};

// Statuses that represent an in-progress / awaiting-action state.
// These get an animated pulsing dot so they read as "live".
const LIVE_STATUSES = new Set([
    "pending",
    "submitted",
    "under review",
    "revision requested",
    "payment received",
    "ongoing",
    "active",
    "rented",
    "processing",
    "requires_manual_action",
    "open",
    "in progress",
]);

const StatusChip = ({
    status,
    className = "",
    size = "md",
    dot = true,
    pulse,
    icon,
    animate = true,
}) => {
    const key = status?.toLowerCase();

    const config = STATUS_MAP[key] || {
        label: status || "Unknown",
        variant: "default",
    };

    const shouldPulse =
        pulse ?? LIVE_STATUSES.has(key);

    return (
        <Badge
            variant={config.variant}
            size={size}
            dot={dot}
            pulse={shouldPulse}
            icon={icon}
            animate={animate}
            className={className}
        >
            {config.label}
        </Badge>
    );
};

export default StatusChip;