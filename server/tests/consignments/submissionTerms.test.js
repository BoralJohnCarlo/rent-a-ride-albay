import test from "node:test";
import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import { submitConsignmentValidator } from "../../validators/consignmentValidator.js";

const validate = async (role, body) => {
    const req = { user: { role }, body };
    for (const validator of submitConsignmentValidator) await validator.run(req);
    return validationResult(req).array();
};

test("operator submission requires explicit acceptance and a version", async () => {
    for (const body of [{}, { termsAgreed: false }, { termsAgreed: "true" }]) {
        assert.ok((await validate("operator", body)).some((error) => error.path === "termsAgreed"));
    }
    assert.ok((await validate("operator", { termsAgreed: true })).some((error) => error.path === "termsVersionId"));
    assert.deepEqual(await validate("operator", {
        termsAgreed: true,
        termsVersionId: "507f1f77bcf86cd799439011",
    }), []);
});

test("admin can still submit on a partner's behalf without acceptance", async () => {
    assert.deepEqual(await validate("admin", {}), []);
});
