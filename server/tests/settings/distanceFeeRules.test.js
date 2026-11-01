import assert from "node:assert/strict";
import { afterEach, it, mock } from "node:test";
import mongoose from "mongoose";
import DistanceFeeRule from "../../models/DistanceFeeRule.js";
import { createDistanceFeeRule, updateDistanceFeeRule, enableDistanceFeeRule,
    disableDistanceFeeRule, deleteDistanceFeeRule } from "../../services/distanceFeeRuleService.js";

afterEach(() => mock.restoreAll());

const prepare = (overlap = null) => {
    const session = { withTransaction: async (run) => run(), endSession: async () => {} };
    mock.method(mongoose, "startSession", async () => session);
    const guards = mock.method(mongoose.model("BookingCreationGuard"), "updateOne", async () => ({}));
    const query = mock.method(DistanceFeeRule, "findOne", () => ({
        session(value) { assert.equal(value, session); return this; },
        lean: async () => overlap,
    }));
    const rule = new DistanceFeeRule({ minDistanceKm: 0, maxDistanceKm: 10, pickupFee: 100, returnFee: 100, enabled: false });
    mock.method(DistanceFeeRule, "findById", () => ({ session: async (value) => {
        assert.equal(value, session); return rule;
    } }));
    const save = mock.method(DistanceFeeRule.prototype, "save", async function (options) {
        assert.equal(options.session, session); return this;
    });
    return { guards, query, save, rule };
};

it("create checks overlaps and writes under the shared transaction guard", async () => {
    const { guards, save } = prepare();
    await createDistanceFeeRule({ minDistanceKm: 0, maxDistanceKm: 10, enabled: true });
    assert.equal(save.mock.callCount(), 1);
    assert.equal(guards.mock.calls[1].arguments[0]._id, "distance-fee-rules");
    assert.ok(guards.mock.calls[1].arguments[2].session);
});

for (const operation of [
    (data) => createDistanceFeeRule(data),
    (data) => updateDistanceFeeRule("rule", data),
]) {
    it("compares numeric-string distances numerically and saves normalized values", async () => {
        const { query } = prepare();
        const result = await operation({ minDistanceKm: "5", maxDistanceKm: "20", enabled: true });
        assert.equal(result.minDistanceKm, 5);
        assert.equal(result.maxDistanceKm, 20);
        assert.equal(query.mock.calls[0].arguments[0].minDistanceKm.$lt, 20);
        assert.equal(query.mock.calls[0].arguments[0].maxDistanceKm.$gt, 5);
    });

    for (const range of [
        { minDistanceKm: "10", maxDistanceKm: "5" },
        { minDistanceKm: "5", maxDistanceKm: "5" },
        { minDistanceKm: "invalid", maxDistanceKm: "20" },
        { minDistanceKm: "0", maxDistanceKm: Infinity },
        { minDistanceKm: -1, maxDistanceKm: 20 },
    ]) {
        it(`rejects invalid numeric ranges before lookup or save: ${JSON.stringify(range)}`, async () => {
            const { query, save } = prepare();
            await assert.rejects(operation(range), (error) => error.statusCode === 400);
            assert.equal(query.mock.callCount(), 0);
            assert.equal(save.mock.callCount(), 0);
        });
    }
}

it("partial edits compare against the stored numeric distance", async () => {
    prepare();
    const result = await updateDistanceFeeRule("rule", { minDistanceKm: "5" });
    assert.equal(result.minDistanceKm, 5);
    assert.equal(result.maxDistanceKm, 10);
});

for (const operation of [
    () => createDistanceFeeRule({ minDistanceKm: 0, maxDistanceKm: 10, enabled: true }),
    () => updateDistanceFeeRule("rule", { enabled: true, maxDistanceKm: 15 }),
    () => enableDistanceFeeRule("rule"),
]) {
    it("refuses an overlapping active rule before any save", async () => {
        const { save } = prepare({ minDistanceKm: 5, maxDistanceKm: 20 });
        await assert.rejects(operation(), (error) => error.statusCode === 409);
        assert.equal(save.mock.callCount(), 0);
    });
}

for (const operation of [disableDistanceFeeRule, deleteDistanceFeeRule]) {
    it("allows disabling overlapping legacy rules under the same guard", async () => {
        const { rule, query, save } = prepare({ minDistanceKm: 5, maxDistanceKm: 20 });
        rule.enabled = true;
        const result = await operation("rule");
        assert.equal(result.enabled, false);
        assert.equal(query.mock.callCount(), 0);
        assert.equal(save.mock.callCount(), 1);
    });
}
