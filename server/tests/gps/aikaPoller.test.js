import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
    connectTestDb,
    disconnectTestDb,
    clearCollections,
    createTestVehicle,
    adminId,
} from "../helpers/testDb.js";

import Alert from "../../models/Alert.js";
import Telemetry from "../../models/Telemetry.js";
import Tracker from "../../models/Tracker.js";
import VehicleTrackingState from "../../models/VehicleTrackingState.js";
import { pollAikaOnce } from "../../services/aika/aikaPoller.js";
import { recordHeartbeat } from "../../services/trackingService.js";
import { createTracker, disableTracker, assignTrackerToVehicle } from "../../services/trackerService.js";
import { detectOfflineTrackers } from "../../services/alertService.js";
import {
    TRACKER_PROTOCOL,
    TELEMETRY_SOURCE,
} from "../../constants/telemetryConstants.js";
import { ALERT_TYPE } from "../../constants/alertConstants.js";
import {
    AIKA_PARKED_REPLY,
    AIKA_MOVING_REPLY,
    AIKA_MOVING_POLLED_AT,
} from "./fixtures/aikaResponses.js";

const AIKA_SERIAL = "9176761220";

// Stands in for aikaClient - only what pollAikaOnce uses.
const fakeClient = (reply) => ({
    ensureSession: async () => ({
        deviceId: "3237204",
        model: "71",
        serial: AIKA_SERIAL,
        deviceName: "AK-61220",
    }),
    getTracking: async () => reply,
});

const poll = (reply, polledAt = AIKA_MOVING_POLLED_AT) =>
    pollAikaOnce({ client: fakeClient(reply), now: () => polledAt });

const createAikaTracker = async ({ assign = true } = {}) => {
    const vehicleId = assign ? await createTestVehicle() : null;
    const tracker = await createTracker(
        {
            imei: AIKA_SERIAL,
            protocol: TRACKER_PROTOCOL.AIKA_CLOUD,
            vehicle: vehicleId,
        },
        adminId
    );

    return { vehicleId, trackerId: tracker._id, tracker };
};

describe("AIKA poller -> existing tracking pipeline", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    it("repairs a failed first snapshot on retry without duplicating history", async () => {
        const { vehicleId, trackerId } = await createAikaTracker();
        const original = VehicleTrackingState.findOneAndUpdate;
        VehicleTrackingState.findOneAndUpdate = () => { throw new Error("transient snapshot failure"); };
        try {
            await assert.rejects(poll(AIKA_MOVING_REPLY), /transient snapshot failure/);
            await assert.rejects(poll(AIKA_MOVING_REPLY), /transient snapshot failure/);
        }
        finally { VehicleTrackingState.findOneAndUpdate = original; }
        assert.equal(await Telemetry.countDocuments({ tracker: trackerId }), 1);
        assert.equal(await VehicleTrackingState.countDocuments({ vehicle: vehicleId }), 0);
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "recovered");
        const snapshot = await VehicleTrackingState.findOne({ vehicle: vehicleId });
        assert.equal(snapshot.latitude, Number(AIKA_MOVING_REPLY.lat));
        assert.equal(snapshot.longitude, Number(AIKA_MOVING_REPLY.lng));
        assert.deepEqual(snapshot.recordedAt, new Date("2026-10-01T03:30:44Z"));
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "heartbeat");
        assert.equal(await Telemetry.countDocuments({ tracker: trackerId }), 1);
    });

    it("repairs an older snapshot but never rolls back a newer position", async () => {
        const { vehicleId, trackerId } = await createAikaTracker();
        await poll({ ...AIKA_PARKED_REPLY, ofl: "0" });
        const original = VehicleTrackingState.findOneAndUpdate;
        VehicleTrackingState.findOneAndUpdate = () => { throw new Error("transient snapshot failure"); };
        try { await assert.rejects(poll(AIKA_MOVING_REPLY), /transient snapshot failure/); }
        finally { VehicleTrackingState.findOneAndUpdate = original; }
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "recovered");
        assert.equal((await VehicleTrackingState.findOne({ vehicle: vehicleId })).latitude, Number(AIKA_MOVING_REPLY.lat));
        const newer = new Date("2026-10-01T03:32:00Z");
        await VehicleTrackingState.updateOne({ vehicle: vehicleId }, { $set: { recordedAt: newer, latitude: 14 } });
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "heartbeat");
        const state = await VehicleTrackingState.findOne({ vehicle: vehicleId });
        assert.equal(state.latitude, 14);
        assert.deepEqual(state.recordedAt, newer);
        assert.equal(await Telemetry.countDocuments({ tracker: trackerId }), 2);
    });

    it("recovery preserves a newer fix-only GPS loss and rejects stale cloud contact", async () => {
        const { vehicleId, trackerId } = await createAikaTracker();
        const original = VehicleTrackingState.findOneAndUpdate;
        VehicleTrackingState.findOneAndUpdate = () => { throw new Error("transient snapshot failure"); };
        try { await assert.rejects(poll(AIKA_MOVING_REPLY), /transient snapshot failure/); }
        finally { VehicleTrackingState.findOneAndUpdate = original; }
        assert.equal((await poll({ ...AIKA_MOVING_REPLY, ofl: "15" })).action, "offline");
        assert.equal(await VehicleTrackingState.countDocuments({ vehicle: vehicleId }), 0);
        const lossAt = new Date(AIKA_MOVING_POLLED_AT.getTime() + 60000);
        await recordHeartbeat(await Tracker.findById(trackerId), lossAt, { gpsFix: false });
        assert.equal((await poll({ ...AIKA_MOVING_REPLY, isGPS: "unknown" }, lossAt)).action, "recovered");
        const state = await VehicleTrackingState.findOne({ vehicle: vehicleId });
        assert.equal(state.latitude, Number(AIKA_MOVING_REPLY.lat));
        assert.equal(state.gpsFix, false);
        assert.deepEqual(state.gpsFixUpdatedAt, lossAt);
        assert.equal(await Alert.countDocuments({ vehicle: vehicleId, type: ALERT_TYPE.GPS_LOST, status: "active" }), 1);
        assert.equal(await Telemetry.countDocuments({ tracker: trackerId }), 1);
    });

    it("registers an AIKA tracker without a device key", async () => {
        const { tracker, trackerId } = await createAikaTracker();

        assert.equal(tracker.deviceKey, undefined);

        const stored = await Tracker.findById(trackerId).select("+deviceKey");
        assert.equal(stored.deviceKey, null);
    });

    it("skips when no AIKA tracker is registered for the serial", async () => {
        const outcome = await poll(AIKA_MOVING_REPLY);

        assert.equal(outcome.action, "skipped");
        assert.equal(outcome.reason, "no-tracker");
        assert.equal(await Telemetry.countDocuments(), 0);
    });

    it("never matches a simulator tracker with the same Device ID", async () => {
        await createTracker({ imei: AIKA_SERIAL }, adminId);

        const outcome = await poll(AIKA_MOVING_REPLY);

        assert.equal(outcome.reason, "no-tracker");
        assert.equal(await Telemetry.countDocuments(), 0);
    });

    it("ingests a new position through trackingService as source 'aika'", async () => {
        const { vehicleId, trackerId } = await createAikaTracker();

        const outcome = await poll(AIKA_MOVING_REPLY);

        assert.equal(outcome.action, "ingested");
        assert.equal(outcome.stateAdvanced, true);

        const telemetry = await Telemetry.find({ tracker: trackerId }).lean();
        assert.equal(telemetry.length, 1);
        assert.equal(telemetry[0].source, TELEMETRY_SOURCE.AIKA);
        assert.equal(telemetry[0].latitude, 13.35546);
        assert.equal(telemetry[0].batteryLevel, null);
        assert.equal(telemetry[0].ignition, false);
        assert.deepEqual(
            telemetry[0].recordedAt,
            new Date("2026-10-01T03:30:44Z")
        );

        const state = await VehicleTrackingState.findOne({
            vehicle: vehicleId,
        }).lean();
        assert.equal(state.source, TELEMETRY_SOURCE.AIKA);
        assert.equal(state.longitude, 123.71023);

        const tracker = await Tracker.findById(trackerId).lean();
        assert.ok(tracker.lastSeenAt);
    });

    it("does not duplicate history when positionTime hasn't changed - heartbeat only", async () => {
        const { trackerId } = await createAikaTracker();

        await poll(AIKA_MOVING_REPLY);
        const second = await poll(AIKA_MOVING_REPLY);
        const third = await poll(AIKA_MOVING_REPLY);

        assert.equal(second.action, "heartbeat");
        assert.equal(third.action, "heartbeat");
        assert.equal(
            await Telemetry.countDocuments({ tracker: trackerId }),
            1
        );
    });

    it("does not revive an offline device from an unseen cached fix", async () => {
        const { trackerId } = await createAikaTracker();
        const lastSeenAt = new Date(Date.now() - 20 * 60 * 1000);
        await Tracker.updateOne({ _id: trackerId }, { $set: { lastSeenAt } });
        await detectOfflineTrackers();
        for (const ofl of ["15", "", undefined]) {
            assert.equal((await poll({ ...AIKA_MOVING_REPLY, ofl })).action, "offline");
        }
        assert.equal(await Telemetry.countDocuments(), 0);
        assert.equal(await VehicleTrackingState.countDocuments(), 0);
        assert.deepEqual((await Tracker.findById(trackerId)).lastSeenAt, lastSeenAt);
        assert.equal(await Alert.countDocuments({ type: ALERT_TYPE.GPS_OFFLINE, status: "active" }), 1);
    });

    it("uses device contact time rather than cloud receipt time", async () => {
        const { trackerId } = await createAikaTracker();
        await poll({ ...AIKA_MOVING_REPLY, ofl: "4" });
        const expected = new Date(AIKA_MOVING_POLLED_AT.getTime() - 4 * 60 * 1000);
        assert.deepEqual((await Tracker.findById(trackerId)).lastSeenAt, expected);
    });

    it("updates fix loss and recovery without adding history or moving the marker", async () => {
        const { vehicleId } = await createAikaTracker();
        await poll(AIKA_MOVING_REPLY);
        const before = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
        await poll({ ...AIKA_MOVING_REPLY, isGPS: "0" }, new Date(AIKA_MOVING_POLLED_AT.getTime() + 60000));
        const lost = await VehicleTrackingState.findOne({ vehicle: vehicleId }).lean();
        assert.equal(lost.gpsFix, false);
        assert.equal(lost.latitude, before.latitude);
        assert.deepEqual(lost.recordedAt, before.recordedAt);
        assert.equal(await Alert.countDocuments({ type: ALERT_TYPE.GPS_LOST, status: "active" }), 1);
        await poll({ ...AIKA_MOVING_REPLY, isGPS: "unknown" }, new Date(AIKA_MOVING_POLLED_AT.getTime() + 120000));
        assert.equal((await VehicleTrackingState.findOne({ vehicle: vehicleId })).gpsFix, false);
        await poll(AIKA_MOVING_REPLY, new Date(AIKA_MOVING_POLLED_AT.getTime() + 180000));
        assert.equal((await VehicleTrackingState.findOne({ vehicle: vehicleId })).gpsFix, true);
        assert.equal(await Alert.countDocuments({ type: ALERT_TYPE.GPS_LOST, status: "active" }), 0);
        assert.equal(await Telemetry.countDocuments(), 1);
    });

    it("scopes duplicate detection to the assigned vehicle and rejects pre-assignment fixes", async () => {
        const { trackerId, vehicleId: oldVehicleId } = await createAikaTracker();
        // A clock-ahead historical reading on the old vehicle must not block
        // valid readings from the new vehicle indefinitely.
        await Telemetry.create({ tracker: trackerId, vehicle: oldVehicleId,
            latitude: 13, longitude: 123, recordedAt: new Date("2026-10-01T03:35:00Z"), source: TELEMETRY_SOURCE.AIKA });
        const newVehicleId = await createTestVehicle();
        await assignTrackerToVehicle(trackerId, newVehicleId, adminId);
        const assigned = await Tracker.findById(trackerId);
        assert.ok(assigned.assignedAt instanceof Date);
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "heartbeat");
        const waiting = await VehicleTrackingState.findOne({ vehicle: newVehicleId }).lean();
        assert.equal(waiting.latitude, null);
        assert.equal(waiting.longitude, null);
        assert.equal(waiting.recordedAt, null);
        assert.equal(await Telemetry.countDocuments({ vehicle: newVehicleId }), 0);
        // Move the assignment boundary into fixture time to model a later fix.
        await Tracker.updateOne({ _id: trackerId }, { $set: { assignedAt: new Date("2026-10-01T03:30:00Z") } });
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "ingested");
        assert.equal((await poll(AIKA_MOVING_REPLY)).action, "heartbeat");
        assert.equal(await Telemetry.countDocuments({ vehicle: newVehicleId }), 1);
        assert.equal(await Telemetry.countDocuments({ vehicle: oldVehicleId }), 1);
    });

    it("never ingests an older positionTime", async () => {
        const { trackerId } = await createAikaTracker();

        await poll(AIKA_MOVING_REPLY);
        // The parked reply's fix (02:56:56) is older than 03:30:44.
        const outcome = await poll(
            { ...AIKA_PARKED_REPLY, ofl: "0" },
            AIKA_MOVING_POLLED_AT
        );

        assert.equal(outcome.action, "heartbeat");
        assert.equal(
            await Telemetry.countDocuments({ tracker: trackerId }),
            1
        );
    });

    it("recovers history-only state and records contact from ofl", async () => {
        const { trackerId } = await createAikaTracker();

        await Telemetry.create({
            tracker: trackerId,
            vehicle: (await Tracker.findById(trackerId)).vehicle,
            latitude: 13.35536,
            longitude: 123.70982,
            recordedAt: new Date("2026-10-01T02:56:56Z"),
            source: TELEMETRY_SOURCE.AIKA,
        });

        const polledAt = new Date("2026-10-01T03:13:03Z");
        const outcome = await poll(
            { ...AIKA_PARKED_REPLY, ofl: "4" },
            polledAt
        );

        assert.equal(outcome.action, "recovered");

        const tracker = await Tracker.findById(trackerId).lean();
        assert.deepEqual(
            tracker.lastSeenAt,
            new Date(polledAt.getTime() - 4 * 60 * 1000)
        );
    });

    it("writes nothing when the position is unchanged and contact is stale", async () => {
        const { trackerId } = await createAikaTracker();

        await poll(AIKA_MOVING_REPLY);
        const before = (await Tracker.findById(trackerId).lean()).lastSeenAt;

        const outcome = await poll({ ...AIKA_MOVING_REPLY, ofl: "15" });

        assert.equal(outcome.action, "offline");
        assert.deepEqual(
            (await Tracker.findById(trackerId).lean()).lastSeenAt,
            before
        );
        assert.equal(
            await Telemetry.countDocuments({ tracker: trackerId }),
            1
        );
    });

    it("records communication only for an unassigned tracker", async () => {
        const { trackerId } = await createAikaTracker({ assign: false });

        const outcome = await poll(AIKA_MOVING_REPLY);

        assert.equal(outcome.action, "skipped");
        assert.equal(outcome.reason, "unassigned");
        assert.equal(await Telemetry.countDocuments(), 0);
        assert.ok((await Tracker.findById(trackerId).lean()).lastSeenAt);
    });

    it("ignores a disabled tracker entirely", async () => {
        const { trackerId } = await createAikaTracker();
        await disableTracker(trackerId, adminId);

        const outcome = await poll(AIKA_MOVING_REPLY);

        assert.equal(outcome.reason, "tracker-disabled");
        assert.equal(await Telemetry.countDocuments(), 0);
        assert.equal((await Tracker.findById(trackerId).lean()).lastSeenAt, null);
    });
});

describe("offline sweep - per-protocol threshold", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000);

    const makeTracker = async (protocol, lastSeenAt) => {
        const vehicleId = await createTestVehicle();
        const tracker = await createTracker(
            {
                imei: `${protocol}-${vehicleId}`,
                protocol,
                vehicle: vehicleId,
            },
            adminId
        );

        await Tracker.updateOne({ _id: tracker._id }, { $set: { lastSeenAt } });

        return vehicleId;
    };

    const isOffline = async (vehicleId) =>
        (await Alert.countDocuments({
            vehicle: vehicleId,
            type: ALERT_TYPE.GPS_OFFLINE,
        })) === 1;

    it("keeps a parked AIKA tracker online for minutes, unlike the simulator", async () => {
        const aikaRecent = await makeTracker(TRACKER_PROTOCOL.AIKA_CLOUD, minutesAgo(5));
        const aikaStale = await makeTracker(TRACKER_PROTOCOL.AIKA_CLOUD, minutesAgo(11));
        const simulator = await makeTracker(TRACKER_PROTOCOL.HTTP_SIMULATOR, minutesAgo(5));

        await detectOfflineTrackers();

        assert.equal(await isOffline(aikaRecent), false);
        assert.equal(await isOffline(aikaStale), true);
        assert.equal(await isOffline(simulator), true);
    });
});
