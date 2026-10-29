import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
    connectTestDb,
    disconnectTestDb,
    clearCollections,
    createTestVehicle,
    adminId,
    uniqueImei,
} from "../helpers/testDb.js";

import Alert from "../../models/Alert.js";
import Tracker from "../../models/Tracker.js";
import {
    evaluateTelemetryAlerts,
    detectOfflineTrackers,
} from "../../services/alertService.js";
import {
    createTracker,
    disableTracker,
    unassignTracker,
} from "../../services/trackerService.js";
import { ingestTelemetry } from "../../services/trackingService.js";
import { normalizeTelemetryPayload } from "../../services/telemetryNormalizationService.js";
import {
    ALERT_TYPE,
    ALERT_STATUS,
    GPS_STALE_THRESHOLD_MS,
} from "../../constants/alertConstants.js";

const staleLastSeen = () =>
    new Date(Date.now() - GPS_STALE_THRESHOLD_MS - 60 * 1000);

// A tracker that last communicated long enough ago to count as offline.
// `archiveVehicleAfterAssign` models legacy data: a vehicle archived while a
// tracker was still assigned (assigning to an archived vehicle is refused).
const makeStaleTracker = async ({ archiveVehicleAfterAssign = false } = {}) => {
    const vehicleId = await createTestVehicle();
    const created = await createTracker(
        { imei: uniqueImei(), vehicle: vehicleId },
        adminId
    );

    await Tracker.updateOne(
        { _id: created._id },
        { $set: { lastSeenAt: staleLastSeen() } }
    );

    if (archiveVehicleAfterAssign) {
        await Tracker.db
            .collection("vehicles")
            .updateOne({ _id: vehicleId }, { $set: { status: "Archived" } });
    }

    return { vehicleId, trackerId: created._id };
};

const offlineAlertCount = (vehicleId) =>
    Alert.countDocuments({
        vehicle: vehicleId,
        type: ALERT_TYPE.GPS_OFFLINE,
        status: ALERT_STATUS.ACTIVE,
    });

describe("alertService", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    describe("duplicate prevention", () => {
        it("concurrent evaluations create exactly one ACTIVE alert", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            const tracker = await Tracker.findById(created._id);
            const lostReading = normalizeTelemetryPayload({
                latitude: 13,
                longitude: 123,
                gpsFix: false,
            });

            await Promise.all(
                Array.from({ length: 8 }, () =>
                    evaluateTelemetryAlerts(tracker, lostReading)
                )
            );

            assert.equal(
                await Alert.countDocuments({
                    vehicle: vehicleId,
                    type: ALERT_TYPE.GPS_LOST,
                    status: ALERT_STATUS.ACTIVE,
                }),
                1
            );
        });

        it("the database itself refuses a second ACTIVE alert of the same type", async () => {
            const vehicleId = await createTestVehicle();
            const doc = {
                vehicle: vehicleId,
                type: ALERT_TYPE.GPS_LOST,
                severity: "warning",
                title: "t",
                message: "m",
            };

            await Alert.create(doc);
            await assert.rejects(Alert.create(doc), { code: 11000 });

            // Resolved alerts don't count against the constraint.
            await Alert.updateMany({}, { status: ALERT_STATUS.RESOLVED });
            await Alert.create(doc);
            assert.equal(await Alert.countDocuments(), 2);
        });

        it("ACTIVE -> RESOLVED -> a new ACTIVE alert on recurrence", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            const tracker = await Tracker.findById(created._id);
            const withBattery = (batteryLevel) =>
                normalizeTelemetryPayload({
                    latitude: 13,
                    longitude: 123,
                    batteryLevel,
                });

            await evaluateTelemetryAlerts(tracker, withBattery(5));
            await evaluateTelemetryAlerts(tracker, withBattery(5));
            await evaluateTelemetryAlerts(tracker, withBattery(90));
            await evaluateTelemetryAlerts(tracker, withBattery(5));

            const alerts = await Alert.find({
                vehicle: vehicleId,
                type: ALERT_TYPE.LOW_BATTERY,
            }).lean();

            assert.equal(alerts.length, 2);
            assert.equal(
                alerts.filter((a) => a.status === ALERT_STATUS.ACTIVE).length,
                1
            );
        });
    });

    describe("offline sweep", () => {
        it("raises GPS_OFFLINE for a stale, active, assigned tracker - once", async () => {
            const { vehicleId } = await makeStaleTracker();

            await detectOfflineTrackers();
            await detectOfflineTrackers();

            assert.equal(await offlineAlertCount(vehicleId), 1);
        });

        it("skips disabled trackers", async () => {
            const { vehicleId, trackerId } = await makeStaleTracker();
            await disableTracker(trackerId, adminId);

            await detectOfflineTrackers();

            assert.equal(await offlineAlertCount(vehicleId), 0);
        });

        it("skips unassigned trackers", async () => {
            const { vehicleId, trackerId } = await makeStaleTracker();
            await unassignTracker(trackerId, adminId);

            await detectOfflineTrackers();

            assert.equal(await offlineAlertCount(vehicleId), 0);
            assert.equal(await Alert.countDocuments(), 0);
        });

        it("skips archived vehicles", async () => {
            const { vehicleId } = await makeStaleTracker({
                archiveVehicleAfterAssign: true,
            });

            await detectOfflineTrackers();

            assert.equal(await offlineAlertCount(vehicleId), 0);
        });

        it("skips trackers that have never communicated", async () => {
            const vehicleId = await createTestVehicle();
            await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );

            await detectOfflineTrackers();

            assert.equal(await offlineAlertCount(vehicleId), 0);
        });

        it("communication resuming resolves GPS_OFFLINE, even with no GPS fix", async () => {
            const { vehicleId, trackerId } = await makeStaleTracker();
            await detectOfflineTrackers();
            assert.equal(await offlineAlertCount(vehicleId), 1);

            await ingestTelemetry(
                await Tracker.findById(trackerId),
                normalizeTelemetryPayload({
                    latitude: 13,
                    longitude: 123,
                    gpsFix: false,
                })
            );

            assert.equal(await offlineAlertCount(vehicleId), 0);
            // No fix is GPS_LOST, a separate condition from being offline.
            assert.equal(
                await Alert.countDocuments({
                    vehicle: vehicleId,
                    type: ALERT_TYPE.GPS_LOST,
                    status: ALERT_STATUS.ACTIVE,
                }),
                1
            );
        });
    });
});
