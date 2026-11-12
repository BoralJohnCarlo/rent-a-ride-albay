import test from "node:test";
import assert from "node:assert/strict";
import Vehicle from "../../models/Vehicle.js";
import User from "../../models/User.js";
import { registerGpsEvents } from "../../sockets/gpsEvents.js";

const vehicleId = "000000000000000000000001";
const flush = () => new Promise(resolve => setImmediate(resolve));
const setup = () => {
    const handlers = {}, rooms = new Set(), pending = [];
    const socket = { user: { role: "operator", _id: "000000000000000000000002" },
        disconnect: () => { handlers.disconnect?.(); },
        on: (event, fn) => { handlers[event] = fn; }, join: room => rooms.add(room), leave: room => rooms.delete(room) };
    const original = Vehicle.findOne;
    const originalUser = User.findById;
    User.findById = async () => socket.user;
    Vehicle.findOne = () => ({ select() { return this; }, lean: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) });
    registerGpsEvents(socket);
    return { handlers, rooms, pending, socket, restore: () => { Vehicle.findOne = original; User.findById = originalUser; } };
};

test("unsubscribe during authorization prevents the server from joining later", async () => {
    const f = setup();
    try {
        let ack;
        const request = f.handlers["gps:subscribe"]({ vehicleId }, result => { ack = result; });
        f.handlers["gps:unsubscribe"]({ vehicleId });
        await flush();
        f.pending[0].resolve({ _id: vehicleId });
        await request;
        assert.equal(ack.success, false);
        assert.equal(f.rooms.size, 0);
    } finally { f.restore(); }
});

test("an old authorization response does not cancel a newer subscription", async () => {
    const f = setup();
    try {
        const first = f.handlers["gps:subscribe"]({ vehicleId });
        f.handlers["gps:unsubscribe"]({ vehicleId });
        let ack;
        const second = f.handlers["gps:subscribe"]({ vehicleId }, result => { ack = result; });
        await flush();
        f.pending[1].resolve({ _id: vehicleId }); await second;
        f.pending[0].resolve({ _id: vehicleId }); await first;
        assert.equal(ack.success, true);
        assert.equal(f.rooms.size, 1);
        f.handlers["gps:unsubscribe"]({ vehicleId });
        assert.equal(f.rooms.size, 0);
    } finally { f.restore(); }
});

test("ownership denial and database failure acknowledge failure without joining", async () => {
    const f = setup();
    try {
        for (const fail of [false, true]) {
            let ack;
            const request = f.handlers["gps:subscribe"]({ vehicleId }, result => { ack = result; });
            await flush();
            const pending = f.pending.at(-1);
            if (fail) pending.reject(new Error("fixture database failure")); else pending.resolve(null);
            await request;
            assert.equal(ack.success, false);
            assert.equal(f.rooms.size, 0);
        }
    } finally { f.restore(); }
});

test("revoked roles cannot join GPS rooms using the handshake's cached admin role", async () => {
    const f = setup();
    try {
        f.socket.user.role = "admin";
        User.findById = async () => ({ ...f.socket.user, role: "customer" });
        let ack;
        await f.handlers["gps:subscribe"]({ vehicleId }, result => { ack = result; });
        assert.equal(ack.success, false);
        assert.equal(f.rooms.size, 0);
        assert.equal(f.pending.length, 0);
    } finally { f.restore(); }
});

test("disconnect during ownership lookup prevents a late room join", async () => {
    const f = setup();
    try {
        let ack;
        const request = f.handlers["gps:subscribe"]({ vehicleId }, result => { ack = result; });
        await flush();
        f.handlers.disconnect();
        f.pending[0].resolve({ _id: vehicleId });
        await request;
        assert.equal(ack.success, false);
        assert.equal(f.rooms.size, 0);
    } finally { f.restore(); }
});
