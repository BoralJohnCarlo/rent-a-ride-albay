import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";

import LegalDocument from "../../models/LegalDocument.js";
import User from "../../models/User.js";

import routes from "../../routes/index.js";
import errorMiddleware from "../../middleware/errorMiddleware.js";
import generateToken from "../../utils/generateToken.js";

import { connectTestDb, disconnectTestDb } from "../helpers/testDb.js";

/*
 * Settings → Terms & Policies over HTTP: the real routes, guards and
 * validators, as the browser calls them.
 */

let server;
let baseUrl;
let adminCookie;
let customerCookie;

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
    };
};

const insertUser = async (role) => {
    const _id = new mongoose.Types.ObjectId();

    await User.collection.insertOne({
        _id,
        role,
        firstName: role,
        lastName: "Tester",
        email: `${role}-${_id}@test.local`,
        isVerified: true,
    });

    return `token=${generateToken({ id: _id })}`;
};

before(async () => {
    await connectTestDb();
    await Promise.all([User.init(), LegalDocument.init()]);

    adminCookie = await insertUser("admin");
    customerCookie = await insertUser("customer");

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

describe("legal documents over HTTP", () => {
    it("serves the current version publicly", async () => {
        const { status, body } = await request(
            "GET",
            "/api/legal-documents/public/booking-terms"
        );

        assert.equal(status, 200);
        assert.equal(body.data.version, 1);
        assert.equal(body.data.type, "booking-terms");

        const missing = await request(
            "GET",
            "/api/legal-documents/public/not-a-document"
        );
        assert.equal(missing.status, 404);
    });

    it("lets only admins see drafts and publish", async () => {
        const anonymous = await request("GET", "/api/legal-documents/booking-terms");
        assert.equal(anonymous.status, 401);

        const customer = await request("POST", "/api/legal-documents/booking-terms/publish", {
            cookie: customerCookie,
            json: { content: {} },
        });
        assert.equal(customer.status, 403);
    });

    it("saves a draft, publishes it, and keeps serving the old version by id", async () => {
        const before = await request(
            "GET",
            "/api/legal-documents/public/partner-terms"
        );
        const v1 = before.body.data;

        const content = {
            title: "Partner Terms",
            notice: { title: "", body: "Read carefully." },
            acceptanceLabel: "I agree to the Partner Terms.",
            sections: [
                {
                    title: "Commission",
                    icon: "wallet",
                    items: [{ kind: "text", text: "A 20% commission applies." }],
                },
            ],
        };

        const draft = await request("PUT", "/api/legal-documents/partner-terms/draft", {
            cookie: adminCookie,
            json: content,
        });
        assert.equal(draft.status, 200, JSON.stringify(draft.body));

        const view = await request("GET", "/api/legal-documents/partner-terms", {
            cookie: adminCookie,
        });
        assert.equal(view.body.data.draft.title, "Partner Terms");
        assert.equal(view.body.data.current.version, 1);

        const published = await request(
            "POST",
            "/api/legal-documents/partner-terms/publish",
            {
                cookie: adminCookie,
                json: { content, changeNote: "New commission rate." },
            }
        );
        assert.equal(published.status, 201, JSON.stringify(published.body));
        assert.equal(published.body.data.version, 2);

        const current = await request(
            "GET",
            "/api/legal-documents/public/partner-terms"
        );
        assert.equal(current.body.data.version, 2);

        const old = await request(
            "GET",
            `/api/legal-documents/public/versions/${v1._id}`
        );
        assert.equal(old.status, 200);
        assert.equal(old.body.data.version, 1);
        assert.deepEqual(old.body.data.sections, v1.sections);
    });

    it("refuses to publish an incomplete document", async () => {
        const { status, body } = await request(
            "POST",
            "/api/legal-documents/booking-terms/publish",
            {
                cookie: adminCookie,
                json: { content: { title: "Terms", sections: [] } },
            }
        );

        assert.equal(status, 400);
        assert.match(body.message, /at least one section/);
    });

    it("requires a booking to say which terms version was accepted", async () => {
        const { status, body } = await request("POST", "/api/bookings", {
            cookie: customerCookie,
            json: { vehicle: new mongoose.Types.ObjectId().toString() },
        });

        assert.equal(status, 400);

        const fields = body.errors.map((error) => error.path);
        assert.ok(fields.includes("termsAccepted"));
        assert.ok(fields.includes("termsVersionId"));
    });
});
