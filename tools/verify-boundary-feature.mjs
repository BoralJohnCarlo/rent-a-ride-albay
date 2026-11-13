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
const html = path.join(client, ".boundary-feature-check.html");
const entry = path.join(client, "src", ".boundary-feature-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "boundary-feature-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, socket;
try {
    await writeFile(html, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/src/.boundary-feature-check.jsx"></script></body></html>');
    await writeFile(entry, await readFile(path.join(root,"tools/fixtures/boundary-feature.jsx"),"utf8"));
    server = await createServer({ root: client, plugins:[{name:"audit-no-live-sockets",enforce:"pre",transform(source,id){if(id.replaceAll("\\","/").endsWith("/hooks/shared/useSocket.js"))return "export default function useSocket(){return {socket:null,connected:false,error:null,on:()=>()=>{},emit:()=>{},off:()=>{}};} export const getSocket=()=>null;";}}], server: { host: "127.0.0.1", port: 5227, strictPort: true } });
    await server.listen();
    console.log("Full admin visual fixture ready");
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

    const out=path.join(root,"artifacts/boundary-feature");await mkdir(out,{recursive:true});
    await call("Emulation.setDeviceMetricsOverride",{width:375,height:667,deviceScaleFactor:1,mobile:true});
    await call("Page.navigate",{url:"http://127.0.0.1:5227/.boundary-feature-check.html"});
    await waitFor('document.body.innerText.includes("Recent boundary incidents") && document.body.innerText.includes("RN-000001")');
    const results=[];
    for(const [width,height] of [[320,640],[375,667],[667,375],[440,956]]) for(const dark of [false,true]) {
        await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});
        await evaluate('document.documentElement.dataset.theme=' + JSON.stringify(dark ? "dark" : "light"));await pause(150);
        const overflow=await evaluate('document.documentElement.scrollWidth>innerWidth+1');
        assert.equal(overflow,false,'boundary overflow '+width+'x'+height+' dark='+dark);
        const screen=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:true});
        await writeFile(path.join(out,width+'x'+height+'-'+(dark?'dark':'light')+'.png'),Buffer.from(screen.data,"base64"));
        results.push({width,height,dark,overflow});
    }
    await evaluate('document.querySelector("#boundary-alerts").click()');
    await click("Save boundary settings");
    await waitFor('document.body.innerText.includes("Boundary settings saved.")');
    assert.equal(await evaluate('window.fixtureRequests.findLast(r=>r.method==="put").body.boundarySettings.alertsEnabled'),false);
    assert.equal(await evaluate('document.querySelector("#boundary-penalties").disabled'),true);
    await evaluate('document.querySelector("#boundary-alerts").click()');
    await evaluate('document.querySelector("#boundary-penalties").click()');
    await click("Save boundary settings");
    await waitFor('window.fixtureRequests.filter(r=>r.method==="put").length===2');
    assert.equal(await evaluate('window.fixtureRequests.findLast(r=>r.method==="put").body.boundarySettings.penaltiesEnabled'),true);
    await evaluate('[...document.querySelectorAll("label")].find(l=>l.textContent.includes("Review reason")).parentElement.querySelector("input").focus()');
    await call("Input.insertText",{text:"Route and customer warning reviewed"});
    await click("Approve charge");
    await waitFor('document.body.innerText.includes("Boundary charge added to the rental.")');
    assert.equal(await evaluate('window.fixtureRequests.findLast(r=>r.url.includes("/review")).body.action'),"approve");
    await writeFile(path.join(out,"report.json"),JSON.stringify(results,null,2));
    console.log("Boundary UI: 8 viewport/theme checks, alert and penalty toggles, save and review passed.");

} finally {
    socket?.close(); browser?.kill(); await server?.close();
    await Promise.all([html, entry].map((file) => unlink(file).catch(() => {})));
}
