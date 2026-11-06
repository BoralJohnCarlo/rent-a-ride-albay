import { useEffect, useState } from "react";
import { getMyPendingVehicles } from "../../api/pendingVehicleApi";
import Button from "../common/Button";
import ConsignmentAppointmentsPanel from "./ConsignmentAppointmentsPanel";

const OperatorAppointmentsPanel = (props) => {
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
                    const result = await getMyPendingVehicles({ page, limit: 20 });
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
    }, [retry]);
    return (
        <div className="space-y-4">
            {error && (
                <div role="alert" className="flex flex-col gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between dark:bg-red-950/30 dark:text-red-400">
                    <p className="min-w-0 break-words">{error}</p>
                    <Button size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)} className="w-full shrink-0 sm:w-auto">Retry registration appointments</Button>
                </div>
            )}
            <ConsignmentAppointmentsPanel {...props} registrationVehicles={vehicles} loading={props.loading || loading} />
        </div>
    );
};

export default OperatorAppointmentsPanel;
