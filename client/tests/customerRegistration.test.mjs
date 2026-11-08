import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getPasswordError } from "../src/utils/registrationRules.js";

const source = readFileSync(new URL("../src/pages/public/Register.jsx", import.meta.url), "utf8").replaceAll("\r\n", "\n");

test("registration blocks submission until the accepted terms version has loaded", () => {
    const ready = source.match(/    const termsReady =[^;]+;/)[0];
    const start = source.indexOf("    const validateStep =");
    const handler = source.slice(start, source.indexOf("    const handleNext =", start));
    for (const [document,loading,error,expected] of [[null,true,"",false],[null,false,"offline",false],[{_id:"old"},true,"",false],[{_id:"old"},false,"offline",false],[{_id:"shown"},false,"",true]]) {
        let errors;
        const valid = new Function("termsDocument","termsLoading","termsError","currentStep","formData","termsAgreed","getPasswordError","setValidationErrors", `${ready}${handler};return validateStep();`)(
            document,loading,error,2,{email:"customer@example.com",password:"Password123",confirmPassword:"Password123"},true,getPasswordError,value=>{errors=value;}
        );
        assert.equal(valid,expected);
        if(!expected) assert.match(errors.termsAgreed,/Terms and Conditions/);
    }
    assert.match(source,/disabled=\{!termsReady\}/);
    assert.match(source,/document=\{termsDocument\}/);
    assert.match(source,/Retry loading terms/);
});

test("transmission choices stay unique and can be toggled independently", () => {
    const handlers = source.slice(source.indexOf("    const handleTransmissionChange ="), source.indexOf("    const isMotorcycleTransmissionSelected"));
    for (const field of ["motorcycleTransmission", "carTransmission"]) {
        let state = { motorcycleTransmission: [], carTransmission: [] };
        const toggle = new Function("setFormData", `${handlers}; return handleTransmissionChange;`)(update => { state = update(state); });
        toggle(field, "automatic");
        toggle(field, "manual");
        assert.deepEqual([...state[field]].sort(), ["automatic", "manual"]);
        toggle(field, "manual");
        assert.deepEqual(state[field], ["automatic"]);
        toggle(field, "automatic");
        assert.deepEqual(state[field], []);
        toggle(field, "manual");
        toggle(field, "automatic");
        assert.deepEqual(state[field], []);
    }
});

const submit = async ({ registerError, failBackUpload = false } = {}) => {
    const removed = [];
    let uploadCount = 0;
    let step;
    const noop = () => {};
    const context = {
        submissionInFlightRef: { current: false }, registrationFlowRef: { current: false },
        loading: false, validateStep: () => true,
        idImages: [{ file: "front" }, { file: "back" }],
        formData: Object.fromEntries(["firstName", "lastName", "email", "password", "phoneNumber", "alternativeContact", "middleName", "licenseNumber"].map(key => [key, "test"])),
        uploadValidId: async () => {
            if (++uploadCount === 2 && failBackUpload) throw new Error("upload failed");
            return { data: { uploadId: `upload-${uploadCount}`, url: `https://example.com/${uploadCount}` } };
        },
        removeTemporaryValidId: async id => { removed.push(id); },
        proofOfBillingEnabled: false, licenseRestrictionEnabled: false,
        termsAgreed: true, termsDocument: { _id: "terms" },
        setIdUploading: noop, setValidationErrors: noop,
        setCurrentStep: value => { step = value; },
        startResendCooldown: noop, clearError: noop,
        setVerificationNotice: noop,
        rememberVerificationEmail: noop, navigate: noop,
        isPendingVerificationError: message => message.includes("waiting for verification"),
        isTermsOutdatedError: () => false, getRegistrationErrorField: () => null,
        register: async () => { if (registerError) throw registerError; },
    };
    const handler = source.slice(source.indexOf("    const handleSubmit ="), source.indexOf("    const getFieldError ="));
    await new Function(...Object.keys(context), `${handler}; return handleSubmit();`)(...Object.values(context));
    assert.equal(context.submissionInFlightRef.current, false);
    return { removed, step };
};

test("lost registration response preserves images needed by the saved registration", async () => {
    assert.deepEqual((await submit({ registerError: new Error("Network Error") })).removed, []);
});

test("retry into pending verification preserves uploads and opens the code step", async () => {
    const result = await submit({ registerError: "This email is waiting for verification" });
    assert.deepEqual(result.removed, []);
    assert.equal(result.step, 3);
});

test("partial upload failure still removes unused images and returns to the ID step", async () => {
    const result = await submit({ failBackUpload: true });
    assert.deepEqual(result.removed, ["upload-1"]);
    assert.equal(result.step, 1);
});

test("successful registration keeps images and opens email verification", async () => {
    assert.deepEqual(await submit(), { removed: [], step: 3 });
});

test("verification cannot go back to edit details that were already submitted", () => {
    const start = source.indexOf("    const handlePrevious =");
    const handler = source.slice(start, source.indexOf("    const verifyCode =", start));
    for (const currentStep of [1, 2, 3, 4]) {
        let step = currentStep;
        new Function("currentStep", "submissionInFlightRef", "verificationRequestRef", "setCurrentStep", `${handler}; handlePrevious();`)(
            currentStep, { current: false }, { current: false }, update => { step = update(step); }
        );
        assert.equal(step, currentStep >= 3 ? currentStep : currentStep - 1);
    }
    const verification = source.slice(source.indexOf("{currentStep === 3 && ("), source.indexOf("{currentStep === 4 && ("));
    assert.ok(verification.includes('onClick={() => navigate("/login")}'));
    assert.ok(!verification.includes("onClick={handlePrevious}"));
    assert.match(source, /Your original details and password will be used/);
});

test("replacing all IDs tolerates either empty slot and clears retained previews", () => {
    const start = source.indexOf("                                                                    idImages\n");
    const handler = source.slice(start, source.indexOf("                                                                }}", start));
    for (const images of [[{ preview: "blob:front" }, undefined], [null, { preview: "blob:back" }]]) {
        const revoked = [];
        let selected = images;
        let form = { validIdImage: "old-front", validIdBack: "old-back" };
        new Function("idImages", "removeTemporaryValidId", "URL", "setIdImages", "setFormData", handler)(
            images, async () => {}, { revokeObjectURL: url => revoked.push(url) },
            value => { selected = value; }, update => { form = update(form); }
        );
        assert.deepEqual(selected, []);
        assert.equal(form.validIdImage, "");
        assert.equal(form.validIdBack, "");
        assert.deepEqual(revoked, images.filter(Boolean).map(image => image.preview));
    }
});

test("ID row preserves previews across slot updates and step remounts", () => {
    const row = readFileSync(new URL("../src/components/shared/IdImageUploadRow.jsx", import.meta.url), "utf8");
    const bodyStart = row.indexOf("}) => {", row.indexOf("const IdImageUploadRow =")) + 7;
    const body = row.slice(bodyStart, row.indexOf("\n    return (", bodyStart));
    let images = [];
    let nextId = 0;
    const revoked = [];
    const effects = [];
    const render = () => new Function("images", "onChange", "useState", "useEffect", "getImageFileError", "crypto", "URL",
        `${body}; return {handleSelectFile, handleRemove};`)(
        images, value => { images = value; }, () => ["", () => {}], effect => effects.push(effect()),
        () => "", { randomUUID: () => "id" },
        { createObjectURL: () => `blob:${++nextId}`, revokeObjectURL: url => revoked.push(url) }
    );
    const file = { name: "id.jpg" };
    render().handleSelectFile(0, file);
    effects.splice(0).forEach(cleanup => cleanup?.());
    render().handleSelectFile(1, file);
    effects.splice(0).forEach(cleanup => cleanup?.());
    render(); // Re-enter the ID step with the retained files.
    assert.deepEqual(revoked, []);
    assert.equal(images[0].preview, "blob:1");
    assert.equal(images[1].preview, "blob:2");
    render().handleSelectFile(0, file);
    assert.deepEqual(revoked, ["blob:1"]);
    render().handleRemove(1);
    assert.deepEqual(revoked, ["blob:1", "blob:2"]);
    assert.equal(images[0].preview, "blob:3");
});
