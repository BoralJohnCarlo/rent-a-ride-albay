import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import bcrypt from "bcryptjs";

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
import Tracker from "../../models/Tracker.js";
import {
    createTracker,
    getAllTrackers,
    getTrackerById,
    assignTrackerToVehicle,
    unassignTracker,
    disableTracker,
    enableTracker,
    updateTracker,
    regenerateDeviceKey,
    releaseTrackersForVehicle,
} from "../../services/trackerService.js";
import { ingestTelemetry } from "../../services/trackingService.js";
import { normalizeTelemetryPayload } from "../../services/telemetryNormalizationService.js";
import { authenticateTracker } from "../../middleware/trackerAuthMiddleware.js";
import { TRACKER_STATUS } from "../../constants/telemetryConstants.js";
import { ALERT_TYPE, ALERT_STATUS } from "../../constants/alertConstants.js";

// Minimal Express req/res doubles for exercising the auth middleware in
// isolation (full HTTP is covered by the simulator regression run).
const runAuth = async (imei, deviceKey) => {
    const req = {
        headers: { "x-tracker-imei": imei, "x-tracker-key": deviceKey },
    };
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    let nextCalled = false;

    await authenticateTracker(req, res, (error) => {
        if (error) {
            throw error;
        }
        nextCalled = true;
    });

    return { nextCalled, statusCode: res.statusCode, body: res.body, req };
};

const activeAlert = (vehicle, tracker, type = ALERT_TYPE.GPS_LOST) =>
    Alert.create({
        vehicle,
        tracker,
        type,
        severity: "warning",
        title: "Test alert",
        message: "Test alert",
    });

describe("tracker lifecycle", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    describe("registration", () => {
        it("defaults to http_simulator, stores metadata, returns the key once", async () => {
            const created = await createTracker(
                {
                    imei: uniqueImei(),
                    simNumber: "+63 917 000 0000",
                    notes: "Bench unit",
                },
                adminId
            );

            assert.equal(created.protocol, "http_simulator");
            assert.equal(created.simNumber, "+63 917 000 0000");
            assert.equal(created.notes, "Bench unit");
            assert.equal(created.status, TRACKER_STATUS.UNASSIGNED);
            assert.match(created.deviceKey, /^[0-9a-f]{48}$/);

            const stored = await Tracker.findById(created._id)
                .select("+deviceKey")
                .lean();
            assert.notEqual(stored.deviceKey, created.deviceKey);
            assert.ok(stored.deviceKey.startsWith("$2"));
        });

        it("never returns deviceKey from list or detail", async () => {
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            const [listed] = await getAllTrackers();
            const detail = await getTrackerById(created._id);

            assert.equal("deviceKey" in listed, false);
            assert.equal("deviceKey" in detail, false);
        });

        it("rejects assigning an archived vehicle", async () => {
            const archived = await createTestVehicle("Archived");

            await assert.rejects(
                createTracker(
                    { imei: uniqueImei(), vehicle: archived },
                    adminId
                ),
                { statusCode: 409 }
            );
        });
    });

    describe("unassign", () => {
        it("clears the vehicle, sets UNASSIGNED, resolves alerts, keeps history", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );

            await ingestTelemetry(
                await Tracker.findById(created._id),
                normalizeTelemetryPayload({
                    latitude: 13,
                    longitude: 123,
                    gpsFix: false,
                })
            );
            assert.equal(
                await Alert.countDocuments({ status: ALERT_STATUS.ACTIVE }),
                1
            );

            const result = await unassignTracker(created._id, adminId);

            assert.equal(result.vehicle, null);
            assert.equal(result.status, TRACKER_STATUS.UNASSIGNED);
            assert.equal(
                await Alert.countDocuments({ status: ALERT_STATUS.ACTIVE }),
                0
            );
            assert.equal(await Telemetry.countDocuments(), 1);
            assert.ok(await Tracker.exists({ _id: created._id }));
        });

        it("refuses to unassign an unassigned tracker", async () => {
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            await assert.rejects(unassignTracker(created._id, adminId), {
                statusCode: 409,
            });
        });
    });

    describe("reassign", () => {
        it("moves to the new vehicle and resolves the previous vehicle's alerts", async () => {
            const vehicleA = await createTestVehicle();
            const vehicleB = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleA },
                adminId
            );
            await activeAlert(vehicleA, created._id);

            const result = await assignTrackerToVehicle(
                created._id,
                vehicleB,
                adminId
            );

            assert.equal(String(result.vehicle), String(vehicleB));
            assert.equal(result.status, TRACKER_STATUS.ACTIVE);
            assert.equal(
                await Alert.countDocuments({
                    vehicle: vehicleA,
                    status: ALERT_STATUS.ACTIVE,
                }),
                0
            );

            // New telemetry lands on the new vehicle only.
            await ingestTelemetry(
                await Tracker.findById(created._id),
                normalizeTelemetryPayload({ latitude: 13, longitude: 123 })
            );
            assert.equal(await Telemetry.countDocuments({ vehicle: vehicleB }), 1);
            assert.equal(await Telemetry.countDocuments({ vehicle: vehicleA }), 0);
        });

        it("blocks a vehicle that already has a tracker", async () => {
            const vehicleId = await createTestVehicle();
            await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            const other = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            await assert.rejects(
                assignTrackerToVehicle(other._id, vehicleId, adminId),
                { statusCode: 409 }
            );
        });
    });

    describe("disable / enable", () => {
        it("disable sets INACTIVE, keeps the assignment, resolves alerts and blocks ingestion", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            await activeAlert(vehicleId, created._id);

            const result = await disableTracker(created._id, adminId);

            assert.equal(result.status, TRACKER_STATUS.INACTIVE);
            assert.equal(String(result.vehicle), String(vehicleId));
            assert.equal(
                await Alert.countDocuments({ status: ALERT_STATUS.ACTIVE }),
                0
            );

            const auth = await runAuth(created.imei, created.deviceKey);
            assert.equal(auth.nextCalled, false);
            assert.equal(auth.statusCode, 403);
        });

        it("enable restores ACTIVE when assigned, UNASSIGNED when not", async () => {
            const vehicleId = await createTestVehicle();
            const assigned = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            const loose = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            await disableTracker(assigned._id, adminId);
            await disableTracker(loose._id, adminId);

            assert.equal(
                (await enableTracker(assigned._id, adminId)).status,
                TRACKER_STATUS.ACTIVE
            );
            assert.equal(
                (await enableTracker(loose._id, adminId)).status,
                TRACKER_STATUS.UNASSIGNED
            );
        });

        it("enable clears an assignment whose vehicle was archived meanwhile", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            await disableTracker(created._id, adminId);
            await Tracker.db
                .collection("vehicles")
                .updateOne({ _id: vehicleId }, { $set: { status: "Archived" } });

            const result = await enableTracker(created._id, adminId);

            assert.equal(result.vehicle, null);
            assert.equal(result.status, TRACKER_STATUS.UNASSIGNED);
        });

        it("assign/unassign keep a disabled tracker INACTIVE", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );
            await disableTracker(created._id, adminId);

            assert.equal(
                (await assignTrackerToVehicle(created._id, vehicleId, adminId))
                    .status,
                TRACKER_STATUS.INACTIVE
            );
            assert.equal(
                (await unassignTracker(created._id, adminId)).status,
                TRACKER_STATUS.INACTIVE
            );
        });

        it("rejects redundant disable/enable", async () => {
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            await assert.rejects(enableTracker(created._id, adminId), {
                statusCode: 409,
            });
            await disableTracker(created._id, adminId);
            await assert.rejects(disableTracker(created._id, adminId), {
                statusCode: 409,
            });
        });

        it("updateTracker ignores status (only descriptive fields change)", async () => {
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            const result = await updateTracker(
                created._id,
                { status: TRACKER_STATUS.ACTIVE, model: "Bench", notes: "n" },
                adminId
            );

            assert.equal(result.status, TRACKER_STATUS.UNASSIGNED);
            assert.equal(result.model, "Bench");
        });
    });

    describe("device key regeneration", () => {
        it("returns a new key once; the new key works and the old key is rejected", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );

            const before = await runAuth(created.imei, created.deviceKey);
            assert.equal(before.nextCalled, true);

            const regenerated = await regenerateDeviceKey(
                created._id,
                adminId
            );

            assert.match(regenerated.deviceKey, /^[0-9a-f]{48}$/);
            assert.notEqual(regenerated.deviceKey, created.deviceKey);

            const oldKey = await runAuth(created.imei, created.deviceKey);
            assert.equal(oldKey.nextCalled, false);
            assert.equal(oldKey.statusCode, 401);

            const newKey = await runAuth(created.imei, regenerated.deviceKey);
            assert.equal(newKey.nextCalled, true);

            const [listed] = await getAllTrackers();
            assert.equal("deviceKey" in listed, false);
        });
    });

    describe("HTTP ingest authentication", () => {
        it("unknown device and wrong key share the same 401 message", async () => {
            const created = await createTracker(
                { imei: uniqueImei() },
                adminId
            );

            const unknown = await runAuth("NO-SUCH-DEVICE", "whatever");
            const wrongKey = await runAuth(created.imei, "wrong-key");

            assert.equal(unknown.statusCode, 401);
            assert.equal(wrongKey.statusCode, 401);
            assert.equal(unknown.body.message, wrongKey.body.message);
        });

        it("rejects a tracker whose protocol is not an HTTP protocol, even with a valid key", async () => {
            const deviceKey = "a".repeat(48);
            const imei = uniqueImei();

            // Written directly: no non-HTTP protocol exists in the enum yet,
            // so this simulates a future real-protocol tracker record.
            await Tracker.collection.insertOne({
                imei,
                protocol: "future_real_protocol",
                deviceKey: await bcrypt.hash(deviceKey, 4),
                status: TRACKER_STATUS.UNASSIGNED,
                vehicle: null,
            });

            const result = await runAuth(imei, deviceKey);

            assert.equal(result.nextCalled, false);
            assert.equal(result.statusCode, 403);
        });
    });

    describe("vehicle archival", () => {
        it("releaseTrackersForVehicle unassigns the tracker and resolves the vehicle's alerts", async () => {
            const vehicleId = await createTestVehicle();
            const created = await createTracker(
                { imei: uniqueImei(), vehicle: vehicleId },
                adminId
            );
            await activeAlert(vehicleId, created._id, ALERT_TYPE.GPS_OFFLINE);

            await releaseTrackersForVehicle(vehicleId, adminId);

            const tracker = await Tracker.findById(created._id).lean();
            assert.equal(tracker.vehicle, null);
            assert.equal(tracker.status, TRACKER_STATUS.UNASSIGNED);
            assert.equal(
                await Alert.countDocuments({ status: ALERT_STATUS.ACTIVE }),
                0
            );
        });
    });
});
