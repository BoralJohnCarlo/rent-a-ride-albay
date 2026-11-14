import test from "node:test";
import assert from "node:assert/strict";
import { buildRouteSegments, computeRouteSummary } from "../src/constants/gpsConstants.js";

const point = (minute, extra = {}) => ({ latitude: 13 + minute * 0.01, longitude: 123,
    gpsFix: true, recordedAt: new Date(Date.UTC(2026, 10, 14, 0, minute)).toISOString(), ...extra });

test("explicit GPS loss breaks the route and excludes unobserved distance", () => {
    const points = [point(0), point(1, { gpsFix: false }), point(2), point(3)];
    assert.deepEqual(buildRouteSegments(points).map(segment => segment.length), [1, 2]);
    assert.equal(computeRouteSummary(points).distanceKm, computeRouteSummary(points.slice(2)).distanceKm);
});

test("sampled outage markers break the route without removing valid playback points", () => {
    const points = [point(0), point(1, { routeBreakBefore: true }), point(2)];
    assert.deepEqual(buildRouteSegments(points).map(segment => segment.length), [1, 2]);
    assert.equal(computeRouteSummary(points).pointCount, 3);
    assert.equal(computeRouteSummary(points).distanceKm, computeRouteSummary(points.slice(1)).distanceKm);
});

test("continuous readings remain connected while long gaps and missing positions break the route", () => {
    assert.deepEqual(buildRouteSegments([point(0), point(1)]).map(segment => segment.length), [2]);
    assert.deepEqual(buildRouteSegments([point(0), point(6)]).map(segment => segment.length), [1, 1]);
    assert.deepEqual(buildRouteSegments([point(0), point(1, { latitude: null }), point(2)]).map(segment => segment.length), [1, 1]);
    assert.deepEqual(buildRouteSegments([]), []);
});
