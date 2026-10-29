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
import { createTracker, disableTracker } from "../../services/trackerService.js";
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

    it("records a heartbeat from ofl - an unchanged position is not offline", async () => {
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

        assert.equal(outcome.action, "heartbeat");

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
