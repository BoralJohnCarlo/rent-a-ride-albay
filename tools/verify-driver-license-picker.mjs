// Isolated UI regression check. No API calls or saved driver changes.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = path.join(root, "client");
const fixture = path.join(client, ".driver-license-check.html");
const entry = path.join(client, "src", ".driver-license-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "driver-license-check-"));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, server, socket;

try {
    await writeFile(fixture, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{transition-duration:0s!important;animation:none!important}</style></head><body><div id="root"></div><script type="module" src="/src/.driver-license-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import DriverForm from "./components/forms/DriverForm";
import "./index.css";
const driver = { firstName: "Test", lastName: "Driver", email: "driver@example.test", phoneNumber: "09123456789", license: { licenseNumber: "TEST-123", licenseType: "Professional", expiryDate: "2099-12-31", restrictionCodes: ["B1", "C"] } };
function App() {
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState("edit");
    window.setLoading = setLoading;
    window.setMode = setMode;
    return <main style={{ padding: 16, maxWidth: 900, margin: "auto" }}><DriverForm mode={mode} loading={loading} driver={driver} onSubmit={payload => { window.savedDriver = payload; }} /></main>;
}
createRoot(document.getElementById("root")).render(<App/>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5198, strictPort: true } });
    await server.listen();
    browser = spawn(process.env.BUTTON_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    let port;
    for (let count = 0; count < 100; count++) {
        try { port = Number((await readFile(path.join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]); break; } catch { await pause(100); }
    }
    assert.ok(port, "headless browser started");
    const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Browser connection timed out")), 15000);
        socket.onopen = () => { clearTimeout(timeout); resolve(); };
        socket.onerror = () => { clearTimeout(timeout); reject(new Error("Browser connection failed")); };
    });
    let id = 0;
    const pending = new Map();
    socket.onmessage = ({ data }) => {
        const message = JSON.parse(data);
        if (pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(message.error) : resolve(message.result); }
    };
    const call = (method, params = {}) => new Promise((resolve, reject) => {
        const callId = ++id;
        const timeout = setTimeout(() => { pending.delete(callId); reject(new Error(method + " timed out")); }, 15000);
        pending.set(callId, { resolve: (result) => { clearTimeout(timeout); resolve(result); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
        socket.send(JSON.stringify({ id: callId, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    const clickText = async (text) => {
        assert.ok(await evaluate(`(() => { const button = [...document.querySelectorAll("button")].find(el => el.textContent.trim() === ${JSON.stringify(text)}); if (!button) return false; button.click(); return true; })()`), `button ${text} exists`);
        await pause(450);
    };
    const waitFor = async (expression) => {
        for (let count = 0; count < 150; count++) { if (await evaluate(expression)) return; await pause(100); }
        assert.fail(`Timed out: ${expression}`);
    };
    await call("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await call("Page.navigate", { url: "http://127.0.0.1:5198/.driver-license-check.html" });
    await waitFor('Boolean(document.querySelector("form"))');
    await clickText("Next");
    await clickText("Next");
    await waitFor('Boolean(document.querySelector("fieldset"))');
    assert.match(await evaluate('document.querySelector("fieldset summary").textContent'), /B1, C/, "existing additional codes remain visible");
    for (const width of [320, 375, 390, 768, 1280]) {
        await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        for (const theme of ["light", "dark"]) {
            await evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}; document.querySelector("fieldset details").open = true`);
            await pause(200);
            const metrics = await evaluate('(() => { const field = document.querySelector("fieldset"); return { overflow: document.documentElement.scrollWidth > innerWidth, buttonsFit: [...field.querySelectorAll("button")].every(el => { const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.height >= 44; }) }; })()');
            assert.equal(metrics.overflow, false, `${width}px ${theme}: form has no horizontal overflow`);
            assert.equal(metrics.buttonsFit, true, `${width}px ${theme}: all license options fit with 44px touch targets`);
        }
    }
    await clickText("AMotorcycle");
    await clickText("BPassenger Car");
    await clickText("AMotorcycle");
    assert.equal(await evaluate('document.querySelector("fieldset button").getAttribute("aria-pressed")'), "false", "main option can be deselected");
    await evaluate('window.setLoading(true)');
    await pause(200);
    assert.equal(await evaluate('[...document.querySelectorAll("fieldset button")].every(el => el.disabled)'), true, "loading disables every option");
    await evaluate('window.setLoading(false)');
    await pause(200);
    await clickText("Next");
    await clickText("Next");
    await waitFor('document.body.textContent.includes("Driver\'s License Codes")');
    await clickText("Update Driver");
    const saved = await evaluate('window.savedDriver');
    assert.ok(saved, "form builds a valid payload");
    assert.deepEqual(saved.license.restrictionCodes, ["B1", "C", "B"], "saving preserves original categories and changes only toggled codes");
    await evaluate('window.setMode("view")');
    await pause(300);
    await clickText("Next");
    await clickText("Next");
    await waitFor('Boolean(document.querySelector("fieldset"))');
    assert.equal(await evaluate('document.querySelectorAll("fieldset button").length'), 9, "all codes remain available in view mode");
    assert.equal(await evaluate('[...document.querySelectorAll("fieldset button")].every(el => el.disabled)'), true, "view mode is read-only");
    console.log("PASS: actual driver form, selection/deselection, existing-code preservation, save payload, loading/view protection, and 320/375/390/768/1280px light/dark layouts.");
} finally {
    socket?.close();
    browser?.kill();
    await server?.close();
    await Promise.all([fixture, entry].map((file) => unlink(file).catch(() => {})));
}
