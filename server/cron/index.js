import cron from "node-cron";

import { cleanupExpiredTemporaryValidIdUploads } from "../services/temporaryValidIdUploadService.js";
import { checkAllValidIdExpirations } from "../services/userService.js";
import { sendRentalReturnReminders } from "../services/rentalService.js";
import { sendInspectionAppointmentReminders } from "../services/consignmentService.js";
import {
    expireUnpaidBookings,
    markNoShowBookings,
    alertUnapprovedBookings,
    expireLapsedUnapprovedBookings,
    processMaintenanceConflicts,
} from "../services/bookingService.js";
import { endExpiredVehicleMaintenance } from "../services/vehicleMaintenanceService.js";
import { detectLateReturnConflicts } from "../services/lateReturnConflictService.js";
import {
    reconcilePendingRefunds,
    reconcileClosedCheckouts,
} from "../services/paymentService.js";
import { releaseScheduledPayouts } from "../services/payoutService.js";
import {
    autoExpireVehicleRegistrations,
    checkAllVehicleRegistrationExpirations,
} from "../services/vehicleService.js";
import { detectOfflineTrackers } from "../services/alertService.js";
import { broadcastNewAlert } from "../sockets/broadcastAlerts.js";
import { startAikaPoller } from "../services/aika/aikaPoller.js";

/*
 * All recurring background sweeps for the app, in one place. Each entry runs
 * on its own cron schedule (server time) and is independent of the others —
 * a failure in one never blocks or delays another.
 */
const SWEEPS = [
    {
        label: "Temporary valid ID cleanup",
        task: cleanupExpiredTemporaryValidIdUploads,
        // Every 15 minutes.
        cronExpression: "*/15 * * * *",
    },
    {
        label: "Valid ID expiration check",
        task: checkAllValidIdExpirations,
        // Once a day at 03:00 server time.
        cronExpression: "0 3 * * *",
    },
    {
        label: "Rental return reminder sweep",
        task: sendRentalReturnReminders,
        // Every hour, on the hour.
        cronExpression: "0 * * * *",
    },
    {
        label: "Unpaid booking sweep",
        task: expireUnpaidBookings,
        // Every 10 minutes: an unpaid booking's deadline can be its pickup
        // time, so it must be released close to that, not up to an hour late.
        cronExpression: "5-59/10 * * * *",
    },
    {
        label: "Unapproved booking alert sweep",
        task: alertUnapprovedBookings,
        // Every 10 minutes, offset from the unpaid sweep: alerts admins
        // when a paid booking nears (or passes) its pickup unapproved.
        cronExpression: "8-59/10 * * * *",
    },
    {
        label: "No-show booking sweep",
        task: markNoShowBookings,
        // Every hour, offset from the other hourly sweeps. Marks Approved
        // bookings not picked up by the end of their start date.
        cronExpression: "20 * * * *",
    },
    {
        label: "Lapsed unapproved booking sweep",
        task: expireLapsedUnapprovedBookings,
        // Every hour, offset from the other hourly sweeps. Expires (and fully
        // refunds) bookings never approved before their rental period ended.
        cronExpression: "25 * * * *",
    },
    {
        label: "Vehicle conflict sweep",
        // Every 10 minutes, offset from the booking sweeps: ends maintenance
        // windows that have run out (the vehicle is back in service), flags
        // bookings put at risk by late returns (heads-up, then options once
        // the vehicle can't be ready in time), then auto-refunds conflicts
        // past their deadline and sends the reminders.
        task: async () => {
            await endExpiredVehicleMaintenance();
            await detectLateReturnConflicts();
            await processMaintenanceConflicts();
        },
        cronExpression: "2-59/10 * * * *",
    },
    {
        label: "Inspection appointment reminder sweep",
        task: sendInspectionAppointmentReminders,
        // Every hour, offset from the other hourly sweeps above.
        cronExpression: "15 * * * *",
    },
    {
        label: "Refund reconcile sweep",
        task: reconcilePendingRefunds,
        // Every 30 minutes — refund settlement is normally fast, so this is
        // just a fallback for a webhook that never arrived.
        cronExpression: "*/30 * * * *",
    },
    {
        label: "Closed checkout reconcile sweep",
        task: reconcileClosedCheckouts,
        // Every 30 minutes, offset from the refund sweep above — a safety net
        // for a payment made on a checkout left open after its booking ended
        // (see reconcileClosedCheckouts).
        cronExpression: "10,40 * * * *",
    },
    {
        label: "Scheduled payout release sweep",
        task: releaseScheduledPayouts,
        // Every 15 minutes — releases operator payouts whose hold period
        // (Settings > Payout Rules > payoutHoldHours) has elapsed.
        cronExpression: "*/15 * * * *",
    },
    {
        label: "Vehicle registration auto-expire sweep",
        task: autoExpireVehicleRegistrations,
        // Once a day at 03:00 server time.
        cronExpression: "0 3 * * *",
    },
    {
        label: "Vehicle registration expiration reminder sweep",
        task: checkAllVehicleRegistrationExpirations,
        // 10 minutes after the auto-expire sweep above, so a vehicle that
        // just expired gets today's "expired" notice rather than a stale
        // "expiring soon" one.
        cronExpression: "10 3 * * *",
    },
    {
        label: "GPS offline detection sweep",
        // Telemetry ingestion can't detect the *absence* of telemetry by
        // itself, so this is the one place GPS_OFFLINE alerts are created -
        // a single controlled periodic scan, not a timer per tracker.
        task: async () => {
            const created = await detectOfflineTrackers();
            created.forEach(broadcastNewAlert);
        },
        cronExpression: "* * * * *", // every minute
    },
];

const runSweep = (label, task) =>
    Promise.resolve()
        .then(task)
        .catch((error) =>
            console.error(`${label} failed:`, error)
        );

/*
 * Register every scheduled job. Each one also runs once ~30s after boot (so a
 * freshly restarted/redeployed server is not blind until its first scheduled
 * tick) and then on its cron expression.
 */
export const startScheduledJobs = () => {
    SWEEPS.forEach(({ label, task, cronExpression }) => {
        setTimeout(
            () => runSweep(label, task),
            30 * 1000
        ).unref();

        cron.schedule(cronExpression, () =>
            runSweep(label, task)
        );
    });

    // Sub-minute interval with its own backoff, so it runs its own loop
    // rather than a cron entry. No-op unless AIKA_ENABLED=true.
    startAikaPoller();
};
