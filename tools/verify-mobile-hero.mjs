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
const fixture = path.join(client, ".mobile-hero-check.html");
const entry = path.join(client, "src", ".mobile-hero-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "mobile-hero-check-"));
let browser, server, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
    // Disable decorative transitions only in this fixture for deterministic color assertions.
    await writeFile(fixture, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{transition-duration:0s!important;animation:none!important}</style></head><body ><div id="root"></div><script type="module" src="/src/.mobile-hero-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter, useLocation } from "react-router-dom";
import ThemeContext from "./context/ThemeContext";
import api from "./lib/axios";
api.interceptors.request.use(config => { if(config.url === "/destinations/public") config.adapter = async () => { if(window.failDestinations) throw new Error("offline"); return { data:{data:{heroWidget:[{_id:"one",name:"Nature",category:"nature"},{_id:"two",name:"Heritage",category:"heritage"},{_id:"three",name:"Beach",category:"beaches"}]}}, status:200,statusText:"OK",headers:{},config }; }; return config; });
import PublicNavbar from "./components/layout/PublicNavbar";
import HeroSection from "./components/sections/HeroSection";
import "./index.css";
const state = { auth: { user: null, isAuthenticated: false, loading: false, initialized: true }, categories: { vehicleCategories: [{_id:"car",name:"Cars",status:"Active"},{_id:"motorcycle",name:"Motorcycles",status:"Active"}], loading:false, filters:{} } };
const store={ getState:()=>state, subscribe:()=>()=>{}, dispatch:()=>Promise.resolve({}) };
const theme={ heroMediaType:"image", heroImageUrl:null, heroVideoUrl:null, isPillNavbar:true, configuration:{colorTheme:"light"}, isChristmasAvailable:false, setColorTheme:()=>{} };
window.history.replaceState({},"","/");
function App(){ const location=useLocation(); return <><PublicNavbar/><HeroSection/><output id="route">{location.pathname+location.search}</output><div style={{height:400}}/></>; }
createRoot(document.getElementById("root")).render(<Provider store={store}><ThemeContext.Provider value={theme}><BrowserRouter><App/></BrowserRouter></ThemeContext.Provider></Provider>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5199, strictPort: true } });
    await server.listen();
    console.log("Local fixture server ready.");
    browser = spawn(process.env.HERO_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
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


    await call("Emulation.setDeviceMetricsOverride", { width:375,height:812,deviceScaleFactor:1,mobile:true });
    await call("Page.navigate", { url:"http://127.0.0.1:5199/.mobile-hero-check.html" });
    for(let i=0;i<100;i++){ if(await evaluate('Boolean(document.querySelector(".hero-search"))')) break; await pause(100); }
    await pause(900);
    assert.ok(await evaluate('Boolean(document.querySelector(".hero-search"))'),"hero rendered");
    const metrics=()=>evaluate(`(() => { const fields=[...document.querySelectorAll(".hero-search-field")].map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});return {width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,fields,heroHeight:document.querySelector(".home-hero").getBoundingClientRect().height,searchBottom:document.querySelector(".hero-search").getBoundingClientRect().bottom,cta:[...document.querySelectorAll("a")].filter(el=>el.textContent.includes("Browse Vehicles")&&el.getBoundingClientRect().height>0).length}; })()`);
    for(const [width,height] of [[320,568],[375,667],[390,844],[504,650],[768,1024],[1440,900]]){
        await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<640});
        await pause(250);
        const m=await metrics(); assert.equal(m.overflow,false,JSON.stringify(m));
        if(width<640){assert.ok(m.heroHeight >= height-65,"hero fills the viewport above bottom navigation");assert.equal(m.fields[1].y,m.fields[2].y,"dates share one row"); assert.equal(m.cta,0,"duplicate CTA hidden"); assert.ok(m.fields.every(f=>f.h>=44),"touch targets");}
        console.log(JSON.stringify(m));
    }
    await call("Emulation.setDeviceMetricsOverride", { width:375,height:667,deviceScaleFactor:1,mobile:true });
    await pause(250);
    await call("Page.captureScreenshot", {format:"png"}).then(result=>writeFile(path.join(tmpdir(),"rent-a-ride-mobile-hero-preview.png"),Buffer.from(result.data,"base64")));
    await evaluate('[...document.querySelectorAll("header button")].find(el=>el.getAttribute("aria-label")==="Open menu").click()'); await pause(700);
    assert.ok(await evaluate('[...document.querySelectorAll("button")].some(el=>el.textContent.includes("Become a Partner")&&el.getBoundingClientRect().height>0)'),"partner accessible from home menu");
    assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Menu"] a[href="/explore"] .grid > div').length`),3,"menu shows the three configured destinations");
    for(const width of [320,375,504]) {
        await call("Emulation.setDeviceMetricsOverride",{width,height:667,deviceScaleFactor:1,mobile:true}); await pause(100);
        assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth'),false,"menu has no horizontal overflow");
    }
    await evaluate(`document.querySelector('[aria-label="Menu"] a[href="/explore"]').click()`);await pause(600);
    assert.equal(await evaluate('document.getElementById("route").textContent'),"/explore","menu card navigates to Explore");
    assert.equal(await evaluate(`Boolean(document.querySelector('[aria-label="Menu"]'))`),false,"card closes the menu");
    await evaluate('history.pushState({},"","/");window.dispatchEvent(new PopStateEvent("popstate"));window.failDestinations=true;');await pause(150);
    await evaluate('[...document.querySelectorAll("header button")].find(el=>el.getAttribute("aria-label")==="Open menu").click()');await pause(700);
    assert.ok(await evaluate(`Boolean(document.querySelector('[aria-label="Menu"] a[href="/explore"]'))`),"Explore remains available if thumbnails fail");
    await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape"});await pause(500);
    await evaluate('document.querySelector(".hero-search-field").click()'); await pause(400);
    assert.ok(await evaluate('Boolean(document.querySelector("[aria-modal=true]"))'),"category opens a mobile sheet");
    await evaluate('[...document.querySelectorAll("[role=option]")].find(el=>el.textContent.includes("Cars")).click()'); await pause(350);
    assert.ok(await evaluate('document.querySelector(".hero-search-field").textContent.includes("Cars")'),"category selection retained");
    await evaluate('document.querySelectorAll(".hero-search-field")[1].click()'); await pause(700);
    assert.ok(await evaluate('Boolean(document.querySelector("[aria-modal=true]"))'),"dates open a mobile sheet");
    const dialog=await evaluate('(()=>{const r=document.querySelector("[aria-modal=true]").getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:innerHeight};})()');
    assert.ok(dialog.top>=0&&dialog.bottom<=dialog.height+1,JSON.stringify(dialog));
    await evaluate('[...document.querySelectorAll("[aria-modal=true] button")].find(el=>el.textContent.trim()==="3 days").click()'); await pause(350);
    assert.ok(await evaluate('!document.querySelectorAll(".hero-search-field")[1].textContent.includes("Add date")'),"dates retained");
    await evaluate('document.querySelector(".hero-search-submit").click()'); await pause(350);
    const route=await evaluate('document.getElementById("route").textContent');
    assert.match(route,/^\/available\?/);assert.match(route,/category=car/);assert.match(route,/pickup=/);assert.match(route,/return=/);
    console.log("PASS: mobile/desktop widths, category/date sheets and search query.");
} finally {
    socket?.close(); browser?.kill(); await server?.close();
    await Promise.all([fixture,entry].map(file=>unlink(file).catch(()=>{})));
}
