import { getStatistics } from "../api/statisticsApi";

export const fetchStatistics = async (
    period = "30d"
) => {
    return await getStatistics(period);
};
