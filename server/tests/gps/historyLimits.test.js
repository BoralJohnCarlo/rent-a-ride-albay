import test from "node:test";
import assert from "node:assert/strict";
import Telemetry from "../../models/Telemetry.js";
import { getVehicleTelemetryHistory } from "../../services/trackingService.js";
import { TELEMETRY_HISTORY_QUERY_LIMIT, TELEMETRY_HISTORY_MAX_POINTS } from "../../constants/telemetryConstants.js";

// No database connection: exercise the service against a bounded query fixture.
const runHistory = async (count, check) => {
    const start = new Date("2026-11-01T00:00:00Z");
    const readings = Array.from({ length: count }, (_, index) => ({ latitude: 13, longitude: 123,
        gpsFix: true, recordedAt: new Date(start.getTime() + index * 1000) }));
    let requestedLimit;
    const original = Telemetry.find;
    Telemetry.find = () => ({ select() { return this; }, sort() { return this; },
        limit(value) { requestedLimit = value; return this; }, lean: async () => readings.slice(0, requestedLimit) });
    try {
        await check(() => getVehicleTelemetryHistory("fixture", { start, end: new Date(start.getTime() + 23 * 3600000) }), readings);
        assert.equal(requestedLimit, TELEMETRY_HISTORY_QUERY_LIMIT + 1);
    } finally { Telemetry.find = original; }
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
