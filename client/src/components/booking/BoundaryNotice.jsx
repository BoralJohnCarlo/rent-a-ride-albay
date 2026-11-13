import { useEffect, useState } from "react";
import api from "../../lib/axios";

const describeBoundaryPolicy = policy => !policy?.alertsEnabled ? "Boundary alerts and penalties are disabled." :
    `Please keep the vehicle within Albay unless an outside trip has been approved. We will warn you near the border when fresh GPS reports are available. ${policy.penaltiesEnabled
        ? `After a confirmed crossing, you have ${policy.gracePeriodMinutes} minutes of confirmed outside travel to return safely before a PHP ${Number(policy.penaltyAmount).toFixed(2)} penalty becomes eligible for admin review, at most once per rental. Missing GPS time is not counted. The charge is not automatic.`
        : "Boundary penalties are currently disabled."}`;

export function BoundaryPolicyNotice({ policy }) {
    if (!policy?.alertsEnabled) return null;
    return <aside className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
        <h3 className="font-semibold">Albay travel boundary</h3><p className="mt-1">{describeBoundaryPolicy(policy)}</p>
    </aside>;
}

export default function BoundaryNotice({ rentalId }) {
    const [incidents, setIncidents] = useState([]);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!rentalId) return;
        let active = true, pending = false;
        const refresh = async () => {
            if (pending) return;
            pending = true;
            try {
                const response = await api.get("/boundary/current", { timeout: 15000 });
                if (active) { setIncidents(response.data.data.filter(incident => String(incident.rental) === String(rentalId))); setFailed(false); }
            } catch { if (active) setFailed(true); }
            finally { pending = false; }
        };
        refresh();
        const timer = setInterval(refresh, 15000);
        return () => { active = false; clearInterval(timer); };
    }, [rentalId]);
    if (!rentalId || (!incidents.length && !failed)) return null;
    return <aside aria-live="polite" className="my-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="font-semibold">Albay boundary status</h2>
        {failed && <p>Boundary status could not be refreshed. The last status may be outdated; check your notifications and stay within Albay.</p>}
        {incidents.map(incident => <p key={incident.id}>
            {!incident.locationKnown ? "Current GPS location is unknown. The penalty evidence clock is paused. " : ""}
            {incident.stage === "near" ? "You are approaching the Albay boundary. Please remain inside Albay." :
                incident.review === "eligible" ? "The grace period has been exceeded. A proposed boundary penalty requires admin review." :
                    incident.review === "approved" ? "A boundary penalty has been approved. Check your rental charges." :
                        incident.review === "waived" ? "The proposed penalty for this incident was waived. Please return safely." :
                        `The vehicle was confirmed outside Albay. Please return safely. ${incident.penaltiesEnabled ? `${Math.ceil(incident.remainingMinutes)} minutes of confirmed outside travel remain before a penalty review.` : "No boundary penalty countdown applies."}`}
        </p>)}
    </aside>;
}
