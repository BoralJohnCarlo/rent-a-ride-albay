import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../services/authService.js", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("export const verifyEmail ="), source.indexOf("export const resendVerificationEmail =")).replace("export const", "const");

const setup = ({ replaceBeforeIncrement = false, replaceBeforeLock = false } = {}) => {
    let state = { _id:"pending", emailVerificationToken:"old-token", emailVerificationExpires:new Date(Date.now()+600000), verificationAttempts:4 };
    const replace = () => { state = {...state,emailVerificationToken:"fresh-token",verificationAttempts:0}; };
    const match = query => query._id === state._id && query.emailVerificationToken === state.emailVerificationToken && state.emailVerificationExpires > query.emailVerificationExpires.$gt;
    const PendingRegistration = {
        findOne:()=>{ const snapshot={...state}; return {select:async()=>snapshot}; },
        findOneAndUpdate:async(query,update)=>{
            if(replaceBeforeIncrement) replace();
            if(!match(query)) return null;
            state.verificationAttempts += update.$inc.verificationAttempts;
            return {...state};
        },
        updateOne:async(query,update)=>{
            if(replaceBeforeLock) replace();
            if(match(query)) Object.assign(state,update.$set);
        },
    };
    const verify = new Function("PendingRegistration","crypto","MAX_VERIFICATION_ATTEMPTS", `${handler};return verifyEmail;`)(PendingRegistration,crypto,5);
    return {verify,state:()=>state};
};

test("old concurrent verification requests do not count against a fresh code", async () => {
    const fixture = setup({replaceBeforeIncrement:true});
    const results = await Promise.allSettled(Array.from({length:5},()=>fixture.verify("customer@example.test","111111")));
    assert.ok(results.every(result=>result.status==="rejected" && /changed or expired/.test(result.reason.message)));
    assert.equal(fixture.state().emailVerificationToken,"fresh-token");
    assert.equal(fixture.state().verificationAttempts,0);
});

test("resend between the fifth wrong guess and lockout preserves the fresh code", async () => {
    const fixture = setup({replaceBeforeLock:true});
    await assert.rejects(fixture.verify("customer@example.test","111111"),/Too many incorrect codes/);
    assert.equal(fixture.state().emailVerificationToken,"fresh-token");
    assert.equal(fixture.state().verificationAttempts,0);
});

test("five incorrect guesses still lock the code they belong to", async () => {
    const fixture = setup();
    await assert.rejects(fixture.verify("customer@example.test","111111"),/Too many incorrect codes/);
    assert.equal(fixture.state().emailVerificationToken,null);
    assert.equal(fixture.state().verificationAttempts,5);
});

test("an account created by overlapping verification is reported as already verified", async () => {
    const code = "123456";
    const pending = {
        email: "customer@example.test", role: "customer", phoneNumber: "09175551234",
        emailVerificationToken: crypto.createHash("sha256").update(code).digest("hex"),
    };
    const deps = {
        PendingRegistration: { findOne: () => ({ select: async () => pending }) },
        User: { exists: async query => { assert.equal(query.email, pending.email); return true; } },
        assertIdentityAllowed: async () => { throw new Error("This phone number is already used by another account."); },
        crypto, ALREADY_VERIFIED_MESSAGE: "Your email is already verified. You can log in now.",
        createError: (message,statusCode) => Object.assign(new Error(message),{statusCode}),
    };
    const verify = new Function(...Object.keys(deps), `${handler};return verifyEmail;`)(...Object.values(deps));
    await assert.rejects(verify(pending.email,code), error => error.statusCode === 409 && /already verified/.test(error.message));
});
