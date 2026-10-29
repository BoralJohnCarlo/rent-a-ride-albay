import useActivityCounts from "../../hooks/dashboard/useActivityCounts";

import DashboardDock from "./DashboardDock";

/*
 * The phone dock with live badge counts. The desktop sidebar fetches its
 * own; the layouts only ever mount one of the two, so they never both poll.
 */
const ActivityDock = ({ items }) => {
    const counts = useActivityCounts();

    return (
        <DashboardDock
            items={items}
            counts={counts}
        />
    );
};

export default ActivityDock;
