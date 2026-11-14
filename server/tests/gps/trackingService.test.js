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
import Telemetry from "../../models/Telemetry.js";
import GpsFixObservation from "../../models/GpsFixObservation.js";
import Tracker from "../../models/Tracker.js";
import Vehicle from "../../models/Vehicle.js";
import VehicleTrackingState from "../../models/VehicleTrackingState.js";
import {
    ingestTelemetry,
    recordHeartbeat,
    getVehicleTelemetryHistory,
} from "../../services/trackingService.js";
import { createTracker, disableTracker, assignTrackerToVehicle, unassignTracker } from "../../services/trackerService.js";
import { normalizeTelemetryPayload } from "../../services/telemetryNormalizationService.js";
import {
    TELEMETRY_SOURCE,
    TRACKER_PROTOCOL,
} from "../../constants/telemetryConstants.js";
import { ALERT_TYPE, ALERT_STATUS } from "../../constants/alertConstants.js";

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

const reading = (overrides = {}) =>
    normalizeTelemetryPayload({
        latitude: 13.14,
        longitude: 123.74,
        speed: 30,
        heading: 45,
        ignition: false,
        batteryLevel: 90,
        gpsFix: true,
        recordedAt: new Date().toISOString(),
        ...overrides,
    });

// Same shape the auth middleware hands to trackingService.
const loadTracker = (id) => Tracker.findById(id);

const registerAssignedTracker = async () => {
    const vehicleId = await createTestVehicle();
    const created = await createTracker(
        { imei: uniqueImei(), vehicle: vehicleId },
        adminId
    );

    return { vehicleId, tracker: await loadTracker(created._id) };
};

describe("trackingService", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    describe("time integrity", () => {
        it("a replacement establishes its own clock without changing old history", async () => {
            const { vehicleId, tracker: oldTracker } = await registerAssignedTracker();
            const ahead = new Date(Date.now() + 4 * 60000);
            await ingestTelemetry(oldTracker, reading({ gpsFix: false, recordedAt: ahead.toISOString() }));
            await unassignTracker(oldTracker._id, adminId);
            const created = await createTracker({ imei: uniqueImei(), vehicle: vehicleId }, adminId);
            const replacement = await loadTracker(created._id);
            const recordedAt = new Date();
            const result = await ingestTelemetry(replacement, reading({ latitude: 14, gpsFix: true,
                recordedAt: recordedAt.toISOString() }));
            assert.equal(result.stateAdvanced, true);
            assert.equal(String(result.trackingState.tracker), String(replacement._id));
            assert.equal(result.trackingState.latitude, 14);
            assert.equal(result.trackingState.gpsFix, true);
            assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST,
                status: ALERT_STATUS.ACTIVE }), 0);
            assert.deepEqual((await Telemetry.findOne({ tracker: oldTracker._id })).recordedAt, ahead);
            for (const offset of [-1000, 0]) {
                const stale = await ingestTelemetry(replacement, reading({ latitude: 15,
                    recordedAt: new Date(recordedAt.getTime() + offset).toISOString() }));
                assert.equal(stale.stateAdvanced, false);
            }
            const newer = await ingestTelemetry(replacement, reading({ latitude: 16,
                recordedAt: new Date(recordedAt.getTime() + 1000).toISOString() }));
            assert.equal(newer.stateAdvanced, true);
            assert.equal(newer.trackingState.latitude, 16);
            assert.equal(await VehicleTrackingState.countDocuments({ vehicle: vehicleId }), 1);
        });

        it("older contact cannot overwrite a newer fix loss while position advances", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();
            const newerContact = minutesAgo(1);
            const olderContact = minutesAgo(2);
            await recordHeartbeat(tracker, newerContact, { gpsFix: false });
            const result = await ingestTelemetry(tracker, reading({ gpsFix: true }), { receivedAt: olderContact });
            assert.equal(result.stateAdvanced, true);
            assert.equal(result.trackingState.latitude, 13.14);
            assert.equal(result.trackingState.gpsFix, false);
            assert.deepEqual(result.trackingState.gpsFixUpdatedAt, newerContact);
            assert.equal(result.telemetry.gpsFix, true, "history retains the original observation");
            assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
            const current = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
            assert.equal(current.gpsFix, false);
            // A genuinely later fix can resolve the loss.
            await ingestTelemetry(tracker, reading({ recordedAt: new Date(Date.now() + 1000).toISOString() }));
            assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 0);
        });

        it("equal-contact position updates preserve the already observed fix", async () => {
            const { tracker } = await registerAssignedTracker();
            const contact = minutesAgo(1);
            await recordHeartbeat(tracker, contact, { gpsFix: false });
            const result = await ingestTelemetry(tracker, reading({ gpsFix: true }), { receivedAt: contact });
            assert.equal(result.trackingState.gpsFix, false);
        });

        it("an older reading is stored as history but never overwrites the latest state", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            const newer = await ingestTelemetry(
                tracker,
                reading({
                    latitude: 13.2,
                    recordedAt: minutesAgo(1).toISOString(),
                })
            );
            assert.equal(newer.stateAdvanced, true);

            const older = await ingestTelemetry(
                await loadTracker(tracker._id),
                reading({
                    latitude: 13.1,
                    recordedAt: minutesAgo(10).toISOString(),
                })
            );
            assert.equal(older.stateAdvanced, false);
            assert.equal(older.trackingState, null);

            const state = await VehicleTrackingState.findOne({
                vehicle: vehicleId,
            }).lean();
            assert.equal(state.latitude, 13.2);
            assert.equal(
                state.recordedAt.getTime(),
                new Date(newer.telemetry.recordedAt).getTime()
            );

            // Both readings are kept as history.
            assert.equal(
                await Telemetry.countDocuments({ vehicle: vehicleId }),
                2
            );
        });

        it("a newer reading advances the latest state", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            await ingestTelemetry(
                tracker,
                reading({ recordedAt: minutesAgo(5).toISOString() })
            );
            const result = await ingestTelemetry(
                await loadTracker(tracker._id),
                reading({
                    latitude: 13.5,
                    recordedAt: minutesAgo(1).toISOString(),
                })
            );

            assert.equal(result.stateAdvanced, true);

            const state = await VehicleTrackingState.findOne({
                vehicle: vehicleId,
            }).lean();
            assert.equal(state.latitude, 13.5);
        });

        it("on equal timestamps the already-stored state wins (deterministic)", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();
            const recordedAt = minutesAgo(2).toISOString();

            await ingestTelemetry(tracker, reading({ latitude: 13.3, recordedAt }));
            const duplicate = await ingestTelemetry(
                await loadTracker(tracker._id),
                reading({ latitude: 13.9, recordedAt })
            );

            assert.equal(duplicate.stateAdvanced, false);

            const state = await VehicleTrackingState.findOne({
                vehicle: vehicleId,
            }).lean();
            assert.equal(state.latitude, 13.3);
        });

        it("an older reading never moves lastSeenAt backwards", async () => {
            const { tracker } = await registerAssignedTracker();

            await ingestTelemetry(
                tracker,
                reading({ recordedAt: minutesAgo(1).toISOString() })
            );
            const firstSeen = (await loadTracker(tracker._id)).lastSeenAt;

            await ingestTelemetry(
                await loadTracker(tracker._id),
                reading({ recordedAt: minutesAgo(30).toISOString() })
            );
            const secondSeen = (await loadTracker(tracker._id)).lastSeenAt;

            assert.ok(secondSeen.getTime() >= firstSeen.getTime());
        });

        it("an older reading does not change alert state", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            await ingestTelemetry(
                tracker,
                reading({
                    gpsFix: true,
                    recordedAt: minutesAgo(1).toISOString(),
                })
            );
            await ingestTelemetry(
                await loadTracker(tracker._id),
                reading({
                    gpsFix: false,
                    recordedAt: minutesAgo(20).toISOString(),
                })
            );

            assert.equal(
                await Alert.countDocuments({
                    vehicle: vehicleId,
                    type: ALERT_TYPE.GPS_LOST,
                }),
                0
            );
        });

        it("the service itself rejects a far-future reading", async () => {
            const { tracker } = await registerAssignedTracker();

            await assert.rejects(
                ingestTelemetry(
                    tracker,
                    reading({
                        recordedAt: new Date(
                            Date.now() + 60 * 60 * 1000
                        ).toISOString(),
                    })
                ),
                { statusCode: 400 }
            );

            assert.equal(await Telemetry.countDocuments(), 0);
        });
    });

    describe("source", () => {
        it("derives source from the tracker's protocol for history and latest state", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            assert.equal(tracker.protocol, TRACKER_PROTOCOL.HTTP_SIMULATOR);

            const result = await ingestTelemetry(tracker, reading());

            assert.equal(result.telemetry.source, TELEMETRY_SOURCE.MOCK);
            assert.equal(result.trackingState.source, TELEMETRY_SOURCE.MOCK);

            const state = await VehicleTrackingState.findOne({
                vehicle: vehicleId,
            }).lean();
            assert.equal(state.source, TELEMETRY_SOURCE.MOCK);
        });

        it("refuses a tracker whose protocol has no telemetry source", async () => {
            const { tracker } = await registerAssignedTracker();
            tracker.protocol = "unimplemented_protocol";

            await assert.rejects(ingestTelemetry(tracker, reading()), {
                statusCode: 403,
            });
        });
    });

    describe("missing gpsFix", () => {
        it("stores gpsFix as null and raises no GPS_LOST alert", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            const result = await ingestTelemetry(
                tracker,
                normalizeTelemetryPayload({ latitude: 13, longitude: 123 })
            );

            assert.equal(result.telemetry.gpsFix, null);
            assert.equal(result.trackingState.gpsFix, null);
            assert.equal(
                await Alert.countDocuments({
                    vehicle: vehicleId,
                    type: ALERT_TYPE.GPS_LOST,
                }),
                0
            );
        });

        it("an unknown gpsFix does not resolve an active GPS_LOST alert", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            await ingestTelemetry(
                tracker,
                reading({ gpsFix: false, recordedAt: minutesAgo(2).toISOString() })
            );
            await ingestTelemetry(
                await loadTracker(tracker._id),
                normalizeTelemetryPayload({
                    latitude: 13,
                    longitude: 123,
                    recordedAt: minutesAgo(1).toISOString(),
                })
            );

            const alert = await Alert.findOne({
                vehicle: vehicleId,
                type: ALERT_TYPE.GPS_LOST,
            }).lean();
            assert.equal(alert.status, ALERT_STATUS.ACTIVE);

            // An explicit fix does resolve it.
            await ingestTelemetry(
                await loadTracker(tracker._id),
                reading({ gpsFix: true })
            );
            const resolved = await Alert.findById(alert._id).lean();
            assert.equal(resolved.status, ALERT_STATUS.RESOLVED);
        });
    });

    describe("unassigned tracker communication", () => {
        it("records lastSeenAt but writes no telemetry, state or alerts", async () => {
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );
            const tracker = await loadTracker(created._id);

            assert.equal(tracker.lastSeenAt, null);

            await assert.rejects(
                ingestTelemetry(tracker, reading({ gpsFix: false })),
                { statusCode: 409 }
            );

            const after = await loadTracker(created._id);
            assert.ok(after.lastSeenAt instanceof Date);
            assert.equal(await Telemetry.countDocuments(), 0);
            assert.equal(await VehicleTrackingState.countDocuments(), 0);
            assert.equal(await Alert.countDocuments(), 0);
        });

        it("a tracker whose vehicle was archived writes nothing for it", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            await Tracker.db
                .collection("vehicles")
                .updateOne({ _id: vehicleId }, { $set: { status: "Archived" } });

            await assert.rejects(ingestTelemetry(tracker, reading()), {
                statusCode: 409,
            });
            assert.equal(await Telemetry.countDocuments(), 0);
        });
    });

    describe("stale tracker requests", () => {
        it("rechecks disablement after awaiting vehicle validation", async () => {
            const { tracker } = await registerAssignedTracker();
            const originalExists = Vehicle.exists;
            Vehicle.exists = async (...args) => {
                await disableTracker(tracker._id, adminId);
                return originalExists.apply(Vehicle, args);
            };
            try {
                await assert.rejects(ingestTelemetry(tracker, reading()), { statusCode: 403 });
                assert.equal(await Telemetry.countDocuments(), 0);
                assert.equal(await VehicleTrackingState.countDocuments(), 0);
            } finally {
                Vehicle.exists = originalExists;
            }
        });

        it("rejects telemetry and heartbeats loaded before disabling", async () => {
            const { tracker } = await registerAssignedTracker();
            await disableTracker(tracker._id, adminId);
            await assert.rejects(ingestTelemetry(tracker, reading()), { statusCode: 403 });
            await assert.rejects(recordHeartbeat(tracker, new Date(), { gpsFix: false }), { statusCode: 403 });
            assert.equal(await Telemetry.countDocuments(), 0);
            assert.equal(await VehicleTrackingState.countDocuments(), 0);
            assert.equal(await Alert.countDocuments(), 0);
            assert.equal((await loadTracker(tracker._id)).lastSeenAt, null);
        });

        it("rejects an earlier assignment without writing to either vehicle", async () => {
            const { tracker } = await registerAssignedTracker();
            await assignTrackerToVehicle(tracker._id, await createTestVehicle(), adminId);
            await assert.rejects(ingestTelemetry(tracker, reading()), { statusCode: 409 });
            await assert.rejects(recordHeartbeat(tracker, new Date(), { gpsFix: false }), { statusCode: 409 });
            assert.equal(await Telemetry.countDocuments(), 0);
            assert.equal(await VehicleTrackingState.countDocuments(), 0);
            assert.equal(await Alert.countDocuments(), 0);
        });
    });

    describe("recordHeartbeat", () => {
        it("persists heartbeat-only loss once and breaks history between real positions", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();
            const start = minutesAgo(3), lossAt = minutesAgo(2), end = minutesAgo(1);
            await ingestTelemetry(tracker, reading({ recordedAt: start.toISOString() }), { receivedAt: start });
            await recordHeartbeat(tracker, lossAt, { gpsFix: false });
            await recordHeartbeat(tracker, lossAt, { gpsFix: false });
            await ingestTelemetry(tracker, reading({ recordedAt: end.toISOString(), latitude: 13.15 }), { receivedAt: end });
            assert.equal(await GpsFixObservation.countDocuments({ vehicle: vehicleId }), 1);
            assert.equal(await Telemetry.countDocuments({ vehicle: vehicleId }), 2);
            const history = await getVehicleTelemetryHistory(vehicleId, { start, end });
            assert.equal(history.points.length, 2);
            assert.equal(history.points[1].routeBreakBefore, true);
        });
        it("a replacement heartbeat owns a fix-only snapshot and alerts before its first position", async () => {
            const { vehicleId, tracker: oldTracker } = await registerAssignedTracker();
            const oldPosition = reading({ recordedAt: new Date(Date.now() + 4 * 60000).toISOString() });
            await ingestTelemetry(oldTracker, oldPosition);
            await unassignTracker(oldTracker._id, adminId);
            const created = await createTracker({ imei: uniqueImei(), vehicle: vehicleId }, adminId);
            const replacement = await loadTracker(created._id);
            const lostAt = new Date();
            await recordHeartbeat(replacement, lostAt, { gpsFix: false });
            let snapshot = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
            assert.equal(String(snapshot.tracker), String(replacement._id));
            assert.equal(snapshot.gpsFix, false);
            assert.deepEqual(snapshot.gpsFixUpdatedAt, lostAt);
            assert.deepEqual(snapshot.lastSeenAt, lostAt);
            for (const field of ["latitude", "longitude", "recordedAt", "speed", "heading", "ignition", "batteryLevel"]) {
                assert.equal(snapshot[field], null, field + " must not come from the previous tracker");
            }
            assert.equal(await Alert.countDocuments({ vehicle: vehicleId, tracker: replacement._id,
                type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
            assert.equal(await Telemetry.countDocuments(), 1);
            assert.deepEqual((await Telemetry.findOne({ tracker: oldTracker._id })).recordedAt, oldPosition.recordedAt);
            await assert.rejects(recordHeartbeat(oldTracker, new Date(), { gpsFix: true }), { statusCode: 409 });
            await recordHeartbeat(replacement, new Date(lostAt.getTime() - 1000), { gpsFix: true });
            assert.equal((await VehicleTrackingState.findOne({ vehicle: vehicleId })).gpsFix, false);
            await recordHeartbeat(replacement, new Date(lostAt.getTime() + 1000), { gpsFix: true });
            snapshot = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
            assert.equal(snapshot.gpsFix, true);
            assert.equal(snapshot.latitude, null);
            assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST,
                status: ALERT_STATUS.ACTIVE }), 0);
            const position = await ingestTelemetry(replacement, reading());
            assert.equal(position.stateAdvanced, true);
            assert.equal(position.trackingState.latitude, 13.14);
            assert.equal(await Telemetry.countDocuments({ tracker: replacement._id }), 1);
            assert.equal(await VehicleTrackingState.countDocuments({ vehicle: vehicleId }), 1);
        });

        it("persists and alerts on fix loss before the first position, then advances normally", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();
            const lostAt = minutesAgo(3);
            await recordHeartbeat(tracker, lostAt, { gpsFix: false });
            let snapshot = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
            assert.equal(snapshot.latitude, null);
            assert.equal(snapshot.longitude, null);
            assert.equal(snapshot.recordedAt, null);
            assert.equal(snapshot.gpsFix, false);
            assert.deepEqual(snapshot.gpsFixUpdatedAt, lostAt);
            assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
            assert.equal(await Telemetry.countDocuments(), 0);
            // Unknown and older heartbeats cannot clear a known loss.
            await recordHeartbeat(tracker, minutesAgo(2));
            await recordHeartbeat(tracker, minutesAgo(4), { gpsFix: true });
            snapshot = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
            assert.equal(snapshot.gpsFix, false);
            assert.equal(await Alert.countDocuments({ type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
            await recordHeartbeat(tracker, minutesAgo(1), { gpsFix: true });
            assert.equal(await Alert.countDocuments({ type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 0);
            const result = await ingestTelemetry(tracker, reading());
            assert.equal(result.stateAdvanced, true);
            assert.equal(result.trackingState.latitude, 13.14);
            assert.equal(await VehicleTrackingState.countDocuments(), 1);
            assert.equal(await Telemetry.countDocuments(), 1);
        });

        it("updates lastSeenAt without inventing a position", async () => {
            const { tracker } = await registerAssignedTracker();

            const { lastSeenAt } = await recordHeartbeat(tracker);

            const after = await loadTracker(tracker._id);
            assert.equal(after.lastSeenAt.getTime(), lastSeenAt.getTime());
            assert.equal(await Telemetry.countDocuments(), 0);
            assert.equal(await VehicleTrackingState.countDocuments(), 0);
        });

        it("resolves an active GPS_OFFLINE alert", async () => {
            const { vehicleId, tracker } = await registerAssignedTracker();

            await Alert.create({
                vehicle: vehicleId,
                tracker: tracker._id,
                type: ALERT_TYPE.GPS_OFFLINE,
                severity: "critical",
                title: "Vehicle Offline",
                message: "offline",
            });

            await recordHeartbeat(tracker);

            const alert = await Alert.findOne({
                vehicle: vehicleId,
                type: ALERT_TYPE.GPS_OFFLINE,
            }).lean();
            assert.equal(alert.status, ALERT_STATUS.RESOLVED);
        });

        it("refuses a disabled tracker", async () => {
            const { tracker } = await registerAssignedTracker();
            tracker.status = "inactive";

            await assert.rejects(recordHeartbeat(tracker), {
                statusCode: 403,
            });
        });
    });
});
