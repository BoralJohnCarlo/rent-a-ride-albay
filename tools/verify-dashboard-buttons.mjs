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
const fixture = path.join(client, ".dashboard-button-check.html");
const entry = path.join(client, "src", ".dashboard-button-check.jsx");
const profile = await mkdtemp(path.join(tmpdir(), "dashboard-button-check-"));
let browser, server, socket;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
    // Disable decorative transitions only in this fixture for deterministic color assertions.
    await writeFile(fixture, '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*,*::before,*::after{transition-duration:0s!important;animation:none!important}</style></head><body class="dashboard-scope"><div id="root"></div><script type="module" src="/src/.dashboard-button-check.jsx"></script></body></html>');
    await writeFile(entry, `
import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import ThemeContext from "./context/ThemeContext";
import ToastContext from "./context/ToastContext";
import ThemeSettings from "./pages/admin/settings/ThemeSettings";
import Button from "./components/common/Button";
import { buttonThemeStyle } from "./utils/dashboardButtonTheme";
import "./index.css";
const settings = { themeSettings: { christmas: { enabled: true, startMonth: 9, startDay: 1, endMonth: 1, endDay: 1 }, buttonColor: "#2563eb", buttonHoverColor: "#1d4ed8" } };
const state = { settings: { settings, loading: false, error: null } };
const store = { getState: () => state, subscribe: () => () => {}, dispatch: () => Promise.resolve({ meta: { requestStatus: "fulfilled" } }) };
Object.entries(buttonThemeStyle(settings.themeSettings)).forEach(([key,value]) => document.documentElement.style.setProperty(key,value));
createRoot(document.getElementById("root")).render(<Provider store={store}><ThemeContext.Provider value={{ refreshSeasonConfig: async () => {} }}><ToastContext.Provider value={{ success: () => {}, error: () => {} }}><main style={{ padding: 16, maxWidth: 1200, margin: "auto" }}><ThemeSettings/><div id="actions" className="mt-4 flex flex-wrap gap-3"><Button>Primary check</Button><Button variant="danger">Danger check</Button><Button variant="success">Success check</Button><Button disabled>Disabled check</Button></div></main></ToastContext.Provider></ThemeContext.Provider></Provider>);
`);
    server = await createServer({ root: client, server: { host: "127.0.0.1", port: 5198, strictPort: true } });
    await server.listen();
    console.log("Local fixture server ready.");
    browser = spawn(process.env.BUTTON_CHECK_BROWSER || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-allow-origins=*", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
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
        const timeout = setTimeout(() => { pending.delete(callId); reject(new Error(method + " timed out")); }, 10000);
        pending.set(callId, { resolve: (result) => { clearTimeout(timeout); resolve(result); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
        socket.send(JSON.stringify({ id: callId, method, params }));
    });
    const evaluate = async (expression) => {
        const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
        assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
        return result.result.value;
    };
    await call("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
    await call("Page.navigate", { url: "http://127.0.0.1:5198/.dashboard-button-check.html" });
    for (let count = 0; count < 150; count++) {
        if (await evaluate('Boolean(document.getElementById("buttonColor"))')) break;
        await pause(100);
    }
    assert.ok(await evaluate('Boolean(document.getElementById("buttonColor"))'), "settings rendered");
    console.log("Settings rendered.");
    for (const width of [320, 375, 390, 768, 1280]) {
        await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
        for (const theme of ["light", "dark"]) {
            await evaluate(`document.documentElement.dataset.theme = ${JSON.stringify(theme)}`);
            await pause(350);
            const metrics = await evaluate(`(() => { const section = document.querySelector("section"); const rect = section.getBoundingClientRect(); const picker = document.getElementById("buttonColor").getBoundingClientRect(); return { overflow: document.documentElement.scrollWidth > innerWidth, sectionFits: rect.left >= 0 && rect.right <= innerWidth, touchHeight: picker.height, primary: getComputedStyle(document.querySelector("#actions .dashboard-primary-button")).backgroundColor }; })()`);
            assert.equal(metrics.overflow, false, `${width}px ${theme}: no page overflow`);
            assert.equal(metrics.sectionFits, true, `${width}px ${theme}: settings fit`);
            assert.ok(metrics.touchHeight >= 44, "color picker has a 44px touch target");
            assert.equal(metrics.primary, "rgb(37, 99, 235)", "shared primary color applies");
        }
    }
    const before = await evaluate('Array.from(document.querySelectorAll("#actions button")).map(el => getComputedStyle(el).backgroundColor)');
    await call("Emulation.setTouchEmulationEnabled", { enabled: false });
    const point = await evaluate('(() => { const el = document.querySelector("#actions .dashboard-primary-button"); el.scrollIntoView(); const rect = el.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; })()');
    await call("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await pause(350);
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#actions .dashboard-primary-button")).backgroundColor'), "rgb(29, 78, 216)", "desktop pointer uses configured hover color");
    await call("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
    await evaluate('document.documentElement.style.setProperty("--dashboard-button", "#fde047"); document.documentElement.style.setProperty("--dashboard-button-text", "#000000")');
    await pause(350);
    const after = await evaluate('Array.from(document.querySelectorAll("#actions button")).map(el => getComputedStyle(el).backgroundColor)');
    assert.equal(after[0], "rgb(253, 224, 71)");
    assert.deepEqual(after.slice(1), before.slice(1), "danger, success and disabled colors stay independent");
    await evaluate('document.body.classList.remove("dashboard-scope")');
    await pause(350);
    const customer = await evaluate('(() => { const reference = document.createElement("span"); reference.className = "bg-blue-600"; document.body.append(reference); const expected = getComputedStyle(reference).backgroundColor; reference.remove(); return { actual: getComputedStyle(document.querySelector("#actions .dashboard-primary-button")).backgroundColor, expected }; })()');
    assert.equal(customer.actual, customer.expected, "customer buttons retain their styles");
    console.log("PASS: actual settings component at 320/375/390/768/1280px in light and dark themes; touch targets, primary colors, semantic colors and customer isolation.");
} finally {
    socket?.close();
    browser?.kill();
    await server?.close();
    // Only remove the two exact fixture files created by this check.
    await Promise.all([fixture, entry].map((file) => unlink(file).catch(() => {})));
}
