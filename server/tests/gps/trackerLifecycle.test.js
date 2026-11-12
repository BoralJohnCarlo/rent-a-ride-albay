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

const activeAlert = async (vehicle, tracker, type = ALERT_TYPE.GPS_LOST) => {
    const current = await Tracker.findById(tracker).select("alertSession").lean();
    return Alert.create({
        vehicle,
        tracker,
        type,
        severity: "warning",
        title: "Test alert",
        message: "Test alert",
        alertSession: current?.alertSession ?? null,
    });
};

describe("tracker lifecycle", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    for (const operation of ["assign", "unassign"]) {
        it(`overlapping ${operation} cannot undo a completed disable`, async (t) => {
            const vehicle = await createTestVehicle();
            const created = await createTracker({
                imei: uniqueImei(),
                ...(operation === "unassign" ? { vehicle } : {}),
            }, adminId);
            const originalSave = Tracker.prototype.save;
            let intercepted = false;
            t.mock.method(Tracker.prototype, "save", async function (...args) {
                if (!intercepted && String(this._id) === String(created._id) && this.isModified("vehicle")) {
                    intercepted = true;
                    await disableTracker(created._id, adminId);
                }
                return originalSave.apply(this, args);
            });
            await assert.rejects(
                operation === "assign"
                    ? assignTrackerToVehicle(created._id, vehicle, adminId)
                    : unassignTracker(created._id, adminId),
                { statusCode: 409 }
            );
            assert.equal(intercepted, true);
            const saved = await Tracker.findById(created._id);
            assert.equal(saved.status, TRACKER_STATUS.INACTIVE);
            assert.equal(String(saved.vehicle), operation === "assign" ? "null" : String(vehicle));
        });
    }

    it("concurrent assignments leave exactly one tracker on a vehicle", async () => {
        const vehicle = await createTestVehicle();
        const a = await createTracker({ imei: uniqueImei() }, adminId);
        const b = await createTracker({ imei: uniqueImei() }, adminId);
        const results = await Promise.allSettled([
            assignTrackerToVehicle(a._id, vehicle, adminId),
            assignTrackerToVehicle(b._id, vehicle, adminId),
        ]);
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        assert.equal(results.find(r => r.status === "rejected").reason.statusCode, 409);
        assert.equal(await Tracker.countDocuments({ vehicle }), 1);
        assert.equal(await Tracker.countDocuments({ vehicle: null }), 1);
    });

    it("concurrent creation with one vehicle returns a conflict and retains one assignment", async () => {
        const vehicle = await createTestVehicle();
        const results = await Promise.allSettled([
            createTracker({ imei: uniqueImei(), vehicle }, adminId),
            createTracker({ imei: uniqueImei(), vehicle }, adminId),
        ]);
        assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
        assert.equal(results.find(r => r.status === "rejected").reason.statusCode, 409);
        assert.equal(await Tracker.countDocuments({ vehicle }), 1);
    });

    it("the database rejects duplicate assignments even when service checks are bypassed", async () => {
        const vehicle = await createTestVehicle();
        await createTracker({ imei: uniqueImei(), vehicle }, adminId);
        const b = await createTracker({ imei: uniqueImei() }, adminId);
        await assert.rejects(Tracker.updateOne({ _id: b._id }, { $set: { vehicle } }), { code: 11000 });
        // Multiple unassigned trackers remain valid.
        await createTracker({ imei: uniqueImei() }, adminId);
        assert.equal(await Tracker.countDocuments({ vehicle: null }), 2);
    });


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
        for (const operation of ["unassign", "reassign"]) {
            it(`delayed ${operation} cleanup preserves alerts after assignment back to the same vehicle`, async (t) => {
                const vehicle = await createTestVehicle();
                const otherVehicle = await createTestVehicle();
                const created = await createTracker({ imei: uniqueImei(), vehicle }, adminId);
                const previous = await activeAlert(vehicle, created._id, ALERT_TYPE.LOW_BATTERY);
                const originalSave = Tracker.prototype.save;
                let intercepted = false;
                t.mock.method(Tracker.prototype, "save", async function (...args) {
                    const pause = !intercepted && String(this._id) === String(created._id) &&
                        this.isModified("vehicle") && String(this.vehicle) !== String(vehicle);
                    if (pause) intercepted = true;
                    const result = await originalSave.apply(this, args);
                    if (pause) {
                        await assignTrackerToVehicle(created._id, vehicle, adminId);
                        await ingestTelemetry(await Tracker.findById(created._id), normalizeTelemetryPayload({
                            latitude: 13.14, longitude: 123.74, gpsFix: false, recordedAt: new Date().toISOString(),
                        }));
                        assert.equal(await Alert.countDocuments({ vehicle, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
                    }
                    return result;
                });
                if (operation === "unassign") await unassignTracker(created._id, adminId);
                else await assignTrackerToVehicle(created._id, otherVehicle, adminId);
                assert.equal(intercepted, true);
                const tracker = await Tracker.findById(created._id).lean();
                assert.equal(tracker.status, TRACKER_STATUS.ACTIVE);
                assert.equal(String(tracker.vehicle), String(vehicle));
                assert.ok(tracker.alertSession);
                assert.equal((await Alert.findById(previous._id)).status, ALERT_STATUS.RESOLVED);
                const fresh = await Alert.findOne({ vehicle, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE });
                assert.ok(fresh);
                assert.equal(fresh.alertSession, tracker.alertSession);
            });
        }

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
        it("cleanup preserves an alert that arrives on the new assignment before cleanup runs", async () => {
            const vehicleA = await createTestVehicle();
            const vehicleB = await createTestVehicle();
            const created = await createTracker({ imei: uniqueImei(), vehicle: vehicleA }, adminId);
            await activeAlert(vehicleA, created._id);
            const original = Tracker.prototype.save;
            let injected = false;
            Tracker.prototype.save = async function (...args) {
                const result = await original.apply(this, args);
                if (!injected && String(this._id) === String(created._id) && String(this.vehicle) === String(vehicleB)) {
                    injected = true;
                    await ingestTelemetry(await Tracker.findById(this._id),
                        normalizeTelemetryPayload({ latitude: 13, longitude: 123, gpsFix: false }));
                }
                return result;
            };
            try {
                await assignTrackerToVehicle(created._id, vehicleB, adminId);
                assert.equal(injected, true);
                assert.equal(await Alert.countDocuments({ vehicle: vehicleA, status: ALERT_STATUS.ACTIVE }), 0);
                assert.equal(await Alert.countDocuments({ vehicle: vehicleB, tracker: created._id,
                    type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
                assert.equal(await Alert.countDocuments({ vehicle: vehicleA, status: ALERT_STATUS.RESOLVED }), 1);
            } finally { Tracker.prototype.save = original; }
        });

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
        it("disable cleans an alert created immediately before its save", async (t) => {
            const vehicle = await createTestVehicle();
            const created = await createTracker({ imei: uniqueImei(), vehicle }, adminId);
            const originalSave = Tracker.prototype.save;
            let intercepted = false;
            t.mock.method(Tracker.prototype, "save", async function (...args) {
                if (!intercepted && String(this._id) === String(created._id) && this.status === TRACKER_STATUS.INACTIVE) {
                    intercepted = true;
                    await ingestTelemetry(await Tracker.findById(created._id), normalizeTelemetryPayload({
                        latitude: 13.14, longitude: 123.74, gpsFix: false, recordedAt: new Date().toISOString(),
                    }));
                    assert.equal(await Alert.countDocuments({ vehicle, status: ALERT_STATUS.ACTIVE }), 1);
                }
                return originalSave.apply(this, args);
            });
            await disableTracker(created._id, adminId);
            assert.equal(intercepted, true);
            assert.equal((await Tracker.findById(created._id)).status, TRACKER_STATUS.INACTIVE);
            assert.equal(await Alert.countDocuments({ vehicle, status: ALERT_STATUS.ACTIVE }), 0);
        });

        for (const previousType of [ALERT_TYPE.LOW_BATTERY, ALERT_TYPE.GPS_LOST]) {
            it(`delayed disable cleanup preserves fresh GPS loss after re-enable with previous ${previousType}`, async (t) => {
                const vehicle = await createTestVehicle();
                const created = await createTracker({ imei: uniqueImei(), vehicle }, adminId);
                const previous = await activeAlert(vehicle, created._id, previousType);
                const originalSave = Tracker.prototype.save;
                let intercepted = false;
                t.mock.method(Tracker.prototype, "save", async function (...args) {
                    const pause = !intercepted && String(this._id) === String(created._id) && this.status === TRACKER_STATUS.INACTIVE;
                    if (pause) intercepted = true;
                    const result = await originalSave.apply(this, args);
                    if (pause) {
                        await enableTracker(created._id, adminId);
                        await ingestTelemetry(await Tracker.findById(created._id), normalizeTelemetryPayload({
                            latitude: 13.14, longitude: 123.74, gpsFix: false, recordedAt: new Date().toISOString(),
                        }));
                        assert.equal(await Alert.countDocuments({ vehicle, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
                    }
                    return result;
                });
                await disableTracker(created._id, adminId);
                assert.equal(intercepted, true);
                assert.equal((await Tracker.findById(created._id)).status, TRACKER_STATUS.ACTIVE);
                assert.equal((await Alert.findById(previous._id)).status, ALERT_STATUS.RESOLVED);
                assert.equal(await Alert.countDocuments({ vehicle, type: ALERT_TYPE.GPS_LOST, status: ALERT_STATUS.ACTIVE }), 1);
            });
        }

        it("disable rejects a completed reassignment and cleans the current vehicle on retry", async (t) => {
            const oldVehicle = await createTestVehicle();
            const newVehicle = await createTestVehicle();
            const created = await createTracker({ imei: uniqueImei(), vehicle: oldVehicle }, adminId);
            const originalSave = Tracker.prototype.save;
            let intercepted = false;
            t.mock.method(Tracker.prototype, "save", async function (...args) {
                if (!intercepted && String(this._id) === String(created._id) && this.status === TRACKER_STATUS.INACTIVE) {
                    intercepted = true;
                    await assignTrackerToVehicle(created._id, newVehicle, adminId);
                    await activeAlert(newVehicle, created._id);
                }
                return originalSave.apply(this, args);
            });
            await assert.rejects(disableTracker(created._id, adminId), { statusCode: 409 });
            assert.equal(intercepted, true);
            const saved = await Tracker.findById(created._id).lean();
            assert.equal(saved.status, TRACKER_STATUS.ACTIVE);
            assert.equal(String(saved.vehicle), String(newVehicle));
            assert.equal(await Alert.countDocuments({ vehicle: newVehicle, status: ALERT_STATUS.ACTIVE }), 1);

            const disabled = await disableTracker(created._id, adminId);
            assert.equal(disabled.status, TRACKER_STATUS.INACTIVE);
            assert.equal(String(disabled.vehicle), String(newVehicle));
            assert.equal(await Alert.countDocuments({ vehicle: newVehicle, status: ALERT_STATUS.ACTIVE }), 0);
            assert.equal((await Tracker.findById(created._id)).status, TRACKER_STATUS.INACTIVE);
        });

        for (const operation of ["assign", "unassign"]) {
            it(`enable rejects a concurrent ${operation} and succeeds after refresh`, async (t) => {
                const vehicle = await createTestVehicle();
                const created = await createTracker({
                    imei: uniqueImei(),
                    ...(operation === "unassign" ? { vehicle } : {}),
                }, adminId);
                await disableTracker(created._id, adminId);
                const originalSave = Tracker.prototype.save;
                let intercepted = false;
                t.mock.method(Tracker.prototype, "save", async function (...args) {
                    if (!intercepted && String(this._id) === String(created._id) && this.status !== TRACKER_STATUS.INACTIVE) {
                        intercepted = true;
                        if (operation === "assign") await assignTrackerToVehicle(created._id, vehicle, adminId);
                        else await unassignTracker(created._id, adminId);
                    }
                    return originalSave.apply(this, args);
                });
                await assert.rejects(enableTracker(created._id, adminId), { statusCode: 409 });
                assert.equal(intercepted, true);
                const saved = await Tracker.findById(created._id).lean();
                assert.equal(saved.status, TRACKER_STATUS.INACTIVE);
                assert.equal(String(saved.vehicle), operation === "assign" ? String(vehicle) : "null");
                const enabled = await enableTracker(created._id, adminId);
                assert.equal(enabled.status, operation === "assign" ? TRACKER_STATUS.ACTIVE : TRACKER_STATUS.UNASSIGNED);
                assert.equal(String(enabled.vehicle), String(saved.vehicle));
            });
        }

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
        it("cleanup preserves a reassignment completed before its database write", async (t) => {
            const oldVehicle = await createTestVehicle();
            const newVehicle = await createTestVehicle();
            const created = await createTracker({ imei: uniqueImei(), vehicle: oldVehicle }, adminId);
            const originalUpdate = Tracker.collection.updateMany;
            let intercepted = false;
            t.mock.method(Tracker.collection, "updateMany", async function (...args) {
                if (!intercepted) {
                    intercepted = true;
                    await assignTrackerToVehicle(created._id, newVehicle, adminId);
                    await activeAlert(newVehicle, created._id, ALERT_TYPE.GPS_LOST);
                }
                return originalUpdate.apply(this, args);
            });
            assert.equal(await releaseTrackersForVehicle(oldVehicle, adminId), 0);
            assert.equal(intercepted, true);
            const tracker = await Tracker.findById(created._id).lean();
            assert.equal(String(tracker.vehicle), String(newVehicle));
            assert.equal(tracker.status, TRACKER_STATUS.ACTIVE);
            assert.equal(await Alert.countDocuments({ vehicle: newVehicle, status: ALERT_STATUS.ACTIVE }), 1);
        });

        it("cleanup preserves a disable completed before its database write", async (t) => {
            const vehicle = await createTestVehicle();
            const created = await createTracker({ imei: uniqueImei(), vehicle }, adminId);
            const originalUpdate = Tracker.collection.updateMany;
            let intercepted = false;
            t.mock.method(Tracker.collection, "updateMany", async function (...args) {
                if (!intercepted) {
                    intercepted = true;
                    await disableTracker(created._id, adminId);
                }
                return originalUpdate.apply(this, args);
            });
            assert.equal(await releaseTrackersForVehicle(vehicle, String(adminId)), 1);
            assert.equal(intercepted, true);
            const tracker = await Tracker.findById(created._id).lean();
            assert.equal(tracker.vehicle, null);
            assert.equal(tracker.status, TRACKER_STATUS.INACTIVE);
            assert.equal(String(tracker.audit.updatedBy), String(adminId));
        });

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
