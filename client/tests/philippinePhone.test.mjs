import test from "node:test";
import assert from "node:assert/strict";
import { toPhilippinePhone, nationalPhoneDigits } from "../src/utils/philippinePhone.js";
import { getPhoneError } from "../src/utils/registrationRules.js";

test("local, national, international and formatted pasted numbers share the API format", () => {
    for (const input of ["9171234567", "09171234567", "639171234567", "+639171234567", "+63 (917) 123-4567", "0917 123 4567"]) {
        const phone = toPhilippinePhone(input);
        assert.equal(phone, "+639171234567");
        assert.equal(getPhoneError(phone), "");
        assert.equal(nationalPhoneDigits(phone), "9171234567");
    }
});

test("editing, clearing and optional empty contacts do not retain a prefix-only value", () => {
    assert.equal(toPhilippinePhone(""), "");
    assert.equal(toPhilippinePhone("+63"), "");
    for (const value of ["9", "91", "917123456"]) {
        assert.equal(nationalPhoneDigits(toPhilippinePhone(value)), value);
        assert.notEqual(getPhoneError(toPhilippinePhone(value)), "");
    }
});

test("invalid characters, foreign prefixes and excess digits are not silently truncated", () => {
    for (const value of ["+6391712345670", "91712345678", "091712345678", "+1 9171234567", "63+9171234567", "917abc1234567"]) {
        assert.equal(toPhilippinePhone(value), null);
    }
    assert.notEqual(getPhoneError(toPhilippinePhone("8171234567")), "");
});
