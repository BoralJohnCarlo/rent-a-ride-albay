import { it } from "node:test";
import assert from "node:assert/strict";
import { validationResult } from "express-validator";
import { registerValidator } from "../../validators/authValidator.js";

const errorsFor = async (field, value) => {
    const req = { body: { [field]: value } };
    const rule = registerValidator.find((entry) => entry.builder.fields.includes(field));
    await rule.run(req);
    return validationResult(req).array();
};

it("rejects impossible birthdates and values other than calendar dates", async () => {
    for (const value of ["1990-02-31", "2001-02-29", "1990-04-31", "1990-01-01T00:00:00Z", 19900101]) {
        const errors = await errorsFor("birthdate", value);
        assert.ok(errors.some((error) => error.msg === "Birthdate must be a valid date"), String(value));
    }
    assert.deepEqual(await errorsFor("birthdate", "2000-02-29"), []);
});

it("rejects impossible license expiry dates and timestamps", async () => {
    const year = new Date().getFullYear() + 4;
    for (const value of [`${year}-02-31`, `${year}-04-31`, `${year}-01-01T00:00:00Z`]) {
        const errors = await errorsFor("licenseExpirationDate", value);
        assert.ok(errors.some((error) => error.msg === "Please enter a valid date."), value);
    }
    assert.deepEqual(await errorsFor("licenseExpirationDate", `${year}-12-31`), []);
    assert.deepEqual(await errorsFor("licenseExpirationDate", ""), []);
});
