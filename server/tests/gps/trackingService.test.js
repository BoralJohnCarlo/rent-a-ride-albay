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
import Tracker from "../../models/Tracker.js";
import VehicleTrackingState from "../../models/VehicleTrackingState.js";
import {
    ingestTelemetry,
    recordHeartbeat,
} from "../../services/trackingService.js";
import { createTracker } from "../../services/trackerService.js";
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

    describe("recordHeartbeat", () => {
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
