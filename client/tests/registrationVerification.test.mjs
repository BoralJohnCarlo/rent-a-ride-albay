import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const helper = readFileSync(new URL("../src/utils/registrationVerification.js", import.meta.url), "utf8");
const load = storage => {
    const context = vm.createContext({ sessionStorage: storage, Date, JSON });
    vm.runInContext(helper.replaceAll("export const", "const") + "; globalThis.api = {rememberVerificationEmail,readVerificationEmail,clearVerificationEmail};", context);
    return context.api;
};

test("verification email survives a fresh page instance without storing registration secrets", () => {
    const values = new Map();
    const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key), removeItem: key => values.delete(key) };
    load(storage).rememberVerificationEmail(" customer@example.com ");
    const fresh = load(storage);
    assert.equal(fresh.readVerificationEmail(), "customer@example.com");
    assert.deepEqual(Object.keys(JSON.parse([...values.values()][0])).sort(), ["email", "expiresAt"]);
    fresh.clearVerificationEmail();
    assert.equal(load(storage).readVerificationEmail(), "");
});

test("expired, malformed, and unavailable browser storage do not block verification", () => {
    for (const value of ["invalid json", JSON.stringify({email:"old@example.com",expiresAt:0}), "null"]) {
        assert.equal(load({getItem:()=>value}).readVerificationEmail(), "");
    }
    const blocked = load({getItem:()=>{throw Error("blocked");},setItem:()=>{throw Error("blocked");},removeItem:()=>{throw Error("blocked");}});
    assert.equal(blocked.readVerificationEmail(), "");
    assert.doesNotThrow(()=>blocked.rememberVerificationEmail("customer@example.com"));
    assert.doesNotThrow(()=>blocked.clearVerificationEmail());
});

test("refreshable verification route and login entry use the existing mobile registration UI", () => {
    const routes = readFileSync(new URL("../src/routes/AppRoutes.jsx", import.meta.url), "utf8");
    const login = readFileSync(new URL("../src/pages/public/Login.jsx", import.meta.url), "utf8");
    const register = readFileSync(new URL("../src/pages/public/Register.jsx", import.meta.url), "utf8");
    assert.match(routes, /path="verify-email"\s+element=\{<Register verificationOnly \/>\}/);
    assert.match(login, /to="\/verify-email"/);
    assert.match(register, /useState\(verificationOnly \? 3 : 0\)/);
    assert.match(register, /email: resumeEmail/);
    assert.match(register, /id="verificationEmail"/);
});
