import { it } from "node:test";
import assert from "node:assert/strict";
import { getRegistrationErrorField, getPhoneUpdate, getPhoneUpdateError, getAlternativeContactUpdate, getAlternativeContactUpdateError } from "../../../client/src/utils/registrationRules.js";

it("routes changed license requirements back to their editable fields", () => {
    for (const [message, field] of [
        ["Please select at least one driving category.", "licenseCodes"],
        ["Motorcycle transmission is required when license code A is selected.", "motorcycleTransmission"],
        ["Car transmission is required when license code B is selected.", "carTransmission"],
        ["License number is required when you have a driver's license.", "licenseNumber"],
        ["Your driver's license has already expired. Please renew it, or register without a license for now.", "licenseExpirationDate"],
    ]) {
        assert.equal(getRegistrationErrorField(message), field);
    }
    assert.equal(getRegistrationErrorField("Something went wrong on our side."), null);
});

it("unchanged legacy phone numbers do not block unrelated edits", () => {
    for (const phone of ["09171234567", "+63 917 123 4567", "+12025550123", ""]) {
        assert.deepEqual(getPhoneUpdate(phone, phone), {});
        assert.equal(getPhoneUpdateError(phone, phone), "");
    }
    assert.deepEqual(getPhoneUpdate("+639369875311", "09171234567"), { phoneNumber: "+639369875311" });
    assert.equal(getPhoneUpdateError("+639369875311", "09171234567"), "");
    assert.ok(getPhoneUpdateError("09369875311", "09171234567"));
    assert.ok(getPhoneUpdateError("", "09171234567"));
    assert.ok(getPhoneUpdateError("+639369875311extra", "09171234567"));
    assert.equal(getRegistrationErrorField("Enter a Philippine mobile number in +639XXXXXXXXX format."), "phoneNumber");
});

it("alternative contact edits preserve legacy data and allow clearing an optional contact", () => {
    assert.deepEqual(getAlternativeContactUpdate("09171234567", "09171234567"), {});
    assert.equal(getAlternativeContactUpdateError("09171234567", "09171234567"), "");
    assert.deepEqual(getAlternativeContactUpdate("", "09171234567"), { alternativeContact: "" });
    assert.equal(getAlternativeContactUpdateError("", "09171234567"), "");
    assert.ok(getAlternativeContactUpdateError("09175555555", "09171234567"));
    assert.equal(getAlternativeContactUpdateError("+639369875311", "09171234567"), "");
    assert.equal(getRegistrationErrorField("Alternative contact must use +639XXXXXXXXX format."), "alternativeContact");
});
