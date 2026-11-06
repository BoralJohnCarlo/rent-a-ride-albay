import { useCallback, useEffect, useState } from "react";
import { usePayouts } from "./usePayouts";

// Redux has display defaults; only expose settings after a successful fetch.
const useVerifiedPayoutSettings = () => {
    const { loadPayoutSettings } = usePayouts();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const retry = useCallback(async () => {
        setLoading(true);
        setError("");
        setSettings(null);
        try {
            const result = await loadPayoutSettings();
            if (result?.data?.platformCommissionRate == null) {
                throw new Error("Commission settings are unavailable.");
            }
            setSettings(result.data);
        } catch (error) {
            setError((typeof error === "string" ? error : error?.message) || "Unable to load commission settings.");
        } finally {
            setLoading(false);
        }
    }, [loadPayoutSettings]);
    useEffect(() => { retry(); }, [retry]);
    return { settings, loading, error, retry };
};

export default useVerifiedPayoutSettings;
