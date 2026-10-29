import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

import transporter from "../../config/email.js";

import Notification from "../../models/Notification.js";
import User from "../../models/User.js";

import routes from "../../routes/index.js";
import errorMiddleware from "../../middleware/errorMiddleware.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Forgot password end to end over HTTP. Email is stubbed and the code read
 * from the captured message. All requests share one IP, so the calls below
 * stay inside the route limits (5 code requests, 10 verifies, 10 resets).
 */

const PASSWORD = "OldPassw0rd";
const NEW_PASSWORD = "BrandNew9!";

let sentMail = [];
const originalSendMail = transporter.sendMail;

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

// The code email is sent without being awaited - give it a moment.
const waitForCode = async (email) => {
    for (let i = 0; i < 50; i += 1) {
        const mail = [...sentMail].reverse().find((entry) => entry.to === email);

        if (mail) {
            return mail.text.match(/Your code: (\d{6})/)?.[1];
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    return null;
};

const mailCountFor = (email) =>
    sentMail.filter((entry) => entry.to === email).length;

let counter = 0;

const createUser = (overrides = {}) => {
    counter += 1;

    return User.create({
        firstName: "Reese",
        lastName: "Tester",
        email: `reset${counter}-${Date.now()}@example.com`,
        password: PASSWORD,
        phoneNumber: `0918000${String(counter).padStart(4, "0")}`,
        role: "customer",
        ...overrides,
    });
};

const sessionCookie = (user) =>
    `token=${jwt.sign(
        {
            id: user._id,
            role: user.role,
            iat: Math.floor(Date.now() / 1000) - 60,
        },
        process.env.JWT_SECRET
    )}`;

before(async () => {
    transporter.sendMail = async (mail) => {
        sentMail.push(mail);
        return { messageId: "test" };
    };

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
    transporter.sendMail = originalSendMail;

    await new Promise((resolve) => server.close(resolve));
    await disconnectTestDb();
});

describe("forgot password", () => {
    it("answers an unknown email exactly like a real one, without sending anything", async () => {
        const response = await request("POST", "/api/auth/forgot-password", {
            json: { email: "nobody-here@example.com" },
        });

        assert.equal(response.status, 200);
        assert.deepEqual(response.body.data, {
            resendAvailableIn: 60,
            codeExpiresIn: 900,
        });

        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(mailCountFor("nobody-here@example.com"), 0);
    });

    it("resets the password with the emailed code and signs out every session", async () => {
        const user = await createUser({
            loginAttempts: 4,
            lockoutUntil: new Date(Date.now() + 10 * 60 * 1000),
        });
        const oldSession = sessionCookie(user);

        const requested = await request("POST", "/api/auth/forgot-password", {
            json: { email: user.email },
        });
        assert.equal(requested.status, 200);

        const code = await waitForCode(user.email);
        assert.match(code, /^\d{6}$/);

        // Inside the cooldown: same answer, no second email.
        await request("POST", "/api/auth/forgot-password", {
            json: { email: user.email },
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(mailCountFor(user.email), 1);

        const wrongCode = code === "000000" ? "111111" : "000000";
        const wrong = await request("POST", "/api/auth/forgot-password/verify", {
            json: { email: user.email, code: wrongCode },
        });
        assert.equal(wrong.status, 400);
        assert.equal(wrong.body.message, "Incorrect code. 4 attempts left.");

        const verified = await request("POST", "/api/auth/forgot-password/verify", {
            json: { email: user.email, code },
        });
        assert.equal(verified.status, 200, JSON.stringify(verified.body));
        const { resetToken } = verified.body.data;
        assert.match(resetToken, /^[a-f0-9]{64}$/);

        // The code is single use.
        const reused = await request("POST", "/api/auth/forgot-password/verify", {
            json: { email: user.email, code },
        });
        assert.equal(reused.status, 400);

        const weak = await request("POST", "/api/auth/reset-password", {
            json: {
                email: user.email,
                resetToken,
                newPassword: "weak",
                confirmPassword: "weak",
            },
        });
        assert.equal(weak.status, 400);
        assert.equal(weak.body.message, "Password must be at least 8 characters.");

        const same = await request("POST", "/api/auth/reset-password", {
            json: {
                email: user.email,
                resetToken,
                newPassword: PASSWORD,
                confirmPassword: PASSWORD,
            },
        });
        assert.equal(same.status, 400);
        assert.match(same.body.message, /different from your old one/);

        const reset = await request("POST", "/api/auth/reset-password", {
            json: {
                email: user.email,
                resetToken,
                newPassword: NEW_PASSWORD,
                confirmPassword: NEW_PASSWORD,
            },
        });
        assert.equal(reset.status, 200, JSON.stringify(reset.body));

        // The token is single use too.
        const replay = await request("POST", "/api/auth/reset-password", {
            json: {
                email: user.email,
                resetToken,
                newPassword: "Another1Pass",
                confirmPassword: "Another1Pass",
            },
        });
        assert.equal(replay.status, 400);
        assert.match(replay.body.message, /reset session has expired/);

        const stale = await request("GET", "/api/auth/me", { cookie: oldSession });
        assert.equal(stale.status, 401);
        assert.equal(stale.body.code, "PASSWORD_CHANGED");

        // The failed-login lockout was lifted, and the new password works.
        const login = await request("POST", "/api/auth/login", {
            json: { email: user.email, password: NEW_PASSWORD },
        });
        assert.equal(login.status, 200, JSON.stringify(login.body));

        const notice = await Notification.findOne({
            recipient: user._id,
            title: "Password Reset",
        });
        assert.ok(notice, "an in-app security notice is created");
    });

    it("locks the code after 5 wrong guesses and rejects expired codes", async () => {
        const user = await createUser();

        await request("POST", "/api/auth/forgot-password", {
            json: { email: user.email },
        });
        const code = await waitForCode(user.email);
        const wrongCode = code === "000000" ? "111111" : "000000";

        let last;
        for (let i = 0; i < 5; i += 1) {
            last = await request("POST", "/api/auth/forgot-password/verify", {
                json: { email: user.email, code: wrongCode },
            });
        }
        assert.equal(last.status, 400);
        assert.equal(last.body.message, "Too many incorrect codes. Please request a new code.");

        // Even the right code is dead now.
        const locked = await request("POST", "/api/auth/forgot-password/verify", {
            json: { email: user.email, code },
        });
        assert.equal(locked.status, 400);
        assert.match(locked.body.message, /invalid or has expired/);

        // An expired code is refused as well.
        await User.updateOne(
            { _id: user._id },
            {
                $set: {
                    passwordResetCode: "x".repeat(64),
                    passwordResetExpires: new Date(Date.now() - 1000),
                },
            }
        );
        const expired = await request("POST", "/api/auth/forgot-password/verify", {
            json: { email: user.email, code },
        });
        assert.equal(expired.status, 400);
        assert.match(expired.body.message, /invalid or has expired/);
    });

    it("never emails a code to a suspended account", async () => {
        const user = await createUser({ isSuspended: true });

        const response = await request("POST", "/api/auth/forgot-password", {
            json: { email: user.email },
        });
        assert.equal(response.status, 200);

        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(mailCountFor(user.email), 0);
    });
});
