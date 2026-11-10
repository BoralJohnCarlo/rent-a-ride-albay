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
const fixture = path.join(client, ".filter-pill-check.html");
const entry = path.join(client, "src", ".filter-pill-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "filter-pill-check-"));
let browser, server, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
    // Disable decorative transitions only in this fixture for deterministic color assertions.
    await writeFile(fixture, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{transition-duration:0s!important;animation:none!important}</style></head><body ><div id="root"></div><script type="module" src="/src/.filter-pill-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {AnimatePresence,motion} from "framer-motion";
import FilterSummaryPill from "./components/search/FilterSummaryPill";
import "./index.css";
function App(){const [collapsed,setCollapsed]=React.useState(true);return <main className="px-4 py-20"><div id="wrapper"><AnimatePresence mode="wait" initial={false}>{collapsed?<FilterSummaryPill key="pill" items={["1 vehicle","Nov 9 - Nov 12","Automatic","8 seats","Diesel"]} onExpand={()=>setCollapsed(false)}/>:<motion.div key="card" id="card" initial={{width:"88%"}} animate={{width:"100%"}} exit={{opacity:0}} transition={{duration:0.15}}><button onClick={()=>setCollapsed(true)}>Close filters</button></motion.div>}</AnimatePresence></div></main>;}
createRoot(document.getElementById("root")).render(<App/>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5201, strictPort: true } });
    await server.listen();
    console.log("Local fixture server ready.");
    browser = spawn(process.env.FILTER_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
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




    await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
    await call("Page.navigate",{url:"http://127.0.0.1:5201/.filter-pill-check.html"});
    for(let i=0;i<100;i++){if(await evaluate('Boolean(document.querySelector("button[aria-expanded]"))'))break;await pause(100);}
    await pause(650);
    for(const width of [320,375,504,639]){
        await call("Emulation.setDeviceMetricsOverride",{width,height:667,deviceScaleFactor:1,mobile:true});await pause(500);
        const sizes=await evaluate('(()=>{const outer=document.getElementById("wrapper").getBoundingClientRect();const pill=document.querySelector("button[aria-expanded]").getBoundingClientRect();return {outer:outer.width,pill:pill.width,left:pill.left-outer.left,right:outer.right-pill.right,overflow:document.documentElement.scrollWidth>innerWidth};})()');
        assert.ok(Math.abs(sizes.pill/sizes.outer-0.88)<0.01,JSON.stringify(sizes));assert.ok(Math.abs(sizes.left-sizes.right)<1,"pill centered");assert.equal(sizes.overflow,false,"long summary stays contained");
    }
    await evaluate('document.querySelector("button[aria-expanded]").click()');await pause(800);
    assert.ok(await evaluate('Boolean(document.getElementById("card"))'),"tap opens filters");
    const widths=await evaluate('new Promise(resolve=>{const widths=[];document.querySelector("#card button").click();const start=performance.now();function sample(){const pill=document.querySelector("button[aria-expanded]");if(pill)widths.push(pill.getBoundingClientRect().width);if(performance.now()-start<900)requestAnimationFrame(sample);else resolve(widths);}requestAnimationFrame(sample);})');
    assert.ok(widths.length>10,"animation sampled");assert.ok(Math.max(...widths)-widths.at(-1)>15,"closing animates a real width reduction");
    await call("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
    await call("Page.reload");await pause(700);
    await evaluate('document.querySelector("button[aria-expanded]").click()');await pause(450);
    await evaluate('document.querySelector("#card button").click()');await pause(300);
    assert.ok(await evaluate('Boolean(document.querySelector("button[aria-expanded]"))'),"reduced-motion toggle works");
    console.log("PASS: centered 88% pill at 320/375/504/639px, long summary containment, expand/collapse callbacks, real width animation and reduced motion.");
} finally {
    socket?.close();browser?.kill();await server?.close();
    await Promise.all([fixture,entry].map(file=>unlink(file).catch(()=>{})));
}
