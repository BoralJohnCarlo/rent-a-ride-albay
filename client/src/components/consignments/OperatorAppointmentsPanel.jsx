import { useEffect, useState } from "react";
import { getMyPendingVehicles, getPendingVehicles, updateRegistrationAppointment } from "../../api/pendingVehicleApi";
import Button from "../common/Button";
import ConsignmentAppointmentsPanel from "./ConsignmentAppointmentsPanel";
import BookInspectionDialog from "./BookInspectionDialog";
import RescheduleReviewDialog from "./RescheduleReviewDialog";
import useToast from "../../hooks/toast/useToast";
import { bookInspectionAppointment } from "../../api/consignmentApi";

const OperatorAppointmentsPanel = ({ admin = false, ...props }) => {
    const toast = useToast();
    const [target, setTarget] = useState(null);
    const [review, setReview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [consignmentTarget, setConsignmentTarget] = useState(null);
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            try {
                const records = [];
                let page = 1;
                let pages = 1;
                do {
                    const result = await (admin ? getPendingVehicles : getMyPendingVehicles)({ page, limit: 20 });
                    if (cancelled) return;
                    records.push(...(result.data || []));
                    pages = result.pagination?.pages || 1;
                    page += 1;
                } while (page <= pages);
                setVehicles(records);
            } catch (error) {
                if (!cancelled) setError(error.response?.data?.message || "Unable to load registration inspection appointments.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [retry, admin]);
    const summary = target ? { _id: target._id, consignmentCode: "Registration inspection", snapshots: { vehicle: target }, application: { inspection: target.inspection }, reschedule: target.reschedule } : null;
    const close = () => { if (!saving) { setTarget(null); setReview(false); } };
    const submit = async (input) => {
        if (!target || saving) return;
        setSaving(true);
        try {
            await updateRegistrationAppointment(target._id, input);
            toast.success(input.action === "request" ? "Reschedule request sent. Your current appointment remains confirmed." : "Inspection appointment updated.");
            setTarget(null);
            setReview(false);
            setRetry(value => value + 1);
        } catch (error) { toast.error(error.response?.data?.message || "Unable to update the appointment."); }
        finally { setSaving(false); }
    };
    const submitConsignment = async input => {
        if (!consignmentTarget || saving) return;
        setSaving(true);
        try {
            await bookInspectionAppointment(consignmentTarget._id, input);
            toast.success("Inspection appointment updated.");
            setConsignmentTarget(null);
            await props.onRefresh?.();
        } catch (error) { toast.error(error.response?.data?.message || "Unable to update the appointment."); }
        finally { setSaving(false); }
    };
    return (
        <div className="space-y-4">
            {error && (
                <div role="alert" className="flex flex-col gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:bg-red-950/30 dark:text-red-400">
                    <p className="min-w-0 break-words">{error}</p>
                    <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)} className="w-full shrink-0 sm:w-auto">Retry registration appointments</Button>
                </div>
            )}
            <ConsignmentAppointmentsPanel {...props} registrationVehicles={vehicles} loading={props.loading || loading}
                onManage={admin ? setConsignmentTarget : props.onManage}
                onRegistrationManage={vehicle => { setTarget(vehicle); setReview(false); }}
                onRegistrationReview={admin ? vehicle => { setTarget(vehicle); setReview(true); } : undefined} />
            <BookInspectionDialog open={Boolean(target) && !review} consignment={summary} requestMode={!admin} loading={saving} onClose={close} onSubmit={input => submit({ ...input, action: admin ? "book" : "request" })} />
            <RescheduleReviewDialog open={Boolean(target) && review} consignment={summary} loading={saving} onClose={close} onApprove={remarks => submit({ action: "approve", remarks })} onReject={remarks => submit({ action: "reject", remarks })} />
            <BookInspectionDialog open={Boolean(consignmentTarget)} consignment={consignmentTarget} loading={saving} onClose={() => { if (!saving) setConsignmentTarget(null); }} onSubmit={submitConsignment} />
        </div>
    );
};

export default OperatorAppointmentsPanel;
