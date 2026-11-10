import test from "node:test";
import assert from "node:assert/strict";
import validator from "../../server/node_modules/validator/index.js";
import { getPasswordError } from "../src/utils/registrationRules.js";
import { getRegistrationPasswordFeedback as feedback } from "../src/utils/registrationPasswordFeedback.js";

test("unmet requirements stay visible throughout typing and disappear only for a valid password", () => {
    for (const password of ["", "p", "password", "Password", "Password1".slice(0, 7)]) {
        assert.ok(feedback(password).passwordError);
        assert.ok(feedback(password).unmet.length > 0);
    }
    assert.equal(feedback("Password1").passwordError, "");
    assert.deepEqual(feedback("Password1").unmet, []);
    assert.ok(feedback("Password").unmet.some((rule) => rule.id === "number"));
    assert.ok(feedback("").passwordError, "clearing restores the error");
});

test("confirmation is neutral when empty, checks only matching, and follows edits to either field", () => {
    assert.equal(feedback("", "").matches, false);
    assert.equal(feedback("", "").confirmationError, "");
    assert.match(feedback("Password1", "", true).confirmationError, /confirm/i);
    assert.match(feedback("Password1", "Password").confirmationError, /do not match/);
    assert.equal(feedback("Password1", "Password1").matches, true);
    assert.match(feedback("Password2", "Password1").confirmationError, /do not match/);
    const weak = feedback("weak", "weak");
    assert.equal(weak.matches, true);
    assert.equal(weak.confirmationError, "");
    assert.ok(weak.passwordError, "matching does not imply strength");
    assert.equal(feedback("Password1", "password1").matches, false);
    assert.equal(feedback("Password1 ", "Password1").matches, false);
});

test("checklist, signup validator and server character/byte rules agree, including emoji and presentation sequences", () => {
    const samples = ["", "Password1", "PASSWORD1", "password1", "Password", "Pass123", "Aa1💖💖💖", "Aa1💖💖💖💖💖", "Aa1❤\uFE0F❤\uFE0F❤\uFE0F", "Aa1" + "a".repeat(69), "Aa1" + "a".repeat(70), "Aa1" + "é".repeat(34), "Aa1" + "é".repeat(35)];
    for (const password of samples) {
        const valid = password.length > 0 && validator.isLength(password, { min: 8 }) && new TextEncoder().encode(password).length <= 72 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
        assert.equal(!getPasswordError(password), valid, password);
        assert.equal(feedback(password).unmet.length === 0, valid, password);
    }
});
