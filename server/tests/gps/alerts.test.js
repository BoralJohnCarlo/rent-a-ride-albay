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
import Vehicle from "../../models/Vehicle.js";
import VehicleTrackingState from "../../models/VehicleTrackingState.js";
import {
    evaluateTelemetryAlerts,
    detectOfflineTrackers,
} from "../../services/alertService.js";
import {
    createTracker,
    disableTracker,
    unassignTracker,
} from "../../services/trackerService.js";
import { ingestTelemetry, recordHeartbeat } from "../../services/trackingService.js";
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

            await VehicleTrackingState.create({ vehicle: vehicleId, tracker: tracker._id, ...lostReading });
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

            for (const level of [5, 5, 90, 5]) {
                const reading = withBattery(level);
                await VehicleTrackingState.findOneAndUpdate({ vehicle: vehicleId },
                    { $set: { tracker: tracker._id, ...reading } }, { upsert: true });
                await evaluateTelemetryAlerts(tracker, reading);
            }

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

    describe("alert timing", () => {
        it("a heartbeat during offline alert insertion reconciles the inserted alert", async () => {
            const { vehicleId, trackerId } = await makeStaleTracker();
            const tracker = await Tracker.findById(trackerId);
            const original = Alert.create;
            Alert.create = async function (doc, ...args) {
                if (doc.type === ALERT_TYPE.GPS_OFFLINE) await recordHeartbeat(tracker);
                return original.call(this, doc, ...args);
            };
            try {
                assert.equal((await detectOfflineTrackers()).length, 0);
                assert.equal(await offlineAlertCount(vehicleId), 0);
            } finally { Alert.create = original; }
        });

        it("a delayed recovery cannot clear a newer loss", async () => {
            const { vehicleId, trackerId } = await makeStaleTracker();
            const tracker = await Tracker.findById(trackerId);
            const reading = (gpsFix, offset) => normalizeTelemetryPayload({ latitude: 13, longitude: 123,
                gpsFix, recordedAt: new Date(Date.now() + offset).toISOString() });
            await ingestTelemetry(tracker, reading(false, -120000));
            const original = Alert.findOneAndUpdate;
            let resume, signal, first = true;
            const blocked = new Promise(resolve => { resume = resolve; });
            const ready = new Promise(resolve => { signal = resolve; });
            Alert.findOneAndUpdate = function (...args) {
                if (first && args[1]?.$set?.status === ALERT_STATUS.RESOLVED) {
                    first = false;
                    return (async () => { signal(); await blocked; return original.apply(this, args); })();
                }
                return original.apply(this, args);
            };
            let recovery;
            try {
                recovery = ingestTelemetry(tracker, reading(true, -60000));
                await ready;
                await ingestTelemetry(tracker, reading(false, 0));
                resume(); await recovery;
                assert.equal((await VehicleTrackingState.findOne({ vehicle: vehicleId })).gpsFix, false);
                assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST,
                    status: ALERT_STATUS.ACTIVE }), 1);
            } finally { resume(); await recovery; Alert.findOneAndUpdate = original; }
        });

        it("a heartbeat during the sweep prevents a false offline alert", async () => {
            const { vehicleId, trackerId } = await makeStaleTracker();
            const tracker = await Tracker.findById(trackerId);
            const original = Vehicle.find;
            Vehicle.find = function (...args) {
                const query = original.apply(this, args);
                const distinct = query.distinct;
                query.distinct = async function (...params) {
                    await recordHeartbeat(tracker);
                    return distinct.apply(this, params);
                };
                return query;
            };
            try {
                assert.equal((await detectOfflineTrackers()).length, 0);
                assert.equal(await offlineAlertCount(vehicleId), 0);
            } finally { Vehicle.find = original; }
        });

        for (const phase of ["lookup", "create"]) {
            it("new recovery wins when an older loss is delayed at alert " + phase, async () => {
                const { vehicleId, trackerId } = await makeStaleTracker();
                const tracker = await Tracker.findById(trackerId);
                const method = phase === "lookup" ? "findOne" : "create";
                const original = Alert[method];
                let resume, signal, first = true;
                const blocked = new Promise(resolve => { resume = resolve; });
                const ready = new Promise(resolve => { signal = resolve; });
                Alert[method] = function (...args) {
                    if (first && args[0]?.type === ALERT_TYPE.GPS_LOST) {
                        first = false;
                        return (async () => { signal(); await blocked; return original.apply(this, args); })();
                    }
                    return original.apply(this, args);
                };
                let older;
                try {
                    older = ingestTelemetry(tracker, normalizeTelemetryPayload({ latitude: 13, longitude: 123,
                        gpsFix: false, recordedAt: new Date(Date.now() - 60000).toISOString() }));
                    await ready;
                    await ingestTelemetry(tracker, normalizeTelemetryPayload({ latitude: 13, longitude: 123,
                        gpsFix: true, recordedAt: new Date().toISOString() }));
                    resume(); await older;
                    assert.equal((await VehicleTrackingState.findOne({ vehicle: vehicleId })).gpsFix, true);
                    assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST,
                        status: ALERT_STATUS.ACTIVE }), 0);
                } finally { resume(); await older; Alert[method] = original; }
            });
        }
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
