import test from "node:test";
import assert from "node:assert/strict";
import { createSocketSession } from "../src/utils/socketSession.js";

const fixture = () => {
    const events = [];
    const socket = {
        connected: false,
        connect() { events.push("connect"); this.connected = true; },
        disconnect() { events.push("disconnect"); this.connected = false; },
    };
    return { events, socket, session: createSocketSession(() => socket) };
};

test("renewed credentials reconnect the current device after a forced disconnect", () => {
    const { session, socket, events } = fixture();
    session.setAuthenticated(true);
    socket.connected = false; // server revoked the old credential
    session.refreshCredentials();
    assert.deepEqual(events, ["connect", "disconnect", "connect"]);
});

test("renewal replaces a still-connected old session rather than relying on disconnect timing", () => {
    const { session, events } = fixture();
    session.setAuthenticated(true);
    session.refreshCredentials();
    assert.deepEqual(events, ["connect", "disconnect", "connect"]);
});

test("a late password response does not reconnect after logout", () => {
    const { session, events } = fixture();
    session.setAuthenticated(true);
    session.setAuthenticated(false);
    session.refreshCredentials();
    assert.deepEqual(events, ["connect", "disconnect"]);
});

test("logout cancels pending connections and server disconnects alone do not reconnect", () => {
    const { session, socket, events } = fixture();
    session.setAuthenticated(true);
    socket.connected = false;
    assert.deepEqual(events, ["connect"]);
    session.setAuthenticated(false);
    assert.deepEqual(events, ["connect", "disconnect"]);
});
