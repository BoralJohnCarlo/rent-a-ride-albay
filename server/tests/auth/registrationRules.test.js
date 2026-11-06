import { it } from "node:test";
import assert from "node:assert/strict";
import { getRegistrationErrorField } from "../../../client/src/utils/registrationRules.js";

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
