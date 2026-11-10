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

    const out=path.join(root,"artifacts/registration-phone");await mkdir(out,{recursive:true});
    const devices=[["iPhone-SE",375,667],["iPhone-16",393,852],["iPhone-16-Pro-Max",440,956],["Pixel-9",412,924],["Pixel-9-Pro",427,952],["Pixel-10",412,924],["Galaxy-A55",360,800]];
    const replace=async(id,value)=>{await evaluate(`(()=>{const input=document.getElementById(${JSON.stringify(id)});input.focus();input.select();})()`);await call("Input.insertText",{text:value});await pause(60);};
    const report=[];
    for(const route of ["/register","/register-operator"]){
        await call("Page.navigate",{url:"http://127.0.0.1:5214/.customer-public-mobile-check.html?route="+encodeURIComponent(route)});await waitFor('!!document.getElementById("phoneNumber")');await pause(800);
        for(const id of ["phoneNumber","alternativeContact"]){
            assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`),"");
            for(const value of ["9171234567","09171234567","639171234567","+639171234567","+63 (917) 123-4567"]){await replace(id,value);assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`),"9171234567",route+" "+id+" paste "+value);assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).checkValidity()`),true);}
            await replace(id,"8171234567");assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).checkValidity()`),false,"invalid mobile start accepted");
            await replace(id,"917");assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`),"917");assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).checkValidity()`),false,"short number accepted");
            await replace(id,"9171234567");await replace(id,"letters");assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`),"9171234567","invalid paste replaced a valid value");
            await replace(id,"");assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).value`),"");
            assert.equal(await evaluate(`document.getElementById(${JSON.stringify(id)}).checkValidity()`),id==="alternativeContact","required/optional changed");
        }
        await replace("phoneNumber","09171234567");
        for(const [name,w,h]of devices)for(const landscape of [false,true]){
            const width=landscape?h:w,height=landscape?w:h;
            await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});await pause(180);await evaluate('document.getElementById("phoneNumber").scrollIntoView({block:"center"});document.getElementById("phoneNumber").blur()');await pause(100);
            const metrics=await evaluate('(()=>{const n=document.getElementById("phoneNumber"),r=n.getBoundingClientRect(),prefix=n.parentElement.querySelector("span").getBoundingClientRect();return {width:innerWidth,body:document.documentElement.scrollWidth,left:r.left,right:r.right,font:parseFloat(getComputedStyle(n).fontSize),padding:parseFloat(getComputedStyle(n).paddingLeft),prefixRight:prefix.right-r.left,errors:window.fixtureErrors};})()');
            assert.ok(metrics.body<=width+1,"page overflow");assert.ok(metrics.left>=0&&metrics.right<=width+1,"phone field clipped");assert.ok(metrics.padding>metrics.prefixRight,"prefix overlaps digits");assert.ok(metrics.font>=16,"phone text too small");assert.equal(metrics.errors.length,0,"runtime error");
            const label=route.slice(1)+"-"+name+(landscape?"-landscape":"-portrait");report.push({label,...metrics});
            if(name==="iPhone-SE"||name==="Galaxy-A55"){const shot=await call("Page.captureScreenshot",{format:"png"});await writeFile(path.join(out,label+".png"),Buffer.from(shot.data,"base64"));}
        }
        console.log(route+": typing, paste formats, invalid input, clearing, optional contact, and 14 mobile layouts passed");
    }
    await writeFile(path.join(out,"report.json"),JSON.stringify(report,null,2));
}finally{socket?.close();browser?.kill();await server?.close();await Promise.all([html,entry].map(f=>unlink(f).catch(()=>{})));}
