import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
    normalizeTelemetryPayload,
    isTimestampTooFarInFuture,
} from "../../services/telemetryNormalizationService.js";
import { ingestTelemetryValidator } from "../../validators/telemetryValidator.js";
import { validationResult } from "express-validator";
import { TELEMETRY_MAX_FUTURE_SKEW_MS } from "../../constants/telemetryConstants.js";

const runIngestValidator = async (body) => {
    const req = { body, headers: {} };

    for (const chain of ingestTelemetryValidator) {
        await chain.run(req);
    }

    return validationResult(req);
};

describe("normalizeTelemetryPayload", () => {
    it("converts a full payload to the canonical shape", () => {
        const result = normalizeTelemetryPayload({
            latitude: "13.1391",
            longitude: "123.7438",
            speed: 42,
            heading: 90,
            ignition: true,
            batteryLevel: 80,
            gpsFix: true,
            recordedAt: "2026-09-29T08:00:00.000Z",
        });

        assert.deepEqual(result, {
            latitude: 13.1391,
            longitude: 123.7438,
            speed: 42,
            heading: 90,
            ignition: true,
            batteryLevel: 80,
            gpsFix: true,
            recordedAt: new Date("2026-09-29T08:00:00.000Z"),
        });
    });

    it("keeps unreported optional values as null (unknown)", () => {
        const result = normalizeTelemetryPayload({
            latitude: 13,
            longitude: 123,
        });

        assert.equal(result.speed, null);
        assert.equal(result.heading, null);
        assert.equal(result.ignition, null);
        assert.equal(result.batteryLevel, null);
        assert.ok(result.recordedAt instanceof Date);
    });

    it("treats a missing or null gpsFix as unknown, never as no-fix", () => {
        assert.equal(
            normalizeTelemetryPayload({ latitude: 1, longitude: 1 }).gpsFix,
            null
        );
        assert.equal(
            normalizeTelemetryPayload({
                latitude: 1,
                longitude: 1,
                gpsFix: null,
            }).gpsFix,
            null
        );
        assert.equal(
            normalizeTelemetryPayload({
                latitude: 1,
                longitude: 1,
                gpsFix: false,
            }).gpsFix,
            false
        );
    });

    it('maps string booleans correctly ("false" is false)', () => {
        const result = normalizeTelemetryPayload({
            latitude: 1,
            longitude: 1,
            gpsFix: "false",
            ignition: "true",
        });

        assert.equal(result.gpsFix, false);
        assert.equal(result.ignition, true);
    });

    it("never carries a client-supplied source", () => {
        const result = normalizeTelemetryPayload({
            latitude: 1,
            longitude: 1,
            source: "something-else",
        });

        assert.equal("source" in result, false);
    });
});

describe("future timestamp rejection", () => {
    it("accepts now and timestamps within the allowed clock skew", () => {
        const now = Date.now();

        assert.equal(isTimestampTooFarInFuture(new Date(now), now), false);
        assert.equal(
            isTimestampTooFarInFuture(
                new Date(now + TELEMETRY_MAX_FUTURE_SKEW_MS - 1000),
                now
            ),
            false
        );
        assert.equal(
            isTimestampTooFarInFuture(new Date(now - 60 * 60 * 1000), now),
            false
        );
    });

    it("flags timestamps beyond the allowed clock skew", () => {
        const now = Date.now();

        assert.equal(
            isTimestampTooFarInFuture(
                new Date(now + TELEMETRY_MAX_FUTURE_SKEW_MS + 1000),
                now
            ),
            true
        );
    });

    it("the ingest validator rejects a far-future recordedAt with the standard error shape", async () => {
        const result = await runIngestValidator({
            latitude: 13,
            longitude: 123,
            recordedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });

        assert.equal(result.isEmpty(), false);
        assert.equal(result.array()[0].path, "recordedAt");
    });

    it("the ingest validator accepts a current recordedAt and a null gpsFix", async () => {
        const result = await runIngestValidator({
            latitude: 13,
            longitude: 123,
            gpsFix: null,
            recordedAt: new Date().toISOString(),
        });

        assert.equal(result.isEmpty(), true);
    });
});
