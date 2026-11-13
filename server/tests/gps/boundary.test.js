import assert from "node:assert/strict";
import { it } from "node:test";
import { classifyAlbayPosition } from "../../utils/albayBoundary.js";
import { BOUNDARY_DEFAULTS, resolveBoundarySettings, validateBoundaryPatch, lockedBoundaryPolicy, assertReviewedBoundaryPolicy } from "../../utils/boundaryPolicy.js";
import { transitionBoundary } from "../../utils/boundaryTransition.js";

const policy = { ...BOUNDARY_DEFAULTS, penaltiesEnabled: true };
const base = Date.parse("2026-11-13T00:00:00Z");
const next = (state, seconds, zone = "outside", overrides = {}, rules = policy) => transitionBoundary(state,
    { recordedAt: new Date(base + seconds * 1000), gpsFix: true, zone, ...overrides }, rules, base + seconds * 1000, 120000);

it("uses actual Albay geometry for mainland towns, islands and neighboring provinces", () => {
    for (const [name, lat, lng, inside] of [
        ["Camalig", 13.18, 123.65, true], ["Legazpi", 13.139, 123.743, true],
        ["Tabaco", 13.35, 123.727, true], ["Rapu-Rapu", 13.195, 124.125, true],
        ["Naga", 13.62, 123.19, false], ["Sorsogon", 12.97, 124.0, false],
    ]) assert.equal(classifyAlbayPosition(lat, lng, policy).inside, inside, name);
});
it("rejects invalid positions instead of classifying them as a crossing", () => {
    for (const [lat, lng] of [[null, 123], ["13", 123], [NaN, 123], [91, 123], [13, Infinity], [13, 181]])
        assert.equal(classifyAlbayPosition(lat, lng, policy), null);
});
it("starts a grace period only after multiple confirmed outside fixes", () => {
    const first = next({}, 0);
    assert.deepEqual(first.events, []);
    const confirmed = next(first.state, 60);
    assert.deepEqual(confirmed.events, ["outside"]);
    assert.equal(confirmed.state.graceEvidenceStart, 60000);
});
it("does not apply an immediate penalty and becomes eligible only after the grace period", () => {
    let state = next(next({}, 0).state, 60).state;
    for (let time = 120; time < 960; time += 60) {
        const result = next(state, time); state = result.state;
        assert.equal(result.events.includes("eligible"), false);
    }
    const eligible = next(state, 960);
    assert.deepEqual(eligible.events, ["eligible"]);
    assert.deepEqual(next(eligible.state, 1020).events, []);
});
it("does not count unobserved time during long GPS gaps", () => {
    const confirmed = next(next({}, 0).state, 60).state;
    const resumed = next(confirmed, 3600);
    assert.equal(resumed.state.evidenceMs, confirmed.evidenceMs);
    assert.deepEqual(resumed.events, []);
});
it("does not shorten grace when a fresh GPS fix arrives after its recorded timestamp", () => {
    const first = next({}, 0).state;
    const confirmed = transitionBoundary(first, { recordedAt: new Date(base + 60000), gpsFix: true, zone: "outside" },
        policy, base + 120000, 120000);
    assert.deepEqual(confirmed.events, ["outside"]);
    assert.equal(confirmed.state.graceStartedAt.getTime(), base + 120000);
    const caughtUp = next(confirmed.state, 120);
    assert.equal(caughtUp.state.graceEvidenceMs, 0);
    assert.equal(next(caughtUp.state, 180).state.graceEvidenceMs, 60000);
});
it("pauses evidence after an explicit signal-loss observation", () => {
    const confirmed = next(next({}, 0).state, 60).state;
    const resumed = next({ ...confirmed, paused: true }, 120);
    assert.equal(resumed.state.evidenceMs, confirmed.evidenceMs);
    assert.equal(resumed.state.paused, false);
});
it("ignores duplicate, old, future, stale and no-fix telemetry", () => {
    const previous = next({}, 60).state;
    for (const overrides of [
        { recordedAt: new Date(base + 60000) }, { recordedAt: new Date(base) },
        { recordedAt: new Date(base + 200000) }, { recordedAt: new Date(base - 1000000) }, { gpsFix: false },
    ]) {
        const result = next(previous, 120, "outside", overrides);
        assert.equal(result.state, previous); assert.deepEqual(result.events, []);
    }
});
it("warns once on approach and rearms after moving safely inland", () => {
    const warned = next({}, 0, "near");
    assert.deepEqual(warned.events, ["near"]);
    assert.deepEqual(next(warned.state, 60, "near").events, []);
    const inland = next(warned.state, 60, "inside");
    assert.deepEqual(next(inland.state, 120, "near").events, ["near"]);
});
it("border jitter does not reset or advance the outside clock", () => {
    const confirmed = next(next({}, 0).state, 60).state;
    const border = next(confirmed, 120, "border");
    assert.equal(border.state.evidenceMs, confirmed.evidenceMs);
    assert.equal(next(border.state, 180).state.evidenceMs, confirmed.evidenceMs);
});
it("requires confirmed reentry before resolving the incident", () => {
    const confirmed = next(next({}, 0).state, 60).state;
    const firstInside = next(confirmed, 120, "near");
    assert.deepEqual(firstInside.events, []);
    const returned = next(firstInside.state, 180, "near");
    assert.deepEqual(returned.events, ["returned"]);
    assert.equal(returned.state.outsideSince, undefined);
});
it("does not infer reentry across an unobserved interval", () => {
    const confirmed = next(next({}, 0).state, 60).state;
    const inside = next(confirmed, 120, "inside");
    assert.deepEqual(next(inside.state, 3600, "inside").events, []);
});
it("alerts-only mode never creates penalty eligibility", () => {
    let state = {};
    for (let time = 0; time <= 1800; time += 60) {
        const result = next(state, time, "outside", {}, { ...policy, penaltiesEnabled: false });
        state = result.state; assert.equal(result.events.includes("eligible"), false);
    }
});
it("does not charge old rentals or rentals that accepted alerts-only terms", () => {
    assert.equal(lockedBoundaryPolicy(policy, null).penaltiesEnabled, false);
    assert.equal(lockedBoundaryPolicy(policy, { ...policy, penaltiesEnabled: false }).penaltiesEnabled, false);
});
it("locks a lower charge and longer grace period to the customer", () => {
    const effective = lockedBoundaryPolicy({ ...policy, penaltyAmount: 1000, gracePeriodMinutes: 5 }, policy);
    assert.equal(effective.penaltyAmount, 500); assert.equal(effective.gracePeriodMinutes, 15);
    assert.equal(lockedBoundaryPolicy({ ...policy, alertsEnabled: false }, policy).penaltiesEnabled, false);
});
it("rejects invalid settings, zero grace, unknown fields and nonnumeric amounts", () => {
    for (const patch of [null, [], { penaltiesEnabled: "true" }, { penaltyAmount: Infinity }, { penaltyAmount: "500" },
        { gracePeriodMinutes: 0 }, { bufferMeters: 0 }, { warningDistanceKm: 0 }, { confirmationSeconds: 0 }, { autoApply: true }])
        assert.throws(() => validateBoundaryPatch(patch));
    assert.deepEqual(validateBoundaryPatch({ penaltyAmount: 500, gracePeriodMinutes: 15 }), { penaltyAmount: 500, gracePeriodMinutes: 15 });
    assert.equal(resolveBoundarySettings().penaltiesEnabled, false);
});
it("requires the customer to review the current penalty policy before booking", () => {
    assert.throws(() => assertReviewedBoundaryPolicy(policy, null), { statusCode: 409 });
    assert.throws(() => assertReviewedBoundaryPolicy(policy, { ...policy, penaltyAmount: 100 }), { statusCode: 409 });
    assert.doesNotThrow(() => assertReviewedBoundaryPolicy(policy, policy));
    assert.doesNotThrow(() => assertReviewedBoundaryPolicy(BOUNDARY_DEFAULTS, null));
});
