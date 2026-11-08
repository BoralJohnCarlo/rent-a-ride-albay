import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../services/authService.js", import.meta.url), "utf8");
const start = source.indexOf("const resolveRegistrationTerms =");
const handler = source.slice(start, source.indexOf("const savePendingRegistration =", start));
const setup = resolver => new Function("resolveAcceptedLegalVersion","LEGAL_DOCUMENT_TYPES","REGISTRATION_TERMS_OUTDATED_MESSAGE","createError", `${handler};return resolveRegistrationTerms;`)(
    resolver, {BOOKING_TERMS:"booking_terms"}, "outdated", (message,statusCode)=>Object.assign(new Error(message),{statusCode})
);

test("registration rejects an absent terms version without substituting current terms", async () => {
    let calls=0;
    const resolve=setup(async()=>{calls++;});
    for(const id of [undefined,null,""]) {
        await assert.rejects(resolve(id),error=>error.statusCode===400 && /load the Terms/.test(error.message));
    }
    assert.equal(calls,0);
});

test("registration resolves the exact accepted version and retains outdated-version rejection", async () => {
    const resolve=setup(async(type,id)=>{
        assert.equal(type,"booking_terms");
        assert.equal(id,"shown-version");
        return {document:id,version:2};
    });
    assert.deepEqual(await resolve("shown-version"),{termsDocument:"shown-version",termsVersion:2});
    await assert.rejects(setup(async()=>{throw new Error("outdated");})("old-version"),/outdated/);
});
