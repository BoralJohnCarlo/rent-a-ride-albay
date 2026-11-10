// Real signup pages and shared fields, isolated account-step entry and fake read-only API.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const html = path.join(client, ".registration-password-check.html");
const entry = path.join(client, "src", ".registration-password-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "registration-password-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;
try {
    await writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/.registration-password-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {Provider} from "react-redux";
import {configureStore} from "@reduxjs/toolkit";
import {BrowserRouter} from "react-router-dom";
import Register from "./pages/public/Register";
import RegisterOperator from "./pages/public/RegisterOperator";
import api from "./lib/axios";
import "./index.css";
const store=configureStore({reducer:(state={auth:{user:null,loading:false,error:null,isAuthenticated:false,initialized:true}})=>state});
api.defaults.adapter=async config=>{
 if(config.method!=="get")throw new Error("This fixture never creates accounts or uploads documents");
 return {status:200,statusText:"OK",headers:{},config,data:{success:true,data:config.url.includes("legal-documents")?{_id:"fixture-terms",title:"Terms",content:{sections:[]}}:{proofOfBillingEnabled:false}}};
};
const Form=new URLSearchParams(location.search).get("role")==="operator"?RegisterOperator:Register;
createRoot(document.getElementById("root")).render(<Provider store={store}><BrowserRouter><Form/></BrowserRouter></Provider>);
`);
    server = await createServer({ root: client, plugins: [{
        name: "isolated-password-step", enforce: "pre",
        transform(source, id) {
            if (id.replaceAll("\\", "/").endsWith("/pages/public/Register.jsx")) {
                return source.replace("useState(verificationOnly ? 3 : 0)", "useState(2)");
            }
            if (id.replaceAll("\\", "/").endsWith("/pages/public/RegisterOperator.jsx")) {
                return source.replace(/(const \[currentStep, setCurrentStep\] =\s*useState\()0(\))/, (_match, before, after) => before + "4" + after);
            }
        },
    }], server: { host: "127.0.0.1", port: 5204, strictPort: true } });
    await server.listen();
    console.log("Signup password fixture ready");
    browser = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    let port;
    for (let i = 0; i < 100; i++) {
        try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; } catch { await pause(100); }
    }
    assert.ok(port, "Chrome started");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Chrome connection timed out")), 10_000);
        socket.onopen = () => { clearTimeout(timer); resolve(); };
        socket.onerror = () => { clearTimeout(timer); reject(new Error("Chrome connection failed")); };
    });
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
        const response = JSON.parse(data);
        const request = pending.get(response.id);
        if (request) { pending.delete(response.id); response.error ? request.reject(response.error) : request.resolve(response.result); }
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const callId = ++id;
        const timer = setTimeout(() => { pending.delete(callId); reject(new Error(`${method} timed out`)); }, 20_000);
        pending.set(callId, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
        socket.send(JSON.stringify({ id: callId, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const waitFor = async (expression) => {
        for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await pause(50); }
        assert.fail(`UI condition failed: ${expression}; ${await evaluate("document.body.innerText")}`);
    };
    const fill = async (field, value) => {
        await evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(field)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event("input",{bubbles:true}));})()`);
        await pause(30);
    };
    for (const role of ["customer", "operator"]) {
        await call("Emulation.setDeviceMetricsOverride", { width: 375, height: 667, deviceScaleFactor: 1, mobile: true });
        await call("Page.navigate", { url: `http://127.0.0.1:5204/.registration-password-check.html?role=${role}` });
        await pause(1000);
        await waitFor('Boolean(document.getElementById("password"))');
        await pause(500);
        assert.equal(await evaluate('Boolean(document.getElementById("password-requirements"))'), true);
        assert.equal(await evaluate('Boolean(document.getElementById("confirmPassword-feedback"))'), false);
        await fill("password", "password");
        assert.match(await evaluate('document.getElementById("password-requirements").innerText'), /uppercase/);
        await fill("password", "Password");
        assert.match(await evaluate('document.getElementById("password-requirements").innerText'), /number/);
        await fill("password", "Password1");
        assert.equal(await evaluate('Boolean(document.getElementById("password-requirements"))'), false);
        await fill("confirmPassword", "Password");
        assert.match(await evaluate('document.getElementById("confirmPassword-feedback").innerText'), /do not match/);
        await fill("confirmPassword", "Password1");
        assert.equal(await evaluate('Boolean(document.getElementById("password-match"))'), true);
        await fill("password", "Password2");
        assert.match(await evaluate('document.getElementById("confirmPassword-feedback").innerText'), /do not match/);
        await fill("password", "weak");
        await fill("confirmPassword", "weak");
        assert.equal(await evaluate('Boolean(document.getElementById("password-match"))&&Boolean(document.getElementById("password-requirements"))'), true);
        for (const field of ["password", "confirmPassword"]) {
            await evaluate(`document.querySelector('button[aria-controls="${field}"]').click()`);
            assert.equal(await evaluate(`document.getElementById("${field}").type`), "text");
            assert.equal(await evaluate(`document.getElementById("${field}").value`), "weak");
            await evaluate(`document.querySelector('button[aria-controls="${field}"]').click()`);
        }
        await fill("password", "Aa1" + "é".repeat(40));
        assert.match(await evaluate('document.getElementById("password-requirements").innerText'), /72 UTF-8 bytes/);
        for (const width of [320, 375, 390, 768, 1280]) {
            await call("Emulation.setDeviceMetricsOverride", { width, height: 667, deviceScaleFactor: 1, mobile: width < 768 });
            await pause(100);
            const layout = await evaluate('(()=>{const nodes=[document.getElementById("password"),document.getElementById("confirmPassword"),document.getElementById("password-requirements"),...document.querySelectorAll("button[aria-controls=password],button[aria-controls=confirmPassword]")];return {overflow:document.documentElement.scrollWidth>innerWidth+1,contained:nodes.every(node=>{const r=node.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}),touch:[...document.querySelectorAll("button[aria-controls=password],button[aria-controls=confirmPassword]")].every(node=>{const r=node.getBoundingClientRect();return r.width>=44&&r.height>=44;}),font:parseFloat(getComputedStyle(document.getElementById("password")).fontSize)};})()');
            assert.equal(layout.overflow, false, `${role} overflow at ${width}px`);
            assert.equal(layout.contained, true, `${role} password content clipped at ${width}px`);
            assert.equal(layout.touch, true, `${role} visibility touch target too small at ${width}px: ${JSON.stringify(await evaluate('[...document.querySelectorAll("button[aria-controls=password],button[aria-controls=confirmPassword]")].map(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height,classes:node.className};})'))}`);
            assert.ok(layout.font >= 16);
        }
        await call("Emulation.setDeviceMetricsOverride", { width: 375, height: 340, deviceScaleFactor: 1, mobile: true });
        await evaluate('document.getElementById("confirmPassword").scrollIntoView({block:"center"})');
        const reachable = await evaluate('(()=>{const r=document.getElementById("confirmPassword").getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})()');
        assert.equal(reachable, true, `${role} confirmation must remain reachable on a short mobile viewport`);
        await fill("password", "");
        await fill("confirmPassword", "");
        assert.equal(await evaluate('Boolean(document.getElementById("password-requirements"))&&!document.getElementById("password-match")'), true);
        console.log(`PASS: ${role}: live feedback, matching, show/hide, Unicode limit, 320–1280px layouts, 44px touch targets and short mobile viewport`);
    }
} finally {
    socket?.close(); browser?.kill(); await server?.close();
    await Promise.all([html, entry].map((file) => unlink(file).catch(() => {})));
}
