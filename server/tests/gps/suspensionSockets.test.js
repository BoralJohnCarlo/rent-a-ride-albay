import "../helpers/mockEmail.js";
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import { io as connectSocket } from "socket.io-client";
import { initSocketServer } from "../../sockets/index.js";
import User from "../../models/User.js";
import { updateUserStatus, updateUser } from "../../services/userService.js";
import { createTracker, assignTrackerToVehicle, unassignTracker } from "../../services/trackerService.js";
import generateToken from "../../utils/generateToken.js";
import { protect } from "../../middleware/authMiddleware.js";
import { changePassword } from "../../controllers/userController.js";
import { createSocketSession } from "../../../client/src/utils/socketSession.js";
import { connectTestDb, disconnectTestDb, createTestVehicle, adminId } from "../helpers/testDb.js";

let ioServer, baseUrl, sequence = 0;
const clients = [];
const transports = new Set();
const event = (socket, name) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, done); reject(new Error("Timed out waiting for " + name)); }, 5000);
    const done = (...args) => { clearTimeout(timeout); resolve(args); };
    socket.once(name, done);
});
const createOperator = (role = "operator") => User.create({ firstName: "Socket", lastName: "Test", role,
    email: "suspension-" + (++sequence) + "@example.test", phoneNumber: "09175551234", password: "TestingPass123" });
const connect = async (user, expectedEvent = "connect") => {
    const socket = connectSocket(baseUrl, { autoConnect: false, reconnection: false, transports: ["websocket"],
        extraHeaders: { Cookie: "token=" + generateToken({ id: String(user._id), role: user.role,
            credentialVersion: user.credentialVersion ?? 0 }) } });
    clients.push(socket);
    const ready = event(socket, expectedEvent);
    socket.connect();
    const result = await ready;
    return { socket, result };
};

test("assignment changes notify only the authorized vehicle rooms without exposing tracker credentials", async () => {
    const ownerA = await createOperator(), ownerB = await createOperator();
    const vehicleA = await createTestVehicle(undefined, { operator: ownerA._id });
    const vehicleB = await createTestVehicle(undefined, { operator: ownerB._id });
    const created = await createTracker({ imei: "assignment-notification-test", vehicle: vehicleA }, adminId);
    const { socket: a } = await connect(ownerA);
    const { socket: b } = await connect(ownerB);
    await a.timeout(3000).emitWithAck("gps:subscribe", { vehicleId: String(vehicleA) });
    await b.timeout(3000).emitWithAck("gps:subscribe", { vehicleId: String(vehicleB) });
    const changedA = event(a, "gps:assignment-changed");
    const changedB = event(b, "gps:assignment-changed");
    await assignTrackerToVehicle(created._id, vehicleB, adminId);
    assert.deepEqual((await changedA)[0], { vehicleId: String(vehicleA) });
    assert.deepEqual((await changedB)[0], { vehicleId: String(vehicleB) });
    const unassigned = event(b, "gps:assignment-changed");
    await unassignTracker(created._id, adminId);
    assert.deepEqual((await unassigned)[0], { vehicleId: String(vehicleB) });
    a.disconnect(); b.disconnect();
});

before(async () => {
    await connectTestDb();
    await User.init();
    const app = express();
    app.use(express.json(), cookieParser());
    app.post("/password", protect, changePassword);
    const server = http.createServer(app);
    server.on("connection", transport => {
        transports.add(transport);
        transport.once("close", () => transports.delete(transport));
    });
    ioServer = initSocketServer(server);
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    baseUrl = "http://127.0.0.1:" + server.address().port;
});
after(async () => {
    clients.forEach(socket => socket.disconnect());
    transports.forEach(transport => transport.destroy());
    await new Promise(resolve => ioServer.close(resolve));
    await disconnectTestDb();
});

for (const path of ["status", "profile"]) {
    test(path + " suspension closes GPS connections and rejects reconnects", async () => {
        const user = await createOperator();
        const other = await createOperator();
        const vehicle = await createTestVehicle(undefined, { operator: user._id });
        const { socket: first } = await connect(user);
        const { socket: second } = await connect(user);
        const { socket: unaffected } = await connect(other);
        const subscribed = await first.timeout(3000).emitWithAck("gps:subscribe", { vehicleId: String(vehicle) });
        assert.equal(subscribed.success, true);
        const disconnected = Promise.all([event(first, "disconnect"), event(second, "disconnect")]);
        if (path === "status") await updateUserStatus(user._id, true);
        else await updateUser(other._id, user._id, { isSuspended: true });
        assert.deepEqual((await disconnected).map(args => args[0]), ["io server disconnect", "io server disconnect"]);
        assert.equal(unaffected.connected, true);
        const { result } = await connect(user, "connect_error");
        assert.match(result[0].message, /suspended/i);
        unaffected.disconnect();
    });
}

test("a failed suspension save leaves the user's connection intact", async () => {
    const user = await createOperator();
    const { socket } = await connect(user);
    const original = User.prototype.save;
    User.prototype.save = async function (...args) {
        if (String(this._id) === String(user._id)) throw new Error("simulated save failure");
        return original.apply(this, args);
    };
    try {
        await assert.rejects(updateUserStatus(user._id, true), /simulated save failure/);
        assert.equal(socket.connected, true);
        assert.equal((await User.findById(user._id)).isSuspended, false);
    } finally { User.prototype.save = original; socket.disconnect(); }
});

test("a successful password response reconnects this device with its fresh cookie", async () => {
    const user = await createOperator();
    const { socket } = await connect(user);
    const { socket: otherDevice } = await connect(user);
    const session = createSocketSession(() => socket);
    session.setAuthenticated(true);
    const oldCookie = socket.io.opts.extraHeaders.Cookie;
    const disconnected = Promise.all([event(socket, "disconnect"), event(otherDevice, "disconnect")]);
    const response = await fetch(baseUrl + "/password", { method: "POST",
        headers: { "Content-Type": "application/json", Cookie: oldCookie },
        body: JSON.stringify({ currentPassword: "TestingPass123", newPassword: "NewTestingPass456" }) });
    assert.equal(response.status, 200);
    const freshCookie = response.headers.get("set-cookie")?.split(";")[0];
    assert.ok(freshCookie);
    await disconnected;
    socket.io.opts.extraHeaders.Cookie = freshCookie;
    const connected = event(socket, "connect");
    session.refreshCredentials();
    await connected;
    assert.equal(socket.connected, true);
    assert.equal(otherDevice.connected, false);
    // The original credentials must remain revoked on other devices.
    const rejected = event(otherDevice, "connect_error");
    otherDevice.connect();
    const [error] = await rejected;
    assert.match(error.message, /password was changed/i);
    session.setAuthenticated(false);
});

for (const role of ["customer", "operator"]) {
    test("downgrading an admin to " + role + " revokes existing sessions and uses the current role on reconnect", async () => {
        const user = await createOperator("admin");
        const other = await createOperator();
        const ownVehicle = await createTestVehicle(undefined, { operator: user._id });
        const unrelatedVehicle = await createTestVehicle(undefined, { operator: other._id });
        const { socket: first } = await connect(user);
        const { socket: second } = await connect(user);
        const { socket: unaffected } = await connect(other);
        assert.equal((await first.timeout(3000).emitWithAck("gps:subscribe",
            { vehicleId: String(unrelatedVehicle) })).success, true);
        const closed = Promise.all([event(first, "disconnect"), event(second, "disconnect")]);
        await updateUser(other._id, user._id, { role });
        await closed;
        assert.equal(first.connected, false);
        assert.equal(second.connected, false);
        assert.equal(unaffected.connected, true);
        // Reuse the old token's admin claim: server authorization must use DB role.
        const ready = event(first, "connect");
        first.connect(); await ready;
        assert.equal((await first.timeout(3000).emitWithAck("gps:subscribe",
            { vehicleId: String(unrelatedVehicle) })).success, false);
        assert.equal((await first.timeout(3000).emitWithAck("gps:subscribe",
            { vehicleId: String(ownVehicle) })).success, role === "operator");
        first.disconnect(); unaffected.disconnect();
    });
}

test("ordinary profile updates and failed role saves do not disconnect valid sessions", async () => {
    const user = await createOperator("admin");
    const { socket } = await connect(user);
    await updateUser(user._id, user._id, { firstName: "Updated", role: "admin" });
    assert.equal(socket.connected, true);
    const original = User.prototype.save;
    User.prototype.save = async function (...args) {
        if (String(this._id) === String(user._id)) throw new Error("simulated role save failure");
        return original.apply(this, args);
    };
    try {
        await assert.rejects(updateUser(user._id, user._id, { role: "customer" }), /simulated role save failure/);
        assert.equal(socket.connected, true);
        assert.equal((await User.findById(user._id)).role, "admin");
    } finally { User.prototype.save = original; socket.disconnect(); }
});
