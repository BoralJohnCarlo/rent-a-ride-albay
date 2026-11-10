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
const fixture = path.join(client, ".featured-mobile-check.html");
const entry = path.join(client, "src", ".featured-mobile-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "featured-mobile-check-"));
let browser, server, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
    // Disable decorative transitions only in this fixture for deterministic color assertions.
    await writeFile(fixture, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{transition-duration:0s!important;animation:none!important}</style></head><body ><div id="root"></div><script type="module" src="/src/.featured-mobile-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter} from "react-router-dom";
import ThemeContext from "./context/ThemeContext";
import FeaturedVehicleCarousel from "./components/vehicle/FeaturedVehicleCarousel";
import image from "./assets/images/slideshow/image1.webp";
import "./index.css";
const car={_id:"car",brand:"Hyundai",model:"Stargazer",vehicleType:"Car",isFeatured:true,images:[{url:image}],pricing:{dailyRate:2000},specifications:{seatingCapacity:8,transmission:"Automatic",fuelType:"Diesel"}};
function App(){ const [vehicles,setVehicles]=React.useState([car]);window.setMultiple=()=>setVehicles([car,{...car,_id:"van",model:"Long Wheelbase Passenger Van",specifications:{...car.specifications,transmission:"Continuously Variable Transmission"}}]);return <main className="mx-auto max-w-7xl px-4 py-10"><FeaturedVehicleCarousel vehicles={vehicles}/></main>; }
createRoot(document.getElementById("root")).render(<ThemeContext.Provider value={{showFeaturedImageFrame:false}}><BrowserRouter><App/></BrowserRouter></ThemeContext.Provider>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5200, strictPort: true } });
    await server.listen();
    console.log("Local fixture server ready.");
    browser = spawn(process.env.FEATURED_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
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



    await call("Emulation.setDeviceMetricsOverride",{width:375,height:812,deviceScaleFactor:1,mobile:true});
    await call("Page.navigate",{url:"http://127.0.0.1:5200/.featured-mobile-check.html"});
    for(let i=0;i<100;i++){if(await evaluate('Boolean(document.querySelector(".featured-vehicle-specs"))'))break;await pause(100);}
    await pause(500);
    for(const theme of ["light","dark"]){
        await evaluate('document.documentElement.setAttribute("data-theme",'+JSON.stringify(theme)+')');
        for(const width of [320,375,390,504,768,1280]){
            await call("Emulation.setDeviceMetricsOverride",{width,height:812,deviceScaleFactor:1,mobile:width<640});await pause(100);
            const m=await evaluate('(()=>{const specs=document.querySelector(".featured-vehicle-specs");const rows=[...specs.children].map(el=>el.getBoundingClientRect().top);const p=[...document.querySelectorAll("p")].find(el=>el.textContent.includes("Ready for your next trip"));return {overflow:document.documentElement.scrollWidth>innerWidth,rows,descriptionHeight:p.getBoundingClientRect().height,lineHeight:parseFloat(getComputedStyle(p).lineHeight)};})()');
            assert.equal(m.overflow,false,theme+" "+width+" no overflow");
            if(width<1024){assert.equal(new Set(m.rows).size,1,"standard details stay on one line at "+width);assert.ok(m.descriptionHeight<=m.lineHeight+1,"one-line description");}
            else assert.equal(new Set(m.rows).size,3,"desktop details retain vertical layout");
        }
    }
    await call("Emulation.setDeviceMetricsOverride",{width:320,height:568,deviceScaleFactor:1,mobile:true});
    await evaluate('window.setMultiple()');await pause(200);
    await evaluate('[...document.querySelectorAll("button")].find(el=>el.getAttribute("aria-label")==="Next vehicle").click()');await pause(650);
    assert.ok(await evaluate('document.querySelector("h2").textContent.includes("Long Wheelbase")'),"next vehicle");
    assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,"long title and details wrap without overflow");
    await evaluate('[...document.querySelectorAll("button")].find(el=>el.getAttribute("aria-label")==="Previous vehicle").click()');await pause(650);
    assert.equal(await evaluate('document.querySelector("h2").textContent'),"Stargazer","previous vehicle");
    console.log("PASS: details on one line at 320/375/390/504/768px, desktop layout at 1280px, light/dark themes, long-text wrapping and carousel controls.");
} finally {
    socket?.close();browser?.kill();await server?.close();
    await Promise.all([fixture,entry].map(file=>unlink(file).catch(()=>{})));
}
