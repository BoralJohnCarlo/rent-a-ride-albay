import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

for (const form of ["Register", "RegisterOperator"]) {
    test(form + " keeps country codes and updates the correct contact field", () => {
        const source = readFileSync(new URL("../src/pages/public/" + form + ".jsx", import.meta.url), "utf8").replaceAll("\r\n", "\n");
        const start = source.indexOf("    const handlePhoneNumberChange =");
        const handler = source.slice(start, source.indexOf("\n    };", start) + 7);
        for (const field of ["phoneNumber", "alternativeContact"]) {
            let state = { phoneNumber: "+639171234567", alternativeContact: "" };
            const otherField = field === "phoneNumber" ? "alternativeContact" : "phoneNumber";
            const originalOther = state[otherField];
            const onChange = new Function("setFormData", "validationErrors", "setValidationErrors", "hasValidated", "clearFieldErrors", handler + "; return handlePhoneNumberChange;")(
                update => { state = update(state); }, {}, () => {}, false, () => {}
            );
            onChange({ target: { name: field, value: "+639369875311" } });
            assert.equal(state[field], "+639369875311");
            assert.equal(state[otherField], originalOther);
            for (const value of ["+63 936 987 5311", "63+9369875311", "+639369875311extra", "+6393698753110"]) {
                onChange({ target: { name: field, value } });
                assert.equal(state[field], "+639369875311");
            }
            onChange({ target: { name: field, value: "" } });
            assert.equal(state[field], "");
        }
    });
}
