import { useEffect, useState } from "react";
import api from "../../lib/axios";
import Button from "../common/Button";
import Input from "../common/Input";
import Switch from "../common/Switch";
import Select from "../common/Select";

const defaults = { alertsEnabled: true, penaltiesEnabled: false, warningDistanceKm: 2,
    gracePeriodMinutes: 15, penaltyAmount: 500, bufferMeters: 200, confirmationSeconds: 60 };
const fields = [
    ["warningDistanceKm", "Advance warning distance (km)", 0.5, 20, 0.5],
    ["gracePeriodMinutes", "Outside grace period (minutes)", 5, 1440, 1],
    ["penaltyAmount", "Penalty amount (PHP)", 0, 100000, 0.01],
    ["bufferMeters", "Border tolerance (meters)", 50, 1000, 10],
    ["confirmationSeconds", "Crossing confirmation (seconds)", 30, 600, 1],
];
const errorText = error => error.response?.data?.message || error.message || "Unable to complete this request.";

export default function BoundarySettings() {
    const [settings, setSettings] = useState(null);
    const [baseline, setBaseline] = useState(null);
    const [incidents, setIncidents] = useState([]);
    const [rentals, setRentals] = useState([]);
    const [attempt, setAttempt] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [reasons, setReasons] = useState({});
    const [reviewAmounts, setReviewAmounts] = useState({});
    const [exemption, setExemption] = useState({ rental: "", hours: 24, reason: "" });
    useEffect(() => {
        let active = true;
        setError("");
        Promise.all([api.get("/settings"), api.get("/boundary/incidents"), api.get("/rentals")]).then(([s, i, r]) => {
            if (!active) return;
            const value = { ...defaults, ...s.data.data.boundarySettings };
            setSettings(value); setBaseline(value); setIncidents(i.data.data);
            setRentals(r.data.data.filter(rental => rental.status === "Ongoing" && !rental.return?.date));
        }).catch(err => { if (active) setError(errorText(err)); });
        return () => { active = false; };
    }, [attempt]);
    const run = async task => {
        if (busy) return;
        setBusy(true); setError(""); setMessage("");
        try { await task(); }
        catch (err) { setError(errorText(err)); }
        finally { setBusy(false); }
    };
    const save = event => {
        event.preventDefault();
        run(async () => {
            const patch = Object.fromEntries(Object.entries(settings).filter(([key, value]) => key in defaults && value !== baseline[key]));
            if (!Object.keys(patch).length) { setMessage("No boundary settings changed."); return; }
            const response = await api.put("/settings", { boundarySettings: patch });
            const value = { ...defaults, ...response.data.data.boundarySettings };
            setSettings(value); setBaseline(value); setMessage("Boundary settings saved.");
            setIncidents((await api.get("/boundary/incidents")).data.data);
        });
    };
    const review = (incident, action) => run(async () => {
        await api.post(`/boundary/incidents/${incident._id}/review`, { action, reason: reasons[incident._id] || "",
            ...(action === "approve" ? { amount: Number(reviewAmounts[incident._id] ?? incident.amount) } : {}) });
        setIncidents((await api.get("/boundary/incidents")).data.data);
        setMessage(action === "approve" ? "Boundary charge added to the rental." : "Boundary penalty waived.");
    });
    return <section className="min-w-0 space-y-5 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-6">
        <div><h2 className="text-lg font-semibold text-gray-900 dark:text-white">Albay boundary alerts and penalties</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Warn customers before the border, confirm crossings, and allow time to return safely. Charges require admin review and apply at most once per rental.</p></div>
        {error && <p role="alert" className="break-words text-sm text-red-600 dark:text-red-400">{error}</p>}
        {message && <p role="status" className="text-sm text-green-700 dark:text-green-400">{message}</p>}
        {!settings ? <Button disabled={busy} onClick={() => setAttempt(value => value + 1)}>{error ? "Retry loading boundary settings" : "Loading boundary settings…"}</Button> : <form onSubmit={save}>
            <fieldset disabled={busy} className="min-w-0 space-y-5">
                <Switch id="boundary-alerts" label="Boundary alerts" checked={settings.alertsEnabled}
                    helperText="Turning this off stops boundary warnings, cancels pending countdowns and reviews, and disables boundary penalties. Existing approved charges remain."
                    onChange={event => setSettings(previous => ({ ...previous, alertsEnabled: event.target.checked, ...(!event.target.checked ? { penaltiesEnabled: false } : {}) }))} />
                <Switch id="boundary-penalties" label="Enable boundary penalties" checked={settings.penaltiesEnabled} disabled={!settings.alertsEnabled}
                    helperText="Off initially. Turning this off cancels pending penalty reviews and makes current excursions alerts-only, even if reenabled before reentry. GPS gaps do not count toward the grace period."
                    onChange={event => setSettings(previous => ({ ...previous, penaltiesEnabled: event.target.checked }))} />
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
                    {fields.map(([key, label, min, max, step]) => <Input key={key} id={`boundary-${key}`} label={label} type="number" required min={min} max={max} step={step}
                        value={settings[key]} onChange={event => setSettings(previous => ({ ...previous, [key]: event.target.value === "" ? "" : Number(event.target.value) }))} />)}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">The approximate administrative map includes coastal boundaries and islands. Border tolerance and human review help avoid false charges. Advance warning depends on fresh tracker reports; it cannot be guaranteed before a fast crossing.</p>
                <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save boundary settings"}</Button>
            </fieldset>
        </form>}
        <div className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Approve an outside-Albay trip</h3>
            <form onSubmit={event => { event.preventDefault(); run(async () => {
                await api.post(`/boundary/rentals/${exemption.rental}/exemption`, { until: new Date(Date.now() + Number(exemption.hours) * 3600000).toISOString(), reason: exemption.reason });
                setMessage("Outside trip approved. Pending boundary reviews for this rental were waived.");
                setAttempt(value => value + 1);
            }); }} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <Select label="Ongoing rental" value={exemption.rental} required disabled={busy} options={rentals.map(rental => ({ value: rental._id, label: rental.rentalCode }))}
                    onChange={event => setExemption(previous => ({ ...previous, rental: event.target.value }))} />
                <Input label="Approval duration (hours)" type="number" min={1} max={720} required value={exemption.hours} disabled={busy}
                    onChange={event => setExemption(previous => ({ ...previous, hours: event.target.value }))} />
                <Input label="Reason for approved trip" value={exemption.reason} required maxLength={500} disabled={busy}
                    onChange={event => setExemption(previous => ({ ...previous, reason: event.target.value }))} />
                <Button type="submit" disabled={busy || !exemption.rental}>Approve trip</Button>
                <Button type="button" disabled={busy || !exemption.rental || !exemption.reason.trim()} onClick={() => run(async () => {
                    await api.post(`/boundary/rentals/${exemption.rental}/exemption`, { revoke: true, reason: exemption.reason });
                    setMessage("Outside trip approval revoked. Fresh GPS evidence is required before a new penalty countdown.");
                    setAttempt(value => value + 1);
                })}>Revoke selected trip approval</Button>
            </form>
            {rentals.filter(rental => rental.boundaryExemption?.until && new Date(rental.boundaryExemption.until) > new Date()).map(rental => <p key={rental._id} className="break-words text-sm text-gray-600 dark:text-gray-400">
                {rental.rentalCode}: approved until {new Date(rental.boundaryExemption.until).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}. {rental.boundaryExemption.reason}
            </p>)}
        </div>
        <div className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">Recent boundary incidents</h3>
                <Button disabled={busy} onClick={() => run(async () => setIncidents((await api.get("/boundary/incidents")).data.data))}>Refresh incidents</Button></div>
            <p className="text-xs text-gray-500 dark:text-gray-400">All pending reviews appear first, followed by recent incidents.</p>
            {!incidents.length && <p className="text-sm text-gray-500 dark:text-gray-400">No boundary incidents recorded.</p>}
            {incidents.map(incident => <article key={incident._id} className="min-w-0 space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <p className="break-words font-medium text-gray-900 dark:text-white">{incident.vehicle?.plateNumber || "Vehicle"} · {incident.rental?.rentalCode || "No active rental"}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{incident.stage} · {incident.review === "none" ? "No penalty due" : incident.review} · {new Date(incident.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Confirmed grace-period evidence: {Math.floor(incident.evidenceMinutes)} minutes. {incident.outsideAt && `Proposed charge: PHP ${Number(incident.amount).toFixed(2)}.`}</p>
                {incident.reason && <p className="break-words text-sm text-gray-600 dark:text-gray-400">{incident.reason}</p>}
                {incident.review === "eligible" && <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Review the route history and customer warning before approving. Reentry resolves the alert but does not erase an eligible review.</p>
                    <Input label="Review reason" maxLength={500} disabled={busy} value={reasons[incident._id] || ""} onChange={event => setReasons(previous => ({ ...previous, [incident._id]: event.target.value }))} />
                    <Input label="Approved amount (PHP, may only reduce)" type="number" min={0.01} max={incident.amount} step={0.01} disabled={busy}
                        value={reviewAmounts[incident._id] ?? incident.amount} onChange={event => setReviewAmounts(previous => ({ ...previous, [incident._id]: event.target.value }))} />
                    <div className="flex flex-wrap gap-2"><Button disabled={busy || !reasons[incident._id]?.trim()} onClick={() => review(incident, "approve")}>Approve charge</Button>
                        <Button disabled={busy || !reasons[incident._id]?.trim()} onClick={() => review(incident, "waive")}>Waive</Button></div>
                </div>}
            </article>)}
        </div>
    </section>;
}
