import React from "react";
import { createRoot } from "react-dom/client";
import BoundarySettings from "./components/admin/BoundarySettings";
import BoundaryNotice, { BoundaryPolicyNotice } from "./components/booking/BoundaryNotice";
import api from "./lib/axios";
import "./index.css";
import useRouteHistory from "./hooks/gps/useRouteHistory";
import HistoryControls from "./components/gps/HistoryControls";
import { toDatetimeLocalValue } from "./constants/gpsConstants";

let settings = { alertsEnabled: true, penaltiesEnabled: false, warningDistanceKm: 2, gracePeriodMinutes: 15, penaltyAmount: 500, bufferMeters: 200, confirmationSeconds: 60 };
let incident = { _id: "incident", rental: { _id: "rental", rentalCode: "RN-000001" }, vehicle: { _id: "a".repeat(24), plateNumber: "ALBAY-1234" },
    stage: "outside", review: "eligible", evidenceMinutes: 15, amount: 500, createdAt: "2026-11-13T03:00:00Z", outsideAt: "2026-11-13T03:00:00Z" };
window.fixtureRequests = [];
api.defaults.adapter = async config => {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    window.fixtureRequests.push({ url: config.url, method: config.method, body });
    if (config.url === "/boundary/current" && window.fixtureBoundaryDelay) {
        await new Promise(resolve => { window.fixtureReleaseBoundary = resolve; });
        if (window.fixtureBoundaryFailure) throw new Error("Boundary fixture unavailable");
    }
    let data;
    if (config.url.includes("/telemetry/vehicles/")) {
        if (window.fixtureHistoryTimeout) {
            if (config.timeout !== 15000) throw new Error("History timeout is missing");
            throw Object.assign(new Error("History request timed out"), { code: "ECONNABORTED" });
        }
        if (window.fixtureHistoryDelay) await new Promise(resolve => { window.fixtureReleaseHistory = resolve; });
        data = { sampled: true, returnedPoints: 2, totalPoints: 4000, points: [
            { latitude: 13, longitude: 123, gpsFix: true, speed: 30, recordedAt: "2026-11-13T03:00:00Z" },
            { latitude: 13.01, longitude: 123.01, gpsFix: true, speed: 40, recordedAt: "2026-11-13T03:01:00Z" },
        ] };
    } else if (config.url === "/settings") {
        if (config.method === "put") settings = { ...settings, ...body.boundarySettings };
        data = { boundarySettings: settings };
    } else if (config.url === "/rentals") data = [{ _id: "rental", rentalCode: "RN-000001", status: "Ongoing" }];
    else if (config.url === "/boundary/current") data = [{ id: "incident", rental: "rental", stage: "outside", review: "none", locationKnown: false, penaltiesEnabled: true, remainingMinutes: 12 },
        { id: "permission:rental", rental: "rental", kind: "permission", permissionStatus: "approved", until: "2026-11-20T04:00:00Z" }];
    else if (config.url === "/boundary/history") data = config.params?.before ? { incidents: [{ ...incident, _id: "old-incident", vehicle: { ...incident.vehicle, plateNumber: "HISTORY-OLD" }, review: "none", createdAt: "2026-11-01T00:00:00Z" }], nextCursor: null } : { incidents: [incident], nextCursor: "older" };
    else if (config.url === "/boundary/incidents") data = [incident];
    else if (config.url.includes("/review")) { incident = { ...incident, review: body.action === "approve" ? "approved" : "waived", reason: body.reason }; data = incident; }
    else data = {};
    return { status: 200, statusText: "OK", headers: {}, config, data: { success: true, data } };
};
const root = createRoot(document.getElementById("root"));
window.renderBoundaryFixture = (rentalId = "rental") => root.render(<main className="mx-auto max-w-4xl space-y-4 p-4 dark:bg-gray-950">
    <BoundaryPolicyNotice policy={{ ...settings, penaltiesEnabled: true }} />
    <BoundaryNotice rentalId={rentalId} />
    <BoundarySettings />
</main>);
window.renderBoundaryFixture();

function HistoryFixture() {
    const route = useRouteHistory("vehicle", "history");
    return <main className="mx-auto max-w-4xl p-4">
        <button onClick={() => route.setRange(previous => ({ ...previous, start: toDatetimeLocalValue(new Date(new Date(previous.start).getTime() + 60000)) }))}>Change history dates</button>
        <output id="history-state">{JSON.stringify({ hasData: Boolean(route.history.data), loading: route.history.loading, playing: route.playback.playing, index: route.playback.index })}</output>
        <HistoryControls selectedVehicle={{ brand: "Test", model: "Vehicle" }} range={route.range} onRangeChange={route.setRange}
            onLoad={route.load} {...route.history} playback={route.playback} onPlaybackToggle={route.togglePlayback} onPlaybackReset={route.resetPlayback} />
    </main>;
}
window.renderGpsHistoryFixture = () => root.render(<HistoryFixture />);
