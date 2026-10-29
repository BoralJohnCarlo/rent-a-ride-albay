import api from "../lib/axios";

export const getDistanceFeeRules = async () => {
    const { data } = await api.get(
        "/distance-fee-rules"
    );

    return data;
};

export const getDistanceFeeRuleById =
    async (ruleId) => {
        const { data } = await api.get(
            `/distance-fee-rules/${ruleId}`
        );

        return data;
    };

export const createDistanceFeeRule =
    async (ruleData) => {
        const { data } = await api.post(
            "/distance-fee-rules",
            ruleData
        );

        return data;
    };

export const updateDistanceFeeRule =
    async (ruleId, ruleData) => {
        const { data } = await api.put(
            `/distance-fee-rules/${ruleId}`,
            ruleData
        );

        return data;
    };

export const disableDistanceFeeRule =
    async (ruleId) => {
        const { data } = await api.patch(
            `/distance-fee-rules/${ruleId}/disable`
        );

        return data;
    };

export const enableDistanceFeeRule =
    async (ruleId) => {
        const { data } = await api.patch(
            `/distance-fee-rules/${ruleId}/enable`
        );

        return data;
    };

export const deleteDistanceFeeRule =
    async (ruleId) => {
        const { data } = await api.delete(
            `/distance-fee-rules/${ruleId}`
        );

        return data;
    };
