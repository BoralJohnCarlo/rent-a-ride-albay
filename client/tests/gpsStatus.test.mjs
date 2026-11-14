import test from "node:test";
import assert from "node:assert/strict";
import { getVehicleGpsStatus as status, GPS_STATUS as S } from "../src/constants/gpsConstants.js";
const now = Date.parse("2026-11-11T00:00:00Z");
const ago = (minutes) => new Date(now - minutes * 60000).toISOString();
const position = { latitude: 13, longitude: 123, receivedAt: ago(0), gpsFix: true };

test("retained positions do not mark unassigned vehicles live", () => {
    assert.equal(status(position, now, false), S.NO_TRACKER);
    assert.equal(status(null, now, false), S.NO_TRACKER);
});

test("trackers without positions distinguish never seen, recent contact and offline", () => {
    assert.equal(status(null, now, true), S.WAITING);
    assert.equal(status(null, now, true, ago(0)), S.WAITING);
    assert.equal(status(null, now, true, ago(2)), S.OFFLINE);
    assert.equal(status({ lastSeenAt: ago(2) }, now, true), S.OFFLINE);
    assert.equal(status({ lastSeenAt: ago(0), gpsFix: false }, now, true), S.GPS_LOST);
});

test("AIKA uses its protocol timeout even before its first position", () => {
    assert.equal(status(null, now, true, ago(5), "aika_cloud"), S.WAITING);
    assert.equal(status(null, now, true, ago(11), "aika_cloud"), S.OFFLINE);
    assert.equal(status({ ...position, source: "aika", receivedAt: ago(5) }, now, true), S.LIVE);
});
