import React from "react";
import { createRoot } from "react-dom/client";
import BoundarySettings from "./components/admin/BoundarySettings";
import BoundaryNotice, { BoundaryPolicyNotice } from "./components/booking/BoundaryNotice";
import api from "./lib/axios";
import "./index.css";

let settings = { alertsEnabled: true, penaltiesEnabled: false, warningDistanceKm: 2, gracePeriodMinutes: 15, penaltyAmount: 500, bufferMeters: 200, confirmationSeconds: 60 };
let incident = { _id: "incident", rental: { _id: "rental", rentalCode: "RN-000001" }, vehicle: { plateNumber: "ALBAY-1234" },
    stage: "outside", review: "eligible", evidenceMinutes: 15, amount: 500, createdAt: "2026-11-13T03:00:00Z", outsideAt: "2026-11-13T03:00:00Z" };
window.fixtureRequests = [];
api.defaults.adapter = async config => {
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
    window.fixtureRequests.push({ url: config.url, method: config.method, body });
    let data;
    if (config.url === "/settings") {
        if (config.method === "put") settings = { ...settings, ...body.boundarySettings };
        data = { boundarySettings: settings };
    } else if (config.url === "/rentals") data = [{ _id: "rental", rentalCode: "RN-000001", status: "Ongoing" }];
    else if (config.url === "/boundary/current") data = [{ id: "incident", rental: "rental", stage: "outside", review: "none", locationKnown: false, penaltiesEnabled: true, remainingMinutes: 12 }];
    else if (config.url === "/boundary/incidents") data = [incident];
    else if (config.url.includes("/review")) { incident = { ...incident, review: body.action === "approve" ? "approved" : "waived", reason: body.reason }; data = incident; }
    else data = {};
    return { status: 200, statusText: "OK", headers: {}, config, data: { success: true, data } };
};
createRoot(document.getElementById("root")).render(<main className="mx-auto max-w-4xl space-y-4 p-4 dark:bg-gray-950">
    <BoundaryPolicyNotice policy={{ ...settings, penaltiesEnabled: true }} />
    <BoundaryNotice rentalId="rental" />
    <BoundarySettings />
</main>);
