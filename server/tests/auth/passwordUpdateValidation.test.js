import assert from "node:assert/strict";
import { test } from "node:test";
import { validationResult } from "express-validator";
import { resetPasswordValidator } from "../../validators/authValidator.js";
import { changePasswordValidator } from "../../validators/userValidator.js";
import { getPasswordRules } from "../../../client/src/utils/passwordRules.js";

const errorsFor = async (rules, password) => {
    const req = { body: { newPassword: password } };
    for (const rule of rules.filter(rule => rule.builder.fields.includes("newPassword"))) await rule.run(req);
    return validationResult(req).array();
};

test("reset and change password agree with the checklist at the UTF-8 byte boundary", async () => {
    for (const [password, accepted] of [
        ["Aa1" + "x".repeat(69), true],
        ["Aa1" + "é".repeat(34) + "x", true],
        ["Aa1" + "😀".repeat(17) + "x", true],
        ["Aa1" + "x".repeat(70), false],
        ["Aa1" + "é".repeat(35), false],
        ["Aa1" + "😀".repeat(18), false],
    ]) {
        for (const currentPassword of [undefined, "OriginalPass123"]) {
            assert.equal(getPasswordRules({ newPassword: password, confirmPassword: password, currentPassword }).every(rule => rule.met), accepted);
        }
        for (const rules of [resetPasswordValidator, changePasswordValidator]) {
            const errors = await errorsFor(rules, password);
            assert.equal(errors.length === 0, accepted);
            if (!accepted) assert.ok(errors.some(error => /72 UTF-8 bytes/.test(error.msg)));
        }
    }
});

test("an existing long current password is not capped while changing to a valid new password", async () => {
    const req = { body: { currentPassword: "Aa1" + "x".repeat(100) } };
    await changePasswordValidator.find(rule => rule.builder.fields.includes("currentPassword")).run(req);
    assert.deepEqual(validationResult(req).array(), []);
});
