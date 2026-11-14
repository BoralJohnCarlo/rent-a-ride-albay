import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import axios from "axios";

test("a stalled history request times out and a subsequent retry succeeds", { timeout: 22000 }, async () => {
    let calls = 0;
    const server = createServer((_request, response) => {
        calls += 1;
        if (calls === 1) return; // Intentionally leave the first connection open.
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ success: true, data: { points: [] } }));
    });
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    try {
        globalThis.__gpsHistoryTimeoutApi = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, proxy: false });
        const source = (await readFile(new URL("../src/api/telemetryApi.js", import.meta.url), "utf8"))
            .replace('import api from "../lib/axios";', 'const api = globalThis.__gpsHistoryTimeoutApi;');
        const { getVehicleTelemetryHistory } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
        delete globalThis.__gpsHistoryTimeoutApi;
        await assert.rejects(getVehicleTelemetryHistory("vehicle"), error => ["ECONNABORTED", "ETIMEDOUT"].includes(error.code));
        assert.deepEqual(await getVehicleTelemetryHistory("vehicle"), { success: true, data: { points: [] } });
        assert.equal(calls, 2);
    } finally {
        delete globalThis.__gpsHistoryTimeoutApi;
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
});
