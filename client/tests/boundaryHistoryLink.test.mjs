import assert from "node:assert/strict";
import { test } from "node:test";
import { boundaryHistoryLink, readBoundaryHistoryLink } from "../src/utils/boundaryHistoryLink.js";
const vehicle = "a".repeat(24);
const now = Date.parse("2026-11-14T04:00:00Z");

test("incident evidence links preserve the vehicle and bound the crossing window", () => {
    const url = new URL(boundaryHistoryLink({ vehicle: { _id: vehicle }, outsideAt: "2026-11-14T02:00:00Z", resolvedAt: "2026-11-14T03:00:00Z" }, now), "https://example.test");
    assert.equal(url.pathname, "/admin/gps");
    assert.equal(url.searchParams.get("vehicle"), vehicle);
    assert.equal(url.searchParams.get("start"), "2026-11-14T01:55:00.000Z");
    assert.equal(url.searchParams.get("end"), "2026-11-14T03:05:00.000Z");
    const initial = readBoundaryHistoryLink(url.searchParams);
    assert.equal(initial.vehicle, vehicle);
    assert.equal(new Date(initial.range.start).toISOString(), "2026-11-14T01:55:00.000Z");
});
test("long incidents respect the GPS history range limit", () => {
    const url = new URL(boundaryHistoryLink({ vehicle, outsideAt: "2026-11-10T02:00:00Z", lastFixAt: "2026-11-14T03:00:00Z" }, now), "https://example.test");
    assert.equal(new Date(url.searchParams.get("end")) - new Date(url.searchParams.get("start")), 24 * 3600000);
    assert.ok(readBoundaryHistoryLink(url.searchParams));
});
test("invalid vehicles, dates, and URL ranges do not initialize evidence playback", () => {
    assert.equal(boundaryHistoryLink({ vehicle: "invalid", createdAt: "2026-11-14" }, now), null);
    assert.equal(boundaryHistoryLink({ vehicle, createdAt: "invalid" }, now), null);
    for (const changes of [{ mode: "live" }, { vehicle: "invalid" }, { start: "invalid" }, { end: "2026-11-13T00:00:00Z" }, { end: "2026-11-20T00:00:00Z" }]) {
        const params = new URLSearchParams({ vehicle, mode: "history", start: "2026-11-14T00:00:00Z", end: "2026-11-14T01:00:00Z", ...changes });
        assert.equal(readBoundaryHistoryLink(params), null);
    }
});
