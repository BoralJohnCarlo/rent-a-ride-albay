// Real customer/public components with isolated API responses; no live records are changed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const html = path.join(client, ".customer-public-mobile-check.html");
const entry = path.join(client, "src", ".customer-public-mobile-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "customer-public-mobile-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;
try {
    await writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/.customer-public-mobile-check.jsx"></script></body></html>');
    await writeFile(entry, await readFile(path.join(root,"tools/fixtures/customer-public-mobile.jsx"),"utf8"));
    server = await createServer({ root: client, plugins:[{name:"audit-no-live-sockets",enforce:"pre",transform(source,id){if(id.replaceAll("\\","/").endsWith("/hooks/shared/useSocket.js"))return "export default function useSocket(){return {socket:{on:()=>{},off:()=>{},emit:()=>{},connected:false},connected:false,error:null,on:()=>()=>{},emit:()=>{},off:()=>{}};} export const getSocket=()=>null;";}}], server: { host: "127.0.0.1", port: 5214, strictPort: true } });
    await server.listen();
    console.log("Customer/public visual fixture ready");
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

    const phase=process.env.CUSTOMER_PUBLIC_PHASE||"before";
    const out=path.join(root,"artifacts/customer-public-mobile",phase);await mkdir(out,{recursive:true});
    const routes=JSON.parse(await readFile(path.join(root,"tools/fixtures/customer-public-routes.json"),"utf8"));
    const devices=[{name:"iPhone-SE",width:375,height:667},{name:"iPhone-16",width:393,height:852},{name:"iPhone-16-Pro-Max",width:440,height:956},{name:"Pixel-9",width:412,height:924},{name:"Pixel-9-Pro",width:427,height:952},{name:"Pixel-10",width:412,height:924},{name:"Galaxy-A55",width:360,height:800}];
    const results=(process.env.CUSTOMER_PUBLIC_DETAILS_ONLY||process.env.CUSTOMER_PUBLIC_RESUME)?JSON.parse(await readFile(path.join(out,"report.json"),"utf8")).filter(x=>!x.state||process.env.CUSTOMER_PUBLIC_MATRIX_ONLY):[];
    const open=async(route,state="populated")=>{await call("Page.navigate",{url:"http://127.0.0.1:5214/.customer-public-mobile-check.html?route="+encodeURIComponent(route)+"&state="+state});await waitFor('typeof window.fixtureNavigate==="function"');await pause(state==="loading"?200:1200);};
    const shot=async name=>{await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const s=await call("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,name+".png"),Buffer.from(s.data,"base64"));};
    const metrics=()=>evaluate('(()=>{const m=document.querySelector("main");return {width:innerWidth,body:document.documentElement.scrollWidth,errors:window.fixtureErrors||[],main:!!m,text:document.body.innerText.slice(0,180),wide:[...document.querySelectorAll("main *")].filter(n=>{const r=n.getBoundingClientRect();return r.width>innerWidth+2&&getComputedStyle(n).position!=="absolute";}).slice(0,8).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,50)}))};})()');
    for(const {name,route} of process.env.CUSTOMER_PUBLIC_DETAILS_ONLY?[]:routes.filter(x=>!results.some(r=>r.label===x.name+"-Galaxy-A55-landscape"))){
        await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});await open(route);
        for(const d of phase==="after"?devices:[devices[0]])for(const landscape of phase==="after"?[false,true]:[false]){
            const width=landscape?d.height:d.width,height=landscape?d.width:d.height;
            await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});await evaluate('window.scrollTo(0,0)');await pause(220);
            const label=name+"-"+d.name+(landscape?"-landscape":"-portrait"),m=await metrics();results.push({label,...m});
            if(phase==="after"){assert.equal(m.errors.length,0,label+" runtime errors: "+m.errors);assert.ok(m.main,label+" missing main");assert.ok(m.body<=width+1,label+" overflow: "+JSON.stringify(m.wide));}
            if(phase!=="after"||d.name==="iPhone-SE"||d.name==="Galaxy-A55"&&!landscape||d.name==="iPhone-16-Pro-Max"&&landscape)await shot(label);
            if(d.name==="iPhone-SE"&&!landscape){for(const section of ["middle","bottom"]){await evaluate(section==="middle"?'window.scrollTo(0,document.documentElement.scrollHeight/2)':'window.scrollTo(0,document.documentElement.scrollHeight)');await pause(450);await shot(label+"-"+section);}}
        }
        console.log("Audited "+name);await writeFile(path.join(out,"report.json"),JSON.stringify(results,null,2));
    }
    if(phase==="after"&&!process.env.CUSTOMER_PUBLIC_MATRIX_ONLY){
        await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
        for(const {name,route}of routes.filter(x=>["public-PublicVehicles","public-VehicleDetails","public-AvailableVehicles","customer-Bookings","customer-BookingDetails","customer-Favorites","customer-Checkout","customer-CustomerService","customer-Notifications"].includes(x.name))){for(const state of ["empty","loading","error"]){await open(route,state);const m=await metrics();assert.equal(m.errors.length,0,name+" "+state+" errors");assert.ok(m.body<=376,name+" "+state+" overflow");results.push({label:name,state,...m});await shot(name+"-"+state);}console.log("Checked data states: "+name);}
        const checkDialog=async(name)=>{await waitFor('!!document.querySelector("[role=dialog]")');await pause(400);for(const [width,height]of [[375,667],[667,375],[375,340]]){await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});await pause(200);assert.equal(await evaluate('(()=>{const d=document.querySelector("[role=dialog]");const r=d.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&d.scrollWidth<=d.clientWidth+1;})()'),true,name+" dialog clipped");await shot(name+"-"+width+"x"+height);}await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});};
        for(const route of ["/","/customer/home"]){await open(route);await evaluate('document.querySelector("button[aria-label=\'Open menu\']").click()');await checkDialog(route==="/"?"public-menu":"customer-menu");await evaluate('document.querySelector("button[aria-label=\'Close menu\']").click()');await pause(300);}
        await open("/");await evaluate('[...document.querySelectorAll("main button")].find(b=>b.textContent.includes("Pickup date")).click()');await checkDialog("hero-date-picker");
        for(const route of ["/register","/register-operator"]){await call("Emulation.setDeviceMetricsOverride",{width:667,height:375,deviceScaleFactor:1,mobile:true});await open(route);assert.equal(await evaluate('(()=>{const fields=document.querySelector(".registration-fields");return getComputedStyle(fields).overflowY==="visible"&&document.querySelector(".registration-card").getBoundingClientRect().height>300;})()'),true,"short sign-up form squeezed");await evaluate('document.querySelector(".registration-fields input").scrollIntoView({block:"center"})');await shot(route.slice(1)+"-landscape-fields");}
        await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});await open("/customer/profile");await click("Edit Profile");assert.ok((await metrics()).body<=376,"profile editing overflow");await shot("customer-profile-editing");
        await open("/customer/customer-service");await click("New");assert.ok((await metrics()).body<=376,"new conversation overflow");await shot("new-conversation");
        await open("/customer/bookings/000000000000000000000003");await click("Cancel Booking");await checkDialog("cancel-booking");
        console.log("Checked menus, date picker, short signup forms, profile editing, new conversation, and cancellation dialog");
        await writeFile(path.join(out,"report.json"),JSON.stringify(results,null,2));
    }
    console.log("Screenshots and metrics: "+out);
}finally{socket?.close();browser?.kill();await server?.close();await Promise.all([html,entry].map(f=>unlink(f).catch(()=>{})));}
