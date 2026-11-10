// Local isolated browser check; does not sign in or write application settings.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const fixture = path.join(client, ".available-filter-check.html");
const entry = path.join(client, "src", ".available-filter-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "available-filter-check-"));
let browser, server, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
    // Disable decorative transitions only in this fixture for deterministic color assertions.
    await writeFile(fixture, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{transition-duration:0s!important;animation:none!important}</style></head><body ><div id="root"></div><script type="module" src="/src/.available-filter-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {Provider} from "react-redux";
import {BrowserRouter} from "react-router-dom";
import AvailableVehicles from "./pages/public/AvailableVehicles";
import api from "./lib/axios";
import image from "./assets/images/slideshow/image1.webp";
import "./index.css";
api.defaults.adapter=async config=>({data:{data:{unavailableVehicleIds:[]}},status:200,statusText:"OK",headers:{},config});
const count=location.search.includes("single")?1:12;
const vehicles=Array.from({length:count},(_,i)=>({_id:"car-"+i,brand:"Hyundai",model:"Stargazer "+i,vehicleType:"Car",isFeatured:true,status:"Available",availability:{bookingEnabled:true},images:[{url:image}],pricing:{dailyRate:2000},specifications:{seatingCapacity:8,transmission:"Automatic",fuelType:"Diesel"}}));
const state={vehicles:{vehicles,loading:false},categories:{vehicleCategories:[],loading:false,filters:{}}};
const store={getState:()=>state,subscribe:()=>()=>{},dispatch:()=>Promise.resolve({})};
createRoot(document.getElementById("root")).render(<Provider store={store}><BrowserRouter><AvailableVehicles/></BrowserRouter></Provider>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5202, strictPort: true } });
    await server.listen();
    console.log("Local fixture server ready.");
    browser = spawn(process.env.AVAILABLE_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    let port;
    for (let count = 0; count < 100; count++) {
        try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; } catch { await pause(100); }
    }
    assert.ok(port, "headless browser started");
    console.log("Headless browser ready.");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Browser WebSocket connection timed out")), 10000);
        socket.onopen = () => { clearTimeout(timeout); resolve(); };
        socket.onerror = () => { clearTimeout(timeout); reject(new Error("Browser WebSocket connection failed")); };
    });
    console.log("Browser connected.");
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(message.error) : resolve(message.result); }
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const callId = ++id;
        const timeout = setTimeout(() => { pending.delete(callId); reject(new Error(method + " timed out")); }, 30000);
        pending.set(callId, { resolve: (result) => { clearTimeout(timeout); resolve(result); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
        socket.send(JSON.stringify({ id: callId, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };

    const card = `document.querySelector('a[href="/vehicles/car-0"]')`;
    const pill = `[...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')?.startsWith('Show filters'))`;
    const close = `[...document.querySelectorAll('button')].find(el=>el.getAttribute('aria-label')==='Minimise filters')`;
    await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
    for (const mode of ["single", "many"]) {
        await call("Page.navigate",{url:"http://127.0.0.1:5202/.available-filter-check.html?"+mode+"=1"});
        for(let i=0;i<100;i++){if(await evaluate(`Boolean(${card})`))break;await pause(100);}
        await pause(800);
        await evaluate(`window.scrollTo(0,${card}.getBoundingClientRect().top+scrollY-150)`);
        await pause(1200);
        if (!await evaluate(`Boolean(${pill})`)) {
            await evaluate(`${close}.click()`); await pause(1000);
        }
        await evaluate(`${pill}.click()`); await pause(1200);
        await evaluate(`${close}.focus({preventScroll:true})`);
        await evaluate(`window.scrollTo(0,${card}.getBoundingClientRect().top+scrollY-450)`);await pause(750);
        const before = await evaluate(`({y:scrollY,top:${card}.getBoundingClientRect().top})`);
        const target = await evaluate(`(()=>{const r=${close}.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
        await call("Input.dispatchTouchEvent", {type:"touchStart",touchPoints:[{...target}]});
        await call("Input.dispatchTouchEvent", {type:"touchEnd",touchPoints:[]});
        await pause(1200);
        const after = await evaluate(`({y:scrollY,top:${card}.getBoundingClientRect().top,collapsed:Boolean(${pill})})`);
        console.log(JSON.stringify({mode,before,after}));
        assert.equal(after.collapsed,true,"filters remain collapsed");
        assert.ok(after.y>0,"collapse does not return to page top");
        assert.ok(Math.abs(after.top-before.top)<4,"vehicle remains anchored while filters close");
    }
    console.log("PASS: actual availability page preserves vehicle position with one and many results.");
} finally {
    socket?.close();browser?.kill();await server?.close();
    await Promise.all([fixture,entry].map(file=>unlink(file).catch(()=>{})));
}





