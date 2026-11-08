import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validationResult } from "express-validator";
import { registerValidator, registerOperatorValidator } from "../../validators/authValidator.js";
import { getPasswordError } from "../../../client/src/utils/registrationRules.js";

const address = { barangay: "Bitano", cityMunicipality: "Legazpi City", province: "Albay", region: "Region V", postalCode: "4500" };
const validate = async (rules, body, prefix) => {
    const req = { body: structuredClone(body) };
    for (const rule of rules.filter(rule => rule.builder.fields.some(field => field.startsWith(prefix)))) {
        await rule.run(req);
    }
    return validationResult(req).array();
};

test("registration password limits count UTF-8 bytes consistently in the browser and API", async () => {
    for (const rules of [registerValidator, registerOperatorValidator]) {
        for (const password of ["Aa1" + "x".repeat(69), "Aa1" + "é".repeat(34) + "x"]) {
            assert.equal(getPasswordError(password), "");
            assert.deepEqual(await validate(rules, { password }, "password"), []);
        }
        for (const password of ["Aa1" + "x".repeat(70), "Aa1" + "é".repeat(35), "Aa1" + "😀".repeat(18)]) {
            assert.match(getPasswordError(password), /72 UTF-8 bytes/);
            assert.ok((await validate(rules, { password }, "password")).some(error => /72 UTF-8 bytes/.test(error.msg)));
        }
    }
});

test("registration hashing rejects oversized passwords even without HTTP validators", async () => {
    const source = readFileSync(new URL("../../services/authService.js", import.meta.url), "utf8");
    const start = source.indexOf("const hashPassword =");
    const end = source.indexOf("\n};", start) + 3;
    const hash = new Function("Buffer", `${source.slice(start, end)}; return hashPassword;`)(Buffer);
    await assert.rejects(hash("Aa1" + "x".repeat(70)), /72 UTF-8 bytes/);
});

test("registration requires address fields and a four digit postal code, with optional street and house", async () => {
    for (const rules of [registerValidator, registerOperatorValidator]) {
        assert.deepEqual(await validate(rules, { currentAddress: address }, "currentAddress"), []);
        for (const field of Object.keys(address)) {
            for (const value of [undefined, null, "   ", 123]) {
                assert.ok((await validate(rules, { currentAddress: { ...address, [field]: value } }, "currentAddress"))
                    .some(error => error.path === `currentAddress.${field}`), `${field}: ${value}`);
            }
        }
        assert.ok((await validate(rules, {}, "currentAddress")).length);
        for (const postalCode of ["abc", "123", "12345", "12 34"]) {
            assert.ok((await validate(rules, { currentAddress: { ...address, postalCode } }, "currentAddress"))
                .some(error => error.path === "currentAddress.postalCode"));
        }
    }
});
