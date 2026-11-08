import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../services/authService.js", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("export const resendVerificationEmail ="), source.indexOf("export const loginUser"))
    .replace("export const", "const");

const setup = ({ failMail = false, newerDuringFailure = false } = {}) => {
    let state = { _id:"pending", email:"customer@example.test", emailVerificationToken:"old", emailVerificationExpires:new Date(Date.now()+7200000), lastCodeSentAt:new Date(Date.now()-120000), registrationStartedAt:new Date(), codesSent:1, verificationAttempts:2, temporaryUploadIds:[] };
    let sequence = 0;
    const sent = [];
    const match = query => Object.entries(query).every(([key,value]) => JSON.stringify(state[key]) === JSON.stringify(value));
    const deps = {
        phoneKey: () => "9175551234", PHONE_TAKEN_MESSAGE: "This phone number is already used by another account.",
        assertPhoneAvailable: async () => {},
        PendingRegistration: {
            findOne:()=>({select:async()=>structuredClone(state)}),
            findOneAndUpdate:(query,update)=>({select:async()=>{
                if (!match(query)) return null;
                state = {...state,...structuredClone(update.$set)};
                return structuredClone(state);
            }}),
            updateOne:async(query,update)=>{if(match(query)) state={...state,...structuredClone(update.$set)};},
        },
        User:{exists:async()=>false}, createError:(message,statusCode)=>Object.assign(new Error(message),{statusCode}),
        ACCOUNT_EXISTS_MESSAGE:"exists", RESEND_COOLDOWN_MS:60000, MAX_CODES_PER_REGISTRATION:10,
        EMAIL_VERIFICATION_EXPIRATION:7200000, MAX_REGISTRATION_LIFETIME:21600000,
        createEmailVerificationCode:()=>{const code=String(++sequence);return {rawCode:code,hashedCode:`hash-${code}`};},
        sendVerificationEmail:async(_pending,code)=>{
            if(failMail) {
                if(newerDuringFailure) state={...state,emailVerificationToken:"newer",codesSent:3};
                throw new Error("mail failed");
            }
            sent.push(code);
        },
        holdTemporaryUploadsUntil:async()=>{}, console:{error:()=>{}},
    };
    const resend = new Function(...Object.keys(deps), `${handler}; return resendVerificationEmail;`)(...Object.values(deps));
    return {resend, sent, state:()=>state};
};

test("overlapping resends send one code and count exactly one additional email", async () => {
    const fixture = setup();
    const results = await Promise.allSettled([fixture.resend("customer@example.test"),fixture.resend("customer@example.test")]);
    assert.equal(results.filter(result=>result.status==="fulfilled").length,1);
    assert.equal(results.find(result=>result.status==="rejected").reason.statusCode,429);
    assert.equal(fixture.sent.length,1);
    assert.equal(fixture.state().codesSent,2);
    assert.equal(fixture.state().emailVerificationToken,`hash-${fixture.sent[0]}`);
    await assert.rejects(fixture.resend("customer@example.test"),/Please wait/);
});

test("email failure restores the previous code and allows a retry", async () => {
    const fixture = setup({failMail:true});
    await assert.rejects(fixture.resend("customer@example.test"),/Failed to send/);
    assert.equal(fixture.state().emailVerificationToken,"old");
    assert.equal(fixture.state().codesSent,1);
    assert.equal(fixture.state().verificationAttempts,2);
    await assert.rejects(fixture.resend("customer@example.test"),/Failed to send/);
});

test("failed email cannot overwrite a newer verification token", async () => {
    const fixture = setup({failMail:true,newerDuringFailure:true});
    await assert.rejects(fixture.resend("customer@example.test"),/Failed to send/);
    assert.equal(fixture.state().emailVerificationToken,"newer");
    assert.equal(fixture.state().codesSent,3);
});
