// Deliberate allowlists: routine notifications remain in the in-app inbox.
const events = {
    customer: ["Booking Approved", "Booking Rejected", "Booking Cancelled", "Booking Cancelled — Full Refund", "Payment Failed", "Booking Payment Reminder", "Refund Processed", "Refund Sent", "Payment Refunded", "Late Payment Refunded", "Maintenance Conflict Reminder", "Late Return Conflict", "Late Return Impact", "Action Needed: Your Vehicle Is Unavailable", "Rental Extension Approved", "Rental Extension Rejected", "Booking Rescheduled"],
    operator: ["Consignment Reviewed", "Consignment Approved", "Consignment Inspection Scheduled", "Consignment Reschedule Approved", "Consignment Reschedule Rejected", "Inspection Appointment Reminder", "Vehicle Maintenance", "Vehicle Registration Expired", "Vehicle Registration Expiring Soon", "Payout Paid", "Payout Rejected", "Scheduled Payout Release Failed", "Earnings Credited to Your Wallet", "Re-verification Needed", "ID Verification Revoked"],
    admin: ["New Booking Request", "Booking Approval Overdue", "Booking Approval Due Soon", "Booking Not Picked Up", "Booking No-Show Skipped", "Late Return Detected", "Late Return Conflict", "Maintenance Conflict", "Maintenance Conflict Reminder", "Refund Requires Manual Action", "Refund Requires Approval", "Refund Requested", "Refund Failed", "Refund Sync Failed", "New Payout Request", "Scheduled Payout Release Failed", "Consignment Submitted", "Consignment Reschedule Requested", "Renewed Valid ID to Review", "Valid ID Renewal Request"],
};

events.customer.push("Upcoming Pickup", "Rental Return Reminder", "Rental Overdue", "Your Booking Is Back On");
events.customer.push("Boundary Trip Approved", "Boundary Trip Revoked");
events.operator.push("Withdrawal Completed", "Withdrawal Failed", "Rental Overdue");
events.admin.push("vehicleRegistrationRenewalRequest", "Vehicle Registration Expired", "Vehicle Registration Expiring Soon", "Reschedule Requested", "Rental Extension Requested");
for (const role of ["customer", "operator", "admin"]) events[role].push("Boundary Alert");

export const shouldPush = (role, notification) =>
    !notification.pushCancelled &&
    // Maintenance completion stays in-app; only an interruption needs a push.
    !(notification.type === "Vehicle Maintenance" && notification.title === "Vehicle Back in Service") &&
    (events[role] || []).some((event) => event === notification.type || event === notification.title);

export const pushPath = (role, notification) => {
    if (role === "admin" && notification.type === "Boundary Alert") return "/admin/settings/penalties";
    const id = String(notification.metadata?.relatedId || "");
    if (role === "customer" && notification.metadata?.relatedModel === "Booking" && /^[a-f\d]{24}$/i.test(id)) return `/customer/bookings/${id}`;
    // The inbox already resolves categories to the correct role-specific screens.
    return `/${role}/notifications`;
};

// Only established browser push providers are accepted; never fetch arbitrary URLs.
export const validPushSubscription = (value) => {
    try {
        const url = new URL(value.endpoint);
        const hosts = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "wns.windows.com", "notify.windows.com"];
        return url.protocol === "https:" && !url.username && !url.password && !url.port && !url.hash && value.endpoint.length <= 2048 &&
            hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) &&
            /^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh) && /^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth);
    } catch { return false; }
};
