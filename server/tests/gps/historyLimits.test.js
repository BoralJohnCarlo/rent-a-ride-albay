import test from "node:test";
import assert from "node:assert/strict";
import Telemetry from "../../models/Telemetry.js";
import GpsFixObservation from "../../models/GpsFixObservation.js";
import { getVehicleTelemetryHistory } from "../../services/trackingService.js";
import { TELEMETRY_HISTORY_QUERY_LIMIT, TELEMETRY_HISTORY_MAX_POINTS } from "../../constants/telemetryConstants.js";

// No database connection: exercise the service against a bounded query fixture.
const runHistory = async (count, check) => {
    const start = new Date("2026-11-01T00:00:00Z");
    const readings = Array.from({ length: count }, (_, index) => ({ latitude: 13, longitude: 123,
        gpsFix: true, recordedAt: new Date(start.getTime() + index * 1000) }));
    let requestedLimit;
    const original = Telemetry.find;
    const originalLosses = GpsFixObservation.find;
    const losses = [];
    GpsFixObservation.find = () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => losses });
    Telemetry.find = () => ({ select() { return this; }, sort() { return this; },
        limit(value) { requestedLimit = value; return this; }, lean: async () => readings.slice(0, requestedLimit) });
    try {
        await check(() => getVehicleTelemetryHistory("fixture", { start, end: new Date(start.getTime() + 23 * 3600000) }), readings, losses);
        assert.equal(requestedLimit, TELEMETRY_HISTORY_QUERY_LIMIT + 1);
    } finally { Telemetry.find = original; GpsFixObservation.find = originalLosses; }
};

test("dense histories return an explicit error instead of a truncated route", async () => {
    await runHistory(TELEMETRY_HISTORY_QUERY_LIMIT + 1, async load => {
        await assert.rejects(load, error => error.statusCode === 400 && /Choose a shorter range/.test(error.message));
    });
});

test("a history at the safety limit preserves both endpoints and the full count", async () => {
    await runHistory(TELEMETRY_HISTORY_QUERY_LIMIT, async (load, readings) => {
        const history = await load();
        assert.equal(history.totalPoints, readings.length);
        assert.equal(history.returnedPoints, TELEMETRY_HISTORY_MAX_POINTS);
        assert.equal(history.sampled, true);
        assert.deepEqual(history.points[0], readings[0]);
        assert.deepEqual(history.points.at(-1), readings.at(-1));
    });
});

test("small and empty histories retain their original behavior", async () => {
    for (const count of [0, 2]) await runHistory(count, async (load, readings) => {
        const history = await load();
        assert.deepEqual(history.points, readings);
        assert.equal(history.totalPoints, count);
        assert.equal(history.sampled, false);
    });
});

test("sampling preserves a GPS outage even when its reading is omitted", async () => {
    await runHistory(TELEMETRY_HISTORY_MAX_POINTS * 2, async (load, readings) => {
        readings[1] = { ...readings[1], gpsFix: false, latitude: null, longitude: null };
        const history = await load();
        assert.equal(history.points.length, TELEMETRY_HISTORY_MAX_POINTS);
        assert.equal(history.points[1].recordedAt.getTime(), readings[2].recordedAt.getTime());
        assert.equal(history.points[1].routeBreakBefore, true);
        assert.equal(history.points[2].routeBreakBefore, undefined);
        assert.equal(readings[2].routeBreakBefore, undefined);
    });
});

test("heartbeat-only loss breaks history without adding positions", async () => {
    await runHistory(3, async (load, readings, losses) => {
        losses.push({ observedAt: new Date(readings[0].recordedAt.getTime() + 500) });
        const history = await load();
        assert.equal(history.totalPoints, 3);
        assert.equal(history.points[1].routeBreakBefore, true);
        assert.equal(history.points[2].routeBreakBefore, undefined);
    });
});

test("heartbeat loss markers survive sampling without dropping real endpoints", async () => {
    await runHistory(TELEMETRY_HISTORY_MAX_POINTS * 2, async (load, readings, losses) => {
        losses.push({ observedAt: new Date(readings[0].recordedAt.getTime() + 500) });
        const history = await load();
        assert.equal(history.points[1].routeBreakBefore, true);
        assert.deepEqual(history.points[0], readings[0]);
        assert.deepEqual(history.points.at(-1), readings.at(-1));
    });
});

test("sampling preserves tracker changes even when the replacement's first reading is omitted", async () => {
    await runHistory(TELEMETRY_HISTORY_MAX_POINTS * 2, async (load, readings) => {
        readings.forEach((point, index) => { point.tracker = index === 0 ? "old" : "replacement"; });
        const history = await load();
        assert.equal(history.points[1].routeBreakBefore, true);
        assert.equal(history.points[2].routeBreakBefore, undefined);
        assert.equal(history.points[0].tracker, undefined);
    });
});

test("heartbeat observation overload fails explicitly instead of concealing losses", async () => {
    await runHistory(2, async (load, readings, losses) => {
        losses.push(...Array.from({ length: TELEMETRY_HISTORY_QUERY_LIMIT + 1 }, () => ({ observedAt: readings[0].recordedAt })));
        await assert.rejects(load, error => error.statusCode === 400 && /shorter range/.test(error.message));
    });
});
