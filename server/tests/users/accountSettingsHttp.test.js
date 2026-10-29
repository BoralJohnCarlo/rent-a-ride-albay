import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import Notification from "../../models/Notification.js";
import User from "../../models/User.js";

import routes from "../../routes/index.js";
import errorMiddleware from "../../middleware/errorMiddleware.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Partner Settings over HTTP: change password (signs out other devices,
 * keeps this one) and notification sound preferences.
 */

const PASSWORD = "OldPassw0rd";
const NEW_PASSWORD = "NewPassw0rd!";

let server;
let baseUrl;

const request = async (method, path, { json, cookie } = {}) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            ...(json && { "Content-Type": "application/json" }),
            ...(cookie && { Cookie: cookie }),
        },
        body: json ? JSON.stringify(json) : undefined,
    });

    return {
        status: response.status,
        body: await response.json().catch(() => null),
        cookie: response.headers.get("set-cookie")?.split(";")[0],
    };
};

let userCounter = 0;

const createOperator = () => {
    userCounter += 1;

    return User.create({
        firstName: "Pat",
        lastName: "Partner",
        email: `partner${userCounter}-${Date.now()}@example.com`,
        password: PASSWORD,
        phoneNumber: `0917000${String(userCounter).padStart(4, "0")}`,
        role: "operator",
    });
};

// A session that signed in a minute ago (another device, say).
const sessionCookie = (user, secondsAgo = 60) =>
    `token=${jwt.sign(
        {
            id: user._id,
            role: user.role,
            iat: Math.floor(Date.now() / 1000) - secondsAgo,
        },
        process.env.JWT_SECRET
    )}`;

before(async () => {
    await connectTestDb();
    await User.init();

    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/api", routes);
    app.use(errorMiddleware);

    await new Promise((resolve) => {
        server = app.listen(0, resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
});

describe("PATCH /api/users/change-password", () => {
    it("rejects a wrong current password, reuse, and weak passwords without changing anything", async () => {
        const user = await createOperator();
        const cookie = sessionCookie(user);

        const wrong = await request("PATCH", "/api/users/change-password", {
            cookie,
            json: {
                currentPassword: "Wrong1234",
                newPassword: NEW_PASSWORD,
                confirmPassword: NEW_PASSWORD,
            },
        });
        assert.equal(wrong.status, 400);
        assert.equal(wrong.body.message, "Current password is incorrect.");

        const reused = await request("PATCH", "/api/users/change-password", {
            cookie,
            json: {
                currentPassword: PASSWORD,
                newPassword: PASSWORD,
                confirmPassword: PASSWORD,
            },
        });
        assert.equal(reused.status, 400);
        assert.match(reused.body.message, /different from your current password/);

        const weak = await request("PATCH", "/api/users/change-password", {
            cookie,
            json: {
                currentPassword: PASSWORD,
                newPassword: "short",
                confirmPassword: "short",
            },
        });
        assert.equal(weak.status, 400);
        assert.equal(weak.body.message, "Validation failed.");

        const stored = await User.findById(user._id).select("+password");
        assert.equal(stored.passwordChangedAt, null);
        assert.ok(await stored.comparePassword(PASSWORD));

        // The session still works - nothing was changed.
        const me = await request("GET", "/api/auth/me", { cookie });
        assert.equal(me.status, 200);
    });

    it("changes the password, keeps this device signed in, and signs out the others", async () => {
        const user = await createOperator();
        const thisDevice = sessionCookie(user);
        const otherDevice = sessionCookie(user, 3600);

        const changed = await request("PATCH", "/api/users/change-password", {
            cookie: thisDevice,
            json: {
                currentPassword: PASSWORD,
                newPassword: NEW_PASSWORD,
                confirmPassword: NEW_PASSWORD,
            },
        });
        assert.equal(changed.status, 200, JSON.stringify(changed.body));
        assert.ok(changed.body.data.passwordChangedAt);
        assert.ok(changed.cookie?.startsWith("token="), "a fresh cookie is issued");

        // Both pre-change sessions are now stale...
        for (const cookie of [thisDevice, otherDevice]) {
            const stale = await request("GET", "/api/auth/me", { cookie });
            assert.equal(stale.status, 401);
            assert.equal(stale.body.code, "PASSWORD_CHANGED");
        }

        // ...but the device that made the change carries on with its new one.
        const fresh = await request("GET", "/api/auth/me", {
            cookie: changed.cookie,
        });
        assert.equal(fresh.status, 200);
        assert.ok(fresh.body.data.passwordChangedAt);

        const stored = await User.findById(user._id).select("+password");
        assert.ok(await stored.comparePassword(NEW_PASSWORD));

        const notice = await Notification.findOne({
            recipient: user._id,
            type: "security",
        });
        assert.ok(notice, "an in-app security notice is created");
        assert.equal(notice.title, "Password Changed");
    });

    it("signing in with the new password works and isn't treated as stale", async () => {
        const user = await createOperator();

        await request("PATCH", "/api/users/change-password", {
            cookie: sessionCookie(user),
            json: {
                currentPassword: PASSWORD,
                newPassword: NEW_PASSWORD,
                confirmPassword: NEW_PASSWORD,
            },
        });

        const login = await request("POST", "/api/auth/login", {
            json: { email: user.email, password: NEW_PASSWORD },
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));

        const me = await request("GET", "/api/auth/me", {
            cookie: login.cookie,
        });
        assert.equal(me.status, 200);
    });
});

describe("PATCH /api/users/notification-preferences", () => {
    it("defaults to 50% unmuted and saves volume/mute to the account", async () => {
        const user = await createOperator();
        const cookie = sessionCookie(user);

        const before = await request("GET", "/api/auth/me", { cookie });
        assert.equal(before.body.data.notificationPreferences.soundVolume, 50);
        assert.equal(before.body.data.notificationPreferences.soundMuted, false);

        const saved = await request("PATCH", "/api/users/notification-preferences", {
            cookie,
            json: { soundVolume: 30, soundMuted: true },
        });
        assert.equal(saved.status, 200, JSON.stringify(saved.body));
        assert.deepEqual(saved.body.data, { soundVolume: 30, soundMuted: true });

        // A partial update leaves the other value alone.
        const unmuted = await request("PATCH", "/api/users/notification-preferences", {
            cookie,
            json: { soundMuted: false },
        });
        assert.deepEqual(unmuted.body.data, { soundVolume: 30, soundMuted: false });

        const after = await request("GET", "/api/auth/me", { cookie });
        assert.equal(after.body.data.notificationPreferences.soundVolume, 30);
    });

    it("rejects out-of-range, non-boolean, and empty updates", async () => {
        const user = await createOperator();
        const cookie = sessionCookie(user);

        for (const json of [
            { soundVolume: 150 },
            { soundVolume: -5 },
            { soundMuted: "yes" },
            {},
        ]) {
            const response = await request(
                "PATCH",
                "/api/users/notification-preferences",
                { cookie, json }
            );
            assert.equal(response.status, 400, JSON.stringify(json));
        }

        const stored = await User.findById(user._id);
        assert.equal(stored.notificationPreferences.soundVolume, 50);
    });

    it("requires a signed-in user", async () => {
        const response = await request(
            "PATCH",
            "/api/users/notification-preferences",
            { json: { soundVolume: 10 } }
        );
        assert.equal(response.status, 401);
    });
});
