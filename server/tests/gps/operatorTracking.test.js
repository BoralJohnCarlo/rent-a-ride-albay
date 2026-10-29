import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

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
import { canAccessVehicle } from "../../services/vehicleAccessService.js";
import { createTracker } from "../../services/trackerService.js";
import {
    ingestTelemetry,
    getVehicleTelemetryHistory,
    getOperatorFleetTracking,
} from "../../services/trackingService.js";
import { normalizeTelemetryPayload } from "../../services/telemetryNormalizationService.js";
import {
    resolveAlertManually,
    markAlertRead,
} from "../../services/alertService.js";
import {
    getCurrentVehicleStateHandler,
    getVehicleTelemetryHistoryHandler,
} from "../../controllers/telemetryController.js";
import { ALERT_TYPE, ALERT_STATUS } from "../../constants/alertConstants.js";
import { TELEMETRY_OPERATOR_HISTORY_WINDOW_MS } from "../../constants/telemetryConstants.js";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const operatorA = { _id: new mongoose.Types.ObjectId(), role: "operator" };
const operatorB = { _id: new mongoose.Types.ObjectId(), role: "operator" };
const customer = { _id: new mongoose.Types.ObjectId(), role: "customer" };
const admin = { _id: adminId, role: "admin" };

const createTrackedVehicle = async (operator, status) => {
    const vehicleId = await createTestVehicle(status, {
        operator: operator._id,
    });
    const created = await createTracker(
        { imei: uniqueImei(), vehicle: vehicleId },
        adminId
    );
    const tracker = await Tracker.findById(created._id);

    await ingestTelemetry(
        tracker,
        normalizeTelemetryPayload({
            latitude: 13.14,
            longitude: 123.74,
            speed: 20,
            gpsFix: true,
        })
    );

    return { vehicleId, trackerId: created._id };
};

/*
 * Runs an asyncHandler-wrapped controller and resolves with either the
 * error passed to next() or the JSON body sent - enough to assert on status
 * codes without booting Express.
 */
const runHandler = (handler, req) =>
    new Promise((resolve) => {
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                resolve({ statusCode: this.statusCode, body });
                return this;
            },
        };

        handler({ query: {}, body: {}, ...req }, res, (error) =>
            resolve({ error })
        );
    });

describe("operator GPS access", () => {
    before(connectTestDb);
    after(disconnectTestDb);
    beforeEach(clearCollections);

    describe("canAccessVehicle", () => {
        it("allows admins and the owning operator only", async () => {
            const vehicleId = await createTestVehicle(undefined, {
                operator: operatorA._id,
            });

            assert.equal(await canAccessVehicle(admin, vehicleId), true);
            assert.equal(await canAccessVehicle(operatorA, vehicleId), true);
            assert.equal(await canAccessVehicle(operatorB, vehicleId), false);
            assert.equal(await canAccessVehicle(customer, vehicleId), false);
            assert.equal(await canAccessVehicle(null, vehicleId), false);
            assert.equal(await canAccessVehicle(admin, "not-an-id"), false);
        });
    });

    describe("telemetry REST endpoints", () => {
        it("serves the owner's current state and 404s another operator's vehicle", async () => {
            const { vehicleId } = await createTrackedVehicle(operatorA);
            const params = { vehicleId: String(vehicleId) };

            const own = await runHandler(getCurrentVehicleStateHandler, {
                user: operatorA,
                params,
            });
            assert.equal(own.error, undefined);
            assert.equal(own.body.data.latitude, 13.14);

            const other = await runHandler(getCurrentVehicleStateHandler, {
                user: operatorB,
                params,
            });
            assert.equal(other.error?.statusCode, 404);

            const history = await runHandler(
                getVehicleTelemetryHistoryHandler,
                { user: operatorB, params }
            );
            assert.equal(history.error?.statusCode, 404);
        });

        it("caps operator history at the partner window but not admin history", async () => {
            const { vehicleId } = await createTrackedVehicle(operatorA);
            const params = { vehicleId: String(vehicleId) };
            const start = new Date(
                Date.now() - TELEMETRY_OPERATOR_HISTORY_WINDOW_MS - DAY_MS
            );
            const query = {
                start: start.toISOString(),
                end: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
            };

            const asOperator = await runHandler(
                getVehicleTelemetryHistoryHandler,
                { user: operatorA, params, query }
            );
            assert.equal(asOperator.error?.statusCode, 400);

            const asAdmin = await runHandler(
                getVehicleTelemetryHistoryHandler,
                { user: admin, params, query }
            );
            assert.equal(asAdmin.error, undefined);

            const recent = await runHandler(
                getVehicleTelemetryHistoryHandler,
                { user: operatorA, params }
            );
            assert.equal(recent.error, undefined);
            assert.equal(recent.body.data.points.length, 1);
        });

        it("getVehicleTelemetryHistory refuses a start before earliestStart", async () => {
            const vehicleId = await createTestVehicle();
            const earliestStart = new Date(Date.now() - DAY_MS);

            await assert.rejects(
                getVehicleTelemetryHistory(vehicleId, {
                    start: new Date(Date.now() - 2 * DAY_MS).toISOString(),
                    end: new Date(Date.now() - DAY_MS - 1000).toISOString(),
                    earliestStart,
                }),
                (error) => error.statusCode === 400
            );
        });
    });

    describe("getOperatorFleetTracking", () => {
        it("returns only the operator's non-archived vehicles, without tracker credentials", async () => {
            const { vehicleId: trackedId } =
                await createTrackedVehicle(operatorA);
            const untrackedId = await createTestVehicle(undefined, {
                operator: operatorA._id,
            });
            await createTestVehicle(VEHICLE_STATUS.ARCHIVED, {
                operator: operatorA._id,
            });
            await createTrackedVehicle(operatorB);

            const fleet = await getOperatorFleetTracking(operatorA._id);
            const ids = fleet.map((entry) => String(entry.vehicle._id)).sort();

            assert.deepEqual(
                ids,
                [String(trackedId), String(untrackedId)].sort()
            );

            const tracked = fleet.find(
                (entry) => String(entry.vehicle._id) === String(trackedId)
            );
            assert.deepEqual(Object.keys(tracked.tracker).sort(), [
                "_id",
                "lastSeenAt",
                "protocol",
                "status",
            ]);
            assert.equal(tracked.trackingState.latitude, 13.14);

            const untracked = fleet.find(
                (entry) => String(entry.vehicle._id) === String(untrackedId)
            );
            assert.equal(untracked.tracker, null);
            assert.equal(untracked.trackingState, null);
        });
    });

    describe("alerts", () => {
        it("lets the owning operator mark an alert read but never resolve it", async () => {
            const vehicleId = await createTestVehicle(undefined, {
                operator: operatorA._id,
            });
            const alert = await Alert.create({
                vehicle: vehicleId,
                type: ALERT_TYPE.GPS_OFFLINE,
                severity: "warning",
                title: "Tracker offline",
                message: "Test alert",
                status: ALERT_STATUS.ACTIVE,
            });

            const read = await markAlertRead(operatorA, alert._id);
            assert.equal(read.isRead, true);

            await assert.rejects(
                resolveAlertManually(operatorA, alert._id),
                (error) => error.statusCode === 403
            );

            const resolved = await resolveAlertManually(admin, alert._id);
            assert.equal(resolved.status, ALERT_STATUS.RESOLVED);
        });
    });
});
