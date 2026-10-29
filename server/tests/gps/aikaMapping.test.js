import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    mapAikaTracking,
    parseAikaPositionTime,
    parseAikaIgnition,
    resolveAikaLastContact,
    AIKA_ONLINE_MAX_MS,
} from "../../services/aika/aikaPoller.js";
import {
    createAikaClient,
    parseAsmxJson,
    readAikaConfig,
} from "../../services/aika/aikaClient.js";
import {
    AIKA_PARKED_REPLY,
    AIKA_MOVING_REPLY,
    AIKA_POWERED_ON_REPLY,
    AIKA_MOVING_POLLED_AT,
    AIKA_PARKED_POLLED_AT,
} from "./fixtures/aikaResponses.js";

describe("mapAikaTracking (real AK-61220 replies)", () => {
    it("maps the parked reply to the canonical normalized shape", () => {
        assert.deepEqual(mapAikaTracking(AIKA_PARKED_REPLY), {
            latitude: 13.35536,
            longitude: 123.70982,
            speed: 0,
            heading: 66,
            ignition: false,
            batteryLevel: null,
            gpsFix: true,
            recordedAt: new Date("2026-10-01T02:56:56Z"),
        });
    });

    it("maps the moving reply, treating speed as km/h unchanged", () => {
        const reading = mapAikaTracking(AIKA_MOVING_REPLY);

        assert.equal(reading.latitude, 13.35546);
        assert.equal(reading.longitude, 123.71023);
        assert.equal(reading.speed, 11.11);
        assert.equal(reading.heading, 242);
        assert.equal(reading.ignition, false);
        assert.deepEqual(reading.recordedAt, new Date("2026-10-01T03:30:44Z"));
    });

    it("never stores -1 (or other out-of-range values) as battery", () => {
        assert.equal(mapAikaTracking(AIKA_PARKED_REPLY).batteryLevel, null);
        assert.equal(
            mapAikaTracking({ ...AIKA_PARKED_REPLY, battery: "150" }).batteryLevel,
            null
        );
        assert.equal(
            mapAikaTracking({ ...AIKA_PARKED_REPLY, battery: "" }).batteryLevel,
            null
        );
        assert.equal(
            mapAikaTracking({ ...AIKA_PARKED_REPLY, battery: "85" }).batteryLevel,
            85
        );
    });

    it("maps isGPS: '1' true, '0' false, anything else unknown", () => {
        const fix = (isGPS) =>
            mapAikaTracking({ ...AIKA_PARKED_REPLY, isGPS }).gpsFix;

        assert.equal(fix("1"), true);
        assert.equal(fix("0"), false);
        assert.equal(fix(""), null);
        assert.equal(fix(undefined), null);
    });

    it("returns null instead of inventing a position", () => {
        assert.equal(mapAikaTracking(null), null);
        assert.equal(mapAikaTracking({ ...AIKA_PARKED_REPLY, lat: "" }), null);
        assert.equal(mapAikaTracking({ ...AIKA_PARKED_REPLY, lng: "abc" }), null);
        assert.equal(
            mapAikaTracking({ ...AIKA_PARKED_REPLY, lat: "0", lng: "0" }),
            null
        );
        assert.equal(mapAikaTracking({ ...AIKA_PARKED_REPLY, lat: "91" }), null);
        assert.equal(
            mapAikaTracking({ ...AIKA_PARKED_REPLY, positionTime: "" }),
            null
        );
    });

    it("keeps empty speed/course unknown rather than 0", () => {
        const reading = mapAikaTracking({
            ...AIKA_PARKED_REPLY,
            speed: "",
            course: "",
        });

        assert.equal(reading.speed, null);
        assert.equal(reading.heading, null);
    });
});

describe("parseAikaPositionTime", () => {
    it("reads AIKA's positionTime as UTC", () => {
        assert.deepEqual(
            parseAikaPositionTime("2026-10-01 03:30:44"),
            new Date("2026-10-01T03:30:44Z")
        );
    });

    it("rejects other formats", () => {
        assert.equal(parseAikaPositionTime("2026/09/30 03:03"), null);
        assert.equal(parseAikaPositionTime("2026-10-01T03:30:44Z"), null);
        assert.equal(parseAikaPositionTime(""), null);
        assert.equal(parseAikaPositionTime(undefined), null);
    });
});

describe("parseAikaIgnition", () => {
    it("parses ACC ON / ACC OFF and leaves anything else unknown", () => {
        assert.equal(parseAikaIgnition("2-ACC OFF,Dismiss,Power Connected"), false);
        assert.equal(parseAikaIgnition("1-ACC ON,Dismiss,Power Connected"), true);
        assert.equal(parseAikaIgnition("Dismiss,Power Connected"), null);
        assert.equal(parseAikaIgnition(""), null);
        assert.equal(parseAikaIgnition(undefined), null);
        assert.equal(parseAikaIgnition("ACC ON,ACC OFF"), null);
    });
});

describe("resolveAikaLastContact (ofl)", () => {
    it("derives the last contact time from ofl minutes", () => {
        assert.deepEqual(
            resolveAikaLastContact(AIKA_MOVING_REPLY, AIKA_MOVING_POLLED_AT),
            AIKA_MOVING_POLLED_AT
        );
        assert.deepEqual(
            resolveAikaLastContact(
                { ...AIKA_PARKED_REPLY, ofl: "4" },
                AIKA_PARKED_POLLED_AT
            ),
            new Date(AIKA_PARKED_POLLED_AT.getTime() - 4 * 60 * 1000)
        );
    });

    it("treats contact older than the AIKA threshold as not online", () => {
        // The real parked reply: ofl 15 minutes > 10-minute threshold.
        assert.equal(AIKA_ONLINE_MAX_MS, 10 * 60 * 1000);
        assert.equal(
            resolveAikaLastContact(AIKA_PARKED_REPLY, AIKA_PARKED_POLLED_AT),
            null
        );
    });

    it("treats a missing or invalid ofl as unknown", () => {
        assert.equal(resolveAikaLastContact({ ...AIKA_POWERED_ON_REPLY, ofl: "" }), null);
        assert.equal(resolveAikaLastContact({ ...AIKA_POWERED_ON_REPLY, ofl: "-1" }), null);
        assert.equal(resolveAikaLastContact(null), null);
    });
});

describe("aikaClient", () => {
    const config = readAikaConfig({
        AIKA_API_URL: "http://aika.test/openapiv3.asmx",
        AIKA_LOGIN_NAME: "9176761220",
        AIKA_PASSWORD: "secret-password",
        AIKA_APP_KEY: "app-key",
    });

    const asmx = (body) =>
        `<?xml version="1.0" encoding="utf-8"?><string xmlns="http://tempuri.org/">${JSON.stringify(body).replace(/"/g, "&quot;")}</string>`;

    const LOGIN_REPLY = {
        state: "0",
        deviceInfo: {
            deviceID: "3237204",
            model: "71",
            sn: "9176761220",
            deviceName: "AK-61220",
            key2018: "session-key-1",
        },
    };

    // Fake fetch that records requests and answers per operation.
    const makeFetch = (handlers) => {
        const calls = [];

        const fetchImpl = async (url, options = {}) => {
            const operation = url.split("/").pop();
            const params = Object.fromEntries(
                new URLSearchParams(options.body || "")
            );
            calls.push({ operation, params });

            return {
                ok: true,
                status: 200,
                text: async () => asmx(handlers[operation](params, calls)),
            };
        };

        return { fetchImpl, calls };
    };

    it("parses JSON wrapped in an ASMX <string> element", () => {
        assert.deepEqual(parseAsmxJson(asmx({ state: "0" }), "Test"), {
            state: "0",
        });
        assert.throws(() => parseAsmxJson("<html>", "Test"), /unexpected response/);
    });

    it("logs in, then calls GetTracking with AIKA's internal device ID and session key", async () => {
        const { fetchImpl, calls } = makeFetch({
            Login: () => LOGIN_REPLY,
            GetTracking: () => AIKA_PARKED_REPLY,
        });
        const client = createAikaClient(config, { fetchImpl });

        const session = await client.ensureSession();
        const tracking = await client.getTracking();

        assert.deepEqual(session, {
            deviceId: "3237204",
            model: "71",
            serial: "9176761220",
            deviceName: "AK-61220",
        });
        assert.equal(tracking.positionTime, AIKA_PARKED_REPLY.positionTime);
        assert.equal(calls[1].operation, "GetTracking");
        assert.equal(calls[1].params.DeviceID, "3237204");
        assert.equal(calls[1].params.Key, "session-key-1");
    });

    it("re-logs in once when a session call is rejected", async () => {
        let trackingCalls = 0;
        const { fetchImpl, calls } = makeFetch({
            Login: () => LOGIN_REPLY,
            GetTracking: () => {
                trackingCalls += 1;
                return trackingCalls === 1 ? { state: "2" } : AIKA_PARKED_REPLY;
            },
        });
        const client = createAikaClient(config, { fetchImpl });

        await client.getTracking();

        assert.deepEqual(
            calls.map((call) => call.operation),
            ["Login", "GetTracking", "Login", "GetTracking"]
        );
    });

    it("never puts the password or session key in errors", async () => {
        const { fetchImpl } = makeFetch({
            Login: () => ({ state: "1", echo: "secret-password" }),
        });
        const client = createAikaClient(config, { fetchImpl });

        await assert.rejects(client.getTracking(), (error) => {
            assert.match(error.message, /Login: rejected \(state 1\)/);
            assert.doesNotMatch(error.message, /secret-password|app-key/);
            return true;
        });
    });

    it("never exposes the session key in session info", async () => {
        const { fetchImpl } = makeFetch({ Login: () => LOGIN_REPLY });
        const client = createAikaClient(config, { fetchImpl });

        await client.ensureSession();

        assert.doesNotMatch(
            JSON.stringify(client.getSessionInfo()),
            /session-key-1/
        );
    });
});
