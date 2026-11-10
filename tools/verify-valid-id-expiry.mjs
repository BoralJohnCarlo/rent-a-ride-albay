// Real appointment components with isolated API responses; no live appointments are changed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const html = path.join(client, ".valid-id-expiry-check.html");
const entry = path.join(client, "src", ".valid-id-expiry-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "valid-id-expiry-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;
try {
    await writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/.valid-id-expiry-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import Dialog from "./components/admin/VerifyValidIdDialog";
import "./index.css";
function App(){
 const [user,setUser]=React.useState({_id:"new",firstName:"Customer",lastName:"Example",validIdType:"Uploaded ID"});
 const [open,setOpen]=React.useState(true);
 const [loading,setLoading]=React.useState(false);
 window.setVerificationUser=setUser;window.setVerificationOpen=setOpen;window.setVerificationLoading=setLoading;
 window.confirmations=window.confirmations||[];
 return <Dialog isOpen={open} user={user} loading={loading} onClose={()=>setOpen(false)} onConfirm={value=>window.confirmations.push(value)}/>;
}
createRoot(document.getElementById("root")).render(<App/>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5208, strictPort: true } });
    await server.listen();
    console.log("Valid ID verification fixture ready");
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

    const click = async text => {
        await evaluate(`(()=>{const button=[...document.querySelectorAll("button")].find(node=>node.textContent.trim()===${JSON.stringify(text)});if(!button)throw Error("Button missing");button.click();})()`);
        await pause(200);
    };

    await call("Page.navigate",{url:"http://127.0.0.1:5208/.valid-id-expiry-check.html"});await pause(1000);
    await waitFor('Boolean(document.querySelector("input[type=radio]"))');
    const verifyDisabled=()=>evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Verify").disabled');
    const choose=async value=>{await evaluate(`document.querySelector('input[type=radio][value="${value}"]').click()`);await pause(100);};
    assert.equal(await verifyDisabled(),true);
    assert.equal(await evaluate('document.querySelectorAll("input[type=radio]:checked").length'),0);
    await choose("none");assert.equal(await verifyDisabled(),false);
    assert.equal(await evaluate('Boolean(document.querySelector("input[name=validIdExpirationDate]"))'),false);
    await click("Verify");assert.equal(await evaluate('window.confirmations.at(-1).expirationDate'),null);
    await choose("date");assert.equal(await verifyDisabled(),true);
    await evaluate('document.getElementById("validIdExpirationDate").click()');await pause(200);
    await evaluate('[...document.querySelectorAll("button[aria-label]")].find(b=>/20\\d{2}/.test(b.getAttribute("aria-label"))&&!b.disabled).click()');await pause(200);
    assert.equal(await verifyDisabled(),false);await click("Verify");
    assert.match(await evaluate('window.confirmations.at(-1).expirationDate'),/^\d{4}-\d{2}-\d{2}$/);
    for(const width of [320,375,390,768,1280]){
      await call("Emulation.setDeviceMetricsOverride",{width,height:667,deviceScaleFactor:1,mobile:width<768});await pause(150);
      assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,"overflow at "+width);
      assert.equal(await evaluate('[...document.querySelectorAll("fieldset label")].every(n=>n.getBoundingClientRect().height>=44)'),true);
    }
    await call("Emulation.setDeviceMetricsOverride",{width:375,height:340,deviceScaleFactor:1,mobile:true});await pause(150);
    assert.equal(await evaluate('(()=>{const r=document.querySelector("[role=dialog]").getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1;})()'),true);
    await evaluate('window.setVerificationLoading(true)');await pause(100);
    assert.equal(await evaluate('document.querySelector("fieldset").disabled'),true);
    assert.equal(await evaluate('document.getElementById("validIdExpirationDate").disabled'),true);
    await evaluate('window.setVerificationLoading(false);window.setVerificationUser({_id:"saved",firstName:"Saved",validIdHasExpiration:false,isVerified:false})');await pause(150);
    assert.equal(await evaluate('document.querySelector("input[type=radio]:checked").value'),"none");
    await evaluate('window.setVerificationOpen(false)');await pause(250);await evaluate('window.setVerificationOpen(true)');await pause(300);
    assert.equal(await evaluate('document.querySelector("input[type=radio]:checked").value'),"none");
    await evaluate('window.setVerificationUser({_id:"future",validIdHasExpiration:true,validIdExpirationDate:"2099-12-10T15:59:59.999Z"})');await pause(150);
    assert.equal(await evaluate('document.querySelector("input[type=radio]:checked").value'),"date");
    assert.equal(await evaluate('document.querySelector("input[name=validIdExpirationDate]").value'),"2099-12-10");
    await evaluate('window.setVerificationUser({_id:"expired",validIdHasExpiration:true,validIdExpirationDate:"2020-01-01T15:59:59.999Z"})');await pause(150);
    assert.equal(await verifyDisabled(),true);
    await evaluate('window.setVerificationUser({_id:"new-id",validIdHasExpiration:null,isVerified:false,validIdExpirationDate:"2099-12-10T15:59:59.999Z"})');await pause(150);
    assert.equal(await evaluate('document.querySelectorAll("input[type=radio]:checked").length'),0);
    console.log("Verification expiry: explicit choices, date selection, saved choice, new ID reset, expired date, loading, and mobile checks passed");

} finally {
    socket?.close(); browser?.kill(); await server?.close();
    await Promise.all([html, entry].map((file) => unlink(file).catch(() => {})));
}
