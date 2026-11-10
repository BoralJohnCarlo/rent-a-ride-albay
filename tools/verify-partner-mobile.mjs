// Real appointment components with isolated API responses; no live appointments are changed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const html = path.join(client, ".partner-mobile-check.html");
const entry = path.join(client, "src", ".partner-mobile-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "partner-mobile-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;
try {
    await writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/.partner-mobile-check.jsx"></script></body></html>');
    await writeFile(entry, await readFile(path.join(root,"tools/fixtures/partner-mobile.jsx"),"utf8"));
    server = await createServer({ root: client, plugins:[{name:"audit-no-live-sockets",enforce:"pre",transform(source,id){if(id.replaceAll("\\","/").endsWith("/hooks/shared/useSocket.js"))return "export default function useSocket(){return {socket:{on:()=>{},off:()=>{},emit:()=>{},connected:false},connected:false,error:null,on:()=>()=>{},emit:()=>{},off:()=>{}};} export const getSocket=()=>null;";}}], server: { host: "127.0.0.1", port: 5212, strictPort: true } });
    await server.listen();
    console.log("Full partner visual fixture ready");
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

    const phase=process.env.PARTNER_MOBILE_PHASE||"before";
    const out=path.join(root,"artifacts/partner-mobile",phase);await mkdir(out,{recursive:true});
    const devices=[{name:"iPhone-SE",width:375,height:667},{name:"iPhone-16",width:393,height:852},{name:"iPhone-16-Pro-Max",width:440,height:956},{name:"Pixel-9",width:412,height:924},{name:"Pixel-9-Pro",width:427,height:952},{name:"Pixel-10",width:412,height:924},{name:"Galaxy-A55",width:360,height:800}];
    const routes=["/operator","/operator/bookings","/operator/vehicles","/operator/consignments","/operator/earnings","/operator/tracking","/operator/profile","/operator/settings","/operator/notifications"];
    const results=process.env.PARTNER_AUDIT_DETAILS_ONLY ? JSON.parse(await readFile(path.join(out,"report.json"),"utf8")).filter(row=>!row.label.startsWith("/")) : [];
    await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
    await call("Page.navigate",{url:"http://127.0.0.1:5212/.partner-mobile-check.html"});await pause(1800);await waitFor('typeof window.fixtureNavigate==="function"');
    for(const route of routes){
        await evaluate(`window.fixtureNavigate(${JSON.stringify(route)})`);await pause(1600);
        const profiles=process.env.PARTNER_AUDIT_DETAILS_ONLY?[]:phase==="after"?devices:[devices[0]];
        for(const device of profiles){
            for(const landscape of phase==="after"?[false,true]:[false]){
                const width=landscape?device.height:device.width,height=landscape?device.width:device.height;
                await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});await pause(350);
                await evaluate('document.querySelector("main")?.scrollTo(0,0)');await pause(150);
                const label=(route==="/operator"?"dashboard":route.split("/").at(-1))+"-"+device.name+(landscape?"-landscape":"-portrait");
                const metrics=await evaluate('(()=>{const m=document.querySelector("main");const h=document.querySelector("header");return {body:document.documentElement.scrollWidth,viewport:innerWidth,main:m?{width:m.clientWidth,scroll:m.scrollWidth,height:m.clientHeight,content:m.scrollHeight}:null,header:h?{width:h.clientWidth,scroll:h.scrollWidth,buttons:[...h.querySelectorAll("button")].map(b=>({text:b.textContent,label:b.getAttribute("aria-label"),rect:{x:b.getBoundingClientRect().x,width:b.getBoundingClientRect().width},display:getComputedStyle(b).display,opacity:getComputedStyle(b).opacity}))}:null,text:document.body.innerText.slice(0,250),errors:window.fixtureErrors,wide:m?[...m.querySelectorAll("*")].filter(n=>{const r=n.getBoundingClientRect();return r.width>m.clientWidth+2&&getComputedStyle(n).position!=="absolute";}).slice(0,12).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,70)})):[]};})()');
                results.push({label,...metrics});
                if(phase==="after"){assert.equal(metrics.errors.length,0,label+" runtime errors");assert.ok(metrics.main,label+" missing main");assert.ok(metrics.body<=width+1,label+" page overflow");assert.ok(metrics.main.scroll<=metrics.main.width+1,label+" main overflow");assert.equal(metrics.header.buttons.length,2,label+" missing header actions");assert.ok(metrics.header.buttons.every(b=>b.rect.x>=0&&b.rect.x+b.rect.width<=width+1&&b.rect.width>=44),label+" header actions clipped");}
                await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
                const shot=await call("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,label+".png"),Buffer.from(shot.data,"base64"));
                if(device.name==="iPhone-SE"&&!landscape){for(const section of ["middle","bottom"]){await evaluate(section==="middle"?'document.querySelector("main").scrollTop=document.querySelector("main").scrollHeight/2':'document.querySelector("main").scrollTop=999999');await pause(1000);assert.equal(await evaluate('(()=>{const m=document.querySelector("main");const box=m.getBoundingClientRect();return [...m.querySelectorAll("section")].filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.height&&r.top<box.bottom&&r.bottom>box.top;}).some(n=>Number(getComputedStyle(n).opacity)<0.9);})()'),false,"invisible content after scrolling");const detail=await call("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,label+"-"+section+".png"),Buffer.from(detail.data,"base64"));}}
                if(phase==="before")console.log(label+" "+JSON.stringify(metrics));
            }
        }
        console.log("Audited "+route);await writeFile(path.join(out,"report.json"),JSON.stringify(results,null,2));
    }

    if(phase==="after"){
        await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
        for(const route of routes){
            for(const state of ["empty","error","loading"]){
                await call("Page.navigate",{url:"http://127.0.0.1:5212/.partner-mobile-check.html?route="+encodeURIComponent(route)+"&state="+state});
                await waitFor('typeof window.fixtureNavigate==="function"');await pause(state==="loading"?250:1300);
                const metrics=await evaluate('(()=>{const m=document.querySelector("main");return {errors:window.fixtureErrors,body:document.documentElement.scrollWidth,main:m?{width:m.clientWidth,scroll:m.scrollWidth}:null};})()');
                assert.equal(metrics.errors.length,0,route+" "+state+" runtime error");assert.ok(metrics.body<=376,route+" "+state+" overflow");
                results.push({label:route+"-"+state,...metrics});
                const shot=await call("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,(route==="/operator"?"dashboard":route.split("/").at(-1))+"-"+state+".png"),Buffer.from(shot.data,"base64"));
            }
            console.log("Checked populated, empty, error, and loading layouts: "+route);
        }
        const openRoute=async route=>{await call("Page.navigate",{url:"http://127.0.0.1:5212/.partner-mobile-check.html?route="+encodeURIComponent(route)});await waitFor('typeof window.fixtureNavigate==="function"');await pause(1200);};
        const snapshot=async name=>{const shot=await call("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,name+".png"),Buffer.from(shot.data,"base64"));};
        await openRoute("/operator");
        await evaluate('document.querySelector("button[aria-label=\'Open account menu\']").click()');await pause(350);
        assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,"drawer overflow");await snapshot("account-drawer");
        await evaluate('document.querySelector("button[aria-label=\'Close menu\']").click()');await pause(250);
        const checkDialog=async name=>{
            await waitFor('!!document.querySelector("[role=dialog]")');await pause(500);
            for(const [width,height] of [[375,667],[667,375],[375,340]]){
                await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});await pause(250);
                assert.equal(await evaluate('(()=>{const d=document.querySelector("[role=dialog]");const r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1;})()'),true,name+" clipped");
                await snapshot(name+"-"+width+"x"+height);
            }
            await evaluate('document.querySelector("button[aria-label=\'Close modal\']").click()');await pause(250);
            await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
        };
        await openRoute("/operator/bookings");await evaluate('[...document.querySelectorAll("main button")].find(b=>b.textContent.includes("BK-000003")).click()');await checkDialog("booking-details");
        await openRoute("/operator/consignments");await click("New Application");await checkDialog("new-application");
        await openRoute("/operator/earnings");await click("Withdraw to GCash");await checkDialog("withdrawal");
        await openRoute("/operator/settings");await evaluate('[...document.querySelectorAll("main button")].find(b=>b.textContent.includes("Change Password")).click()');await pause(500);for(const [width,height] of [[375,667],[667,375]]){await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});await pause(200);assert.equal(await evaluate('document.querySelector("main").scrollWidth>document.querySelector("main").clientWidth+1'),false,"password form overflow");await snapshot("change-password-"+width+"x"+height);}await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
        await openRoute("/operator/profile");await click("Edit Profile");await pause(300);assert.equal(await evaluate('document.documentElement.scrollWidth>innerWidth+1'),false,"profile editing overflow");await snapshot("profile-editing");
        console.log("Checked partner drawer, booking details, application, withdrawal, password form, and profile editing");
    }
    await writeFile(path.join(out,"report.json"),JSON.stringify(results,null,2));
    console.log("Screenshots and metrics: "+out);

} finally {
    socket?.close(); browser?.kill(); await server?.close();
    await Promise.all([html, entry].map((file) => unlink(file).catch(() => {})));
}
