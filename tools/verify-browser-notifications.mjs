// Isolated Chrome fixture: real React/settings code, fake push APIs and API adapter.
// Never signs into the application or contacts a push provider.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const fixture = path.join(client, ".push-check.html");
const entry = path.join(client, "src", ".push-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "browser-push-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, server, socket;
try {
    await writeFile(fixture, '<html><body><div id="root"></div><script type="module" src="/src/.push-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {Provider} from "react-redux";
import {configureStore} from "@reduxjs/toolkit";
import BrowserNotificationSettings from "./components/settings/BrowserNotificationSettings";
import api from "./lib/axios";
import {logout} from "./api/authApi";
const store = configureStore({reducer:(state={auth:{user:{_id:"admin",role:"admin"}}}, action)=>action.type==="switch"?{auth:{user:{_id:action.role,role:action.role}}}:state});
let subscription=null, binding=null;
window.fixture={fail:true, permission:"granted", saves:0, switchRole:role=>store.dispatch({type:"switch",role}), logout};
window.fixture.checkPushReceipts=async()=>{
 const source=await fetch("/push-sw.js").then(response=>response.text());
 let shown=0;
 const boot=()=>{
   const handlers={};
   const worker={location:{origin:location.origin},addEventListener:(name,handler)=>handlers[name]=handler,registration:{showNotification:async()=>{shown++;}}};
   new Function("self",source)(worker);
   return handlers;
 };
 const data={tag:crypto.randomUUID(),body:"Important update",expiresAt:Date.now()+60000};
 const send=handlers=>new Promise((resolve,reject)=>handlers.push({data:{json:()=>data},waitUntil:promise=>promise.then(resolve,reject)}));
 const first=boot();
 await Promise.all([send(first),send(first)]);
 await send(boot());
 return shown;
};
const publicKey=btoa(String.fromCharCode(...new Uint8Array(65).fill(1))).replace(/=/g,"");
const worker={pushManager:{getSubscription:async()=>subscription,subscribe:async options=>{
 subscription={endpoint:"https://fcm.googleapis.com/wp/fixture",options,unsubscribe:async()=>{if(window.fixture.delayUnsubscribe)await new Promise(resolve=>{window.fixture.finishUnsubscribe=resolve;});subscription=null;return true;},toJSON:()=>({endpoint:"https://fcm.googleapis.com/wp/fixture",keys:{p256dh:"a".repeat(87),auth:"b".repeat(22)}})};return subscription;
}},getNotifications:async()=>[]};
Object.defineProperty(navigator,"serviceWorker",{configurable:true,value:{getRegistration:async()=>worker,register:async()=>worker,ready:Promise.resolve(worker)}});
Object.defineProperty(window,"Notification",{configurable:true,value:{get permission(){return window.fixture.permission;},requestPermission:async()=>window.fixture.permission}});
if(!("PushManager" in window))window.PushManager=function(){};
api.defaults.adapter=async config=>{
 if(window.fixture.fail){window.fixture.fail=false;throw new Error("temporary failure");}
 const current=store.getState().auth.user._id;
 let data={};
 if(config.url.endsWith("/push/config"))data={enabled:true,publicKey};
 if(config.url.endsWith("/push/status"))data={subscribed:binding===current};
 if(config.url.endsWith("/push/subscription")&&config.method==="post"){binding=current;window.fixture.saves++;data={success:true};}
 if(config.url.endsWith("/push/subscription")&&config.method==="delete"){binding=null;data={success:true};}
 if(config.url==="/auth/logout"){binding=null;data={success:true};}
 return {data,status:200,statusText:"OK",headers:{},config};
};
createRoot(document.getElementById("root")).render(<Provider store={store}><BrowserNotificationSettings/></Provider>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5203, strictPort: true } });
    await server.listen();
    console.log("Isolated fixture server ready");
    browser = spawn(process.env.PUSH_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
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
        const timer = setTimeout(() => { pending.delete(callId); reject(new Error(`${method} timed out`)); }, 15_000);
        pending.set(callId, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject: (error) => { clearTimeout(timer); reject(error); } });
        socket.send(JSON.stringify({ id: callId, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const waitFor = async (expression) => {
        for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(50); }
        assert.fail(`UI condition did not settle: ${expression}; ${await evaluate("document.body.innerText")}`);
    };
    const click = async (label) => evaluate(`Array.from(document.querySelectorAll("button")).find(button=>button.textContent===${JSON.stringify(label)}).click()`);
    const enabled = 'Array.from(document.querySelectorAll("button")).some(button=>button.textContent==="Disable browser notifications"&&!button.disabled)';
    const disabled = 'Array.from(document.querySelectorAll("button")).some(button=>button.textContent==="Enable browser notifications"&&!button.disabled)';
    console.log("Chrome connected");
    await call("Page.navigate", { url: "http://127.0.0.1:5203/.push-check.html" });
    await pause(1000);
    await waitFor('document.body.innerText.includes("Retry loading settings")');
    await click("Retry loading settings");
    await waitFor(disabled);
    for (const role of ["admin", "operator", "customer"]) {
        await evaluate(`window.fixture.switchRole(${JSON.stringify(role)})`);
        await waitFor(disabled);
        await click("Enable browser notifications");
        await waitFor(enabled);
        await evaluate('window.fixture.fail=true');
        await click("Disable browser notifications");
        await waitFor(disabled);
        assert.ok(await evaluate('document.body.innerText.includes("Server cleanup could not be confirmed")'));
        assert.equal(await evaluate('navigator.serviceWorker.getRegistration("/").then(worker=>worker.pushManager.getSubscription()).then(Boolean)'), false);
        console.log(`PASS: ${role} can enable and locally disable alerts despite server cleanup failure`);
    }
    await click("Enable browser notifications");
    await waitFor(enabled);
    await evaluate('window.fixture.switchRole("operator")');
    await waitFor(disabled);
    await click("Enable browser notifications");
    await waitFor(enabled);
    await evaluate('window.fixture.fail=true; window.fixture.logout().catch(()=>null)');
    // Even if the logout request fails, local browser subscription was removed.
    assert.equal(await evaluate('navigator.serviceWorker.getRegistration("/").then(worker=>worker.pushManager.getSubscription()).then(Boolean)'), false);
    console.log("PASS: settings retry, account switching, and local cleanup when logout API fails");
    await evaluate('window.fixture.permission="default"');
    await click("Refresh status");
    await waitFor(disabled);
    const saves = await evaluate("window.fixture.saves");
    await click("Enable browser notifications");
    await waitFor('document.body.innerText.includes("Notifications were not enabled")');
    assert.equal(await evaluate("window.fixture.saves"), saves);
    await evaluate('window.fixture.permission="denied"');
    await click("Refresh status");
    await waitFor('Array.from(document.querySelectorAll("button")).some(button=>button.textContent==="Enable browser notifications"&&button.disabled)');
    assert.ok(await evaluate('document.body.innerText.includes("Notifications are blocked")'));
    await evaluate('window.fixture.permission="granted"');
    await click("Refresh status");
    await waitFor(disabled);
    await evaluate('window.fixture.fail=true');
    await click("Enable browser notifications");
    await waitFor('document.body.innerText.includes("temporary failure")');
    assert.equal(await evaluate("window.fixture.saves"), saves);
    assert.equal(await evaluate('navigator.serviceWorker.getRegistration("/").then(worker=>worker.pushManager.getSubscription()).then(Boolean)'), false);
    await click("Enable browser notifications");
    await waitFor(enabled);
    console.log("PASS: permission dismissal/denial, refresh after permission changes, failed-save rollback and retry");
    await evaluate('window.fixture.delayUnsubscribe=true');
    await click("Disable browser notifications");
    await waitFor(disabled);
    assert.ok(await evaluate('document.body.innerText.includes("Local browser cleanup could not be confirmed")'));
    const savesBeforeLateCleanup = await evaluate("window.fixture.saves");
    await evaluate('window.fixture.delayUnsubscribe=false');
    await click("Enable browser notifications");
    await pause(100);
    assert.equal(await evaluate("window.fixture.saves"), savesBeforeLateCleanup);
    await evaluate("window.fixture.finishUnsubscribe()");
    await waitFor(enabled);
    assert.equal(await evaluate("window.fixture.saves"), savesBeforeLateCleanup + 1);
    assert.equal(await evaluate('navigator.serviceWorker.getRegistration("/").then(worker=>worker.pushManager.getSubscription()).then(Boolean)'), true);
    console.log("PASS: timed-out unsubscribe completes before re-enable reads and saves a fresh subscription");
    assert.equal(await evaluate("window.fixture.checkPushReceipts()"), 1);
    console.log("PASS: persistent browser receipts suppress concurrent retry duplicates and survive worker restarts");
} finally {
    socket?.close();
    browser?.kill();
    await server?.close();
    await Promise.all([fixture, entry].map((file) => unlink(file).catch(() => {})));
}
