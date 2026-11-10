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
const html = path.join(client, ".inspection-mobile-check.html");
const entry = path.join(client, "src", ".inspection-mobile-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "inspection-mobile-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;
try {
    await writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/.inspection-mobile-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {Provider} from "react-redux";
import {configureStore} from "@reduxjs/toolkit";
import pendingReducer from "./store/pendingVehicles/pendingVehiclesSlice";
import RecoveryPanel from "./components/consignments/PendingVehiclesPanel";
import {createRoot} from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import Panel from "./components/consignments/OperatorAppointmentsPanel";
import Calendar from "./components/consignments/InspectionAppointmentCalendar";
import ToastContext from "./context/ToastContext";
import api from "./lib/axios";
import "./index.css";
const params=new URLSearchParams(location.search);
const role=params.get("role");
const inspection={scheduledDate:"2099-12-10",scheduledTime:"09:00"};
const vehicle={_id:"registration1",brand:"Toyota",model:"Very long vehicle name for narrow phone screens",plateNumber:"ABC1234",approvalRecoveryRequired:params.get("blocked")==="1",status:"pending_review",inspection,reschedule:params.get("review")?{status:"Pending",proposedDate:"2099-12-10",proposedTime:"10:00",reason:"Work schedule has changed"}:{status:"None"},operator:{firstName:"Partner",lastName:"Example"}};
const store=configureStore({reducer:{pendingVehicles:pendingReducer}});
let recovered=false;
let failSecondPage=true;
window.appointmentWrites=[];
window.appointmentErrors=[];
api.defaults.adapter=async config=>{
 if(role==="pagination"){
  if(config.method!=="get"){window.appointmentWrites.push(JSON.parse(config.data));recovered=true;}
  const page=Number(config.params?.page||1);
  const total=recovered?50:51;
  if(!config.url.includes("counts")&&page===2&&failSecondPage){failSecondPage=false;throw {response:{data:{message:"Simulated page failure"}}};}
  const data=config.url.includes("counts")?{total}:page===1?Array.from({length:50},(_,i)=>({...vehicle,_id:"new"+i,model:"Newer queue record "+i})):recovered?[]:[{...vehicle,model:"Older recovery submission",status:"approved",approvalPending:true,approvalRecoveryRequired:true}];
  return {status:200,statusText:"OK",headers:{},config,data:{success:true,data,pagination:{page,pages:recovered?1:2,total,limit:50}}};
 }

 if(role==="recovery"){
  if(config.method!=="get"){window.appointmentWrites.push(JSON.parse(config.data));recovered=true;}
  const data=config.url.includes("counts")?{total:recovered?0:1}:recovered?[]:[{...vehicle,status:"approved",approvalPending:true,approvalRecoveryRequired:true}];
  return {status:200,statusText:"OK",headers:{},config,data:{success:true,data,pagination:{pages:1,total:recovered?0:1}}};
 }
 if(config.method!=="get") {
  const input=JSON.parse(config.data);window.appointmentWrites.push(input);
  if(input.action==="request")vehicle.reschedule={status:"Pending",proposedDate:input.date,proposedTime:input.time,reason:input.reason};
  else {vehicle.inspection={scheduledDate:"2099-12-10",scheduledTime:"10:00"};vehicle.reschedule={status:"Approved"};}
 }
 const data=config.url.includes("availability")?{slots:[{date:"2099-12-10",timeSlots:[{time:"10:00",endTime:"11:00",remaining:1}]}]}:[vehicle,{...vehicle,_id:"closed1",plateNumber:"CLOSED",status:"approved",reschedule:{status:"None"}}];
 return {status:200,statusText:"OK",headers:{},config,data:{success:true,data,pagination:{pages:1}}};
};
const toast={success:()=>{},error:message=>window.appointmentErrors.push(message)};
createRoot(document.getElementById("root")).render(<Provider store={store}><BrowserRouter><ToastContext.Provider value={toast}><main className="p-4">{(role==="recovery"||role==="pagination")?<RecoveryPanel/>:role==="signup"?<Calendar/>:<Panel admin={role==="admin"} showApplicant={role==="admin"}/>}</main></ToastContext.Provider></BrowserRouter></Provider>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5206, strictPort: true } });
    await server.listen();
    console.log("Inspection appointment fixture ready");
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
    for (const role of ["operator", "admin", "signup", "recovery", "pagination"]) {
        await call("Page.navigate", { url: `http://127.0.0.1:5206/.inspection-mobile-check.html?role=${role}` });
        await pause(1000);
        await waitFor(role==="signup"?'document.body.innerText.includes("Inspection Appointment")':'document.body.innerText.includes("Toyota")');
        for (const width of [320,375,390,768,1280]) {
            await call("Emulation.setDeviceMetricsOverride", {width,height:667,deviceScaleFactor:1,mobile:width<768});
            await pause(100);
            assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,role+" list overflow at "+width);
        }
        if(role==="signup")continue;
        if(role==="pagination"){
            await click("Next");await waitFor('document.body.innerText.includes("Simulated page failure")');
            await click("Retry loading vehicles");await waitFor('document.body.innerText.includes("Older recovery submission")');
            await click("Previous");await waitFor('document.body.innerText.includes("Newer queue record 0")');
            await click("Next");await waitFor('document.body.innerText.includes("Older recovery submission")');
            for(const width of [320,375,390,768,1280]){
                await call("Emulation.setDeviceMetricsOverride",{width,height:667,deviceScaleFactor:1,mobile:width<768});await pause(100);
                assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,"pagination overflow at "+width);
                assert.equal(await evaluate('[...document.querySelector("nav").querySelectorAll("button")].every(b=>b.getBoundingClientRect().height>=44)'),true);
            }
            await click("Retry approval");await waitFor('Boolean(document.querySelector("[role=dialog]"))');
            await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent.trim()==="Retry approval").click()');
            await waitFor('window.appointmentWrites.length===1');
            await waitFor('document.body.innerText.includes("Page 1 of 1")&&document.body.innerText.includes("Newer queue record 0")');
            assert.deepEqual(await evaluate('window.appointmentErrors'),[]);
            console.log("pagination: second page, error retry, previous/next, mobile controls, and empty-last-page recovery passed");
            continue;
        }
        if(role==="recovery"){
            await call("Page.reload");await pause(800);await waitFor('document.body.innerText.includes("Retry approval")');
            await click("Retry approval");await waitFor('Boolean(document.querySelector("[role=dialog]"))');
            assert.equal(await evaluate('Boolean(document.querySelector("[role=dialog] input[type=number]"))'),false,"recovery must not ask for prices again");
            for(const width of [320,375,390,768,1280]){
                await call("Emulation.setDeviceMetricsOverride",{width,height:667,deviceScaleFactor:1,mobile:width<768});await pause(150);
                assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,"recovery dialog overflow at "+width);
            }
            await call("Emulation.setDeviceMetricsOverride",{width:375,height:340,deviceScaleFactor:1,mobile:true});await pause(150);
            assert.equal(await evaluate('(()=>{const r=document.querySelector("[role=dialog]").getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1;})()'),true);
            await evaluate('[...document.querySelectorAll("[role=dialog] button")].find(b=>b.textContent.trim()==="Retry approval").click()');
            await waitFor('window.appointmentWrites.length===1');
            assert.equal(await evaluate('window.appointmentWrites[0].status'),"approved");
            assert.equal(await evaluate('Boolean(window.appointmentWrites[0].pricing)'),false);
            await waitFor('document.body.innerText.includes("No pending vehicles found")');
            assert.deepEqual(await evaluate('window.appointmentErrors'),[]);
            console.log("recovery: refresh, retry without pricing, mobile dialog, and queue refresh passed");
            continue;
        }
        assert.equal(await evaluate('document.body.innerText.includes("Completed")'),true,role+" completed history is visible");
        await call("Emulation.setDeviceMetricsOverride", {width:320,height:568,deviceScaleFactor:1,mobile:true});
        await click("Reschedule");
        await waitFor('Boolean(document.querySelector("[role=dialog]"))');
        for (const width of [320,375,390,768,1280]) {
            await call("Emulation.setDeviceMetricsOverride", {width,height:667,deviceScaleFactor:1,mobile:width<768});
            await pause(200);
            const layout=await evaluate('(()=>{const d=document.querySelector("[role=dialog]");const r=d.getBoundingClientRect();return {overflow:document.documentElement.scrollWidth>innerWidth+1||d.scrollWidth>d.clientWidth+1,left:r.left,right:r.right};})()');
            assert.equal(layout.overflow,false,role+" dialog overflow at "+width);
            assert.ok(layout.left>=-1&&layout.right<=width+1,JSON.stringify(layout));
        }
        await call("Emulation.setDeviceMetricsOverride", {width:375,height:340,deviceScaleFactor:1,mobile:true});
        await evaluate('document.querySelector("#modal-body").scrollTop=9999');
        await pause(100);
        assert.equal(await evaluate('(()=>{const r=document.querySelector("[role=dialog]").getBoundingClientRect();return r.top>=-1&&r.bottom<=innerHeight+1;})()'),true,role+" short-screen dialog bounds");
        const slot=await evaluate('[...document.querySelectorAll("button")].find(node=>node.textContent.includes("10:00")&&node.textContent.includes("left"))?.textContent');
        assert.ok(slot);await click(slot.trim());
        if(role==="operator"){
            assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.trim()==="Request Reschedule").disabled'),true);
            await evaluate('(()=>{const t=document.getElementById("inspection-reschedule-reason");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(t,"Work schedule changed");t.dispatchEvent(new Event("input",{bubbles:true}));})()');
            await pause(100);
            await click("Request Reschedule");
            await waitFor('window.appointmentWrites.length===1');
            assert.equal(await evaluate('window.appointmentWrites[0].action'),"request");
            await waitFor('document.body.innerText.includes("Reschedule awaiting admin approval")');
        } else {
            await click("Move Appointment");
            await waitFor('window.appointmentWrites.length===1');
            assert.equal(await evaluate('window.appointmentWrites[0].action'),"book");
            await call("Page.navigate", {url:"http://127.0.0.1:5206/.inspection-mobile-check.html?role=admin&review=1"});
            await pause(800);await waitFor('document.body.innerText.includes("Review Reschedule")');
            await click("Review Reschedule");
            assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false);
            await click("Approve");
            await waitFor('window.appointmentWrites.length===1');
            assert.equal(await evaluate('window.appointmentWrites[0].action'),"approve");
        }
        assert.deepEqual(await evaluate('window.appointmentErrors'),[]);
        console.log(role+": mobile list, reschedule dialog, short viewport, and submission passed");
    }

    for(const role of ["operator","admin"]){
        for(const pending of [false,true]){
            await call("Page.navigate",{url:"http://127.0.0.1:5206/.inspection-mobile-check.html?role="+role+"&blocked=1"+(pending?"&review=1":"")});
            await pause(800);await waitFor('document.body.innerText.includes("Approval needs attention")');
            assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b=>["Reschedule","Review Reschedule"].includes(b.textContent.trim()))'),false,role+" recovery must hide blocked actions");
            assert.equal(await evaluate('document.body.innerText.includes("Reschedule awaiting admin approval")'),false);
            assert.equal(await evaluate(role==="admin"?'document.body.innerText.includes("Open Pending Vehicles and retry approval")':'document.body.innerText.includes("An administrator needs to finish approval")'),true);
            for(const width of [320,375,768,1280]){
                await call("Emulation.setDeviceMetricsOverride",{width,height:667,deviceScaleFactor:1,mobile:width<768});await pause(100);
                assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,role+" recovery message overflow at "+width);
            }
            assert.equal(await evaluate('window.appointmentWrites.length'),0);
        }
        console.log(role+": recovery hides reschedule and review controls, with responsive guidance");
    }

} finally {
    socket?.close(); browser?.kill(); await server?.close();
    await Promise.all([html, entry].map((file) => unlink(file).catch(() => {})));
}
