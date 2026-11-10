import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { validationResult } from "express-validator";
import { registerValidator, registerOperatorValidator } from "../../validators/authValidator.js";
import { updateProfileValidator, updateUserValidator, createUserValidator } from "../../validators/userValidator.js";
import { getPasswordError, getPhoneError, getAlternativeContactError } from "../../../client/src/utils/registrationRules.js";

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

test("customer and operator signup require an exact Philippine mobile number", async () => {
    for (const rules of [registerValidator, registerOperatorValidator]) {
        for (const phoneNumber of ["+639369875311", "+639171234567"]) {
            assert.equal(getPhoneError(phoneNumber), "");
            assert.deepEqual(await validate(rules, { phoneNumber }, "phoneNumber"), []);
        }
        for (const phoneNumber of ["", "09369875311", "639369875311", "63+9369875311", "+63 936 987 5311", "+63936-987-5311", "+6393698753110", "+63936987531", "+638369875311", "+12025550123", " +639369875311", "+639369875311 ", "+639369875311x", "+639369875311\n", "+639369875311\r\n", 639369875311, null]) {
            assert.ok(getPhoneError(phoneNumber), String(phoneNumber));
            assert.ok((await validate(rules, { phoneNumber }, "phoneNumber")).length, String(phoneNumber));
        }
    }
});

test("account edits and admin account creation enforce the same mobile format", async () => {
    for (const rules of [updateProfileValidator, updateUserValidator, createUserValidator]) {
        assert.deepEqual(await validate(rules, { phoneNumber: "+639369875311" }, "phoneNumber"), []);
        for (const phoneNumber of ["09369875311", "+12025550123", "+639369875311extra", "", null]) {
            assert.ok((await validate(rules, { phoneNumber }, "phoneNumber")).length);
        }
    }
});

test("signup preserves the canonical phone value passed to storage and display", async () => {
    for (const rules of [registerValidator, registerOperatorValidator]) {
        const req = { body: { phoneNumber: "+639369875311" } };
        for (const rule of rules.filter(rule => rule.builder.fields.includes("phoneNumber"))) await rule.run(req);
        assert.deepEqual(validationResult(req).array(), []);
        assert.equal(req.body.phoneNumber, "+639369875311");
    }
});

test("alternative contact shares the Philippine format across signup and account APIs", async () => {
    for (const rules of [registerValidator, registerOperatorValidator, updateProfileValidator, updateUserValidator, createUserValidator]) {
        for (const alternativeContact of [undefined, "", "+639369875311"]) {
            assert.equal(getAlternativeContactError(alternativeContact), "");
            assert.deepEqual(await validate(rules, { alternativeContact }, "alternativeContact"), []);
        }
        for (const alternativeContact of ["09369875311", "639369875311", "63+9369875311", "+12025550123", "+638369875311", "+63936987531", "+6393698753110", "+63 936 987 5311", " +639369875311", "+639369875311 ", "+639369875311\n", "letters", "   ", null, 639369875311, ["+639369875311"]]) {
            assert.ok(getAlternativeContactError(alternativeContact), String(alternativeContact));
            assert.ok((await validate(rules, { alternativeContact }, "alternativeContact")).length, String(alternativeContact));
        }
    }
});
