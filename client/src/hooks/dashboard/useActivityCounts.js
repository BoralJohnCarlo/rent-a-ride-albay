import { useEffect, useState } from "react";

import { fetchActivityCounts } from "../../services/dashboardService";

const POLL_INTERVAL = 30_000;

/*
 * Powers the sidebar's per-icon activity badges (admin + operator). Polls
 * the same way NotificationBell.jsx polls unread notifications - fetch on
 * mount, then every 30s - and fails quiet on error since a stale/missing
 * badge count is never worth surfacing to the user.
 */
const useActivityCounts = () => {
    const [counts, setCounts] = useState({});

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                const response = await fetchActivityCounts();

                if (!cancelled) {
                    setCounts(response?.data || {});
                }
            } catch {
                // silent - badges just stay at their last known counts
            }
        };

        load();
        const id = setInterval(load, POLL_INTERVAL);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, []);

    return counts;
};

export default useActivityCounts;
