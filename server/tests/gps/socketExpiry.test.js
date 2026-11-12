import test from "node:test";
import assert from "node:assert/strict";
import { disconnectAtTokenExpiry } from "../../sockets/socketExpiry.js";

const fixture = (authExpiresAt) => {
    let onDisconnect;
    const socket = { authExpiresAt, disconnected: false,
        once(event, callback) { assert.equal(event, "disconnect"); onDisconnect = callback; },
        disconnect(force) { assert.equal(force, true); this.disconnected = true; onDisconnect(); } };
    return socket;
};

test("a socket disconnects at expiry and cleans up its timer", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const socket = fixture(2000);
    assert.equal(disconnectAtTokenExpiry(socket), true);
    t.mock.timers.tick(999);
    assert.equal(socket.disconnected, false);
    t.mock.timers.tick(1);
    assert.equal(socket.disconnected, true);
});

test("expired or missing expiry is rejected immediately", () => {
    for (const expiry of [undefined, NaN, Date.now() - 1]) {
        const socket = fixture(expiry);
        assert.equal(disconnectAtTokenExpiry(socket), false);
        assert.equal(socket.disconnected, true);
    }
});

test("early disconnect cancels expiry and long lifetimes do not overflow timers", (t) => {
    t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1000 });
    const socket = fixture(1000 + 2 ** 31 + 10000);
    assert.equal(disconnectAtTokenExpiry(socket), true);
    t.mock.timers.tick(2 ** 31 - 1);
    assert.equal(socket.disconnected, false);
    socket.disconnect(true);
    socket.disconnected = false;
    t.mock.timers.tick(20000);
    assert.equal(socket.disconnected, false);
});
