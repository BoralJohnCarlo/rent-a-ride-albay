import {
    getDistanceFeeRules,
    getDistanceFeeRuleById,
    createDistanceFeeRule,
    updateDistanceFeeRule,
    disableDistanceFeeRule,
    enableDistanceFeeRule,
    deleteDistanceFeeRule,
} from "../api/distanceFeeRuleApi";


export const fetchDistanceFeeRules =
    async () => {
        return await getDistanceFeeRules();
    };


export const fetchDistanceFeeRuleById =
    async (ruleId) => {
        return await getDistanceFeeRuleById(
            ruleId
        );
    };


export const createNewDistanceFeeRule =
    async (ruleData) => {
        return await createDistanceFeeRule(
            ruleData
        );
    };


export const updateExistingDistanceFeeRule =
    async (ruleId, ruleData) => {
        return await updateDistanceFeeRule(
            ruleId,
            ruleData
        );
    };


export const disableDistanceFeeRuleAction =
    async (ruleId) => {
        return await disableDistanceFeeRule(
            ruleId
        );
    };


export const enableDistanceFeeRuleAction =
    async (ruleId) => {
        return await enableDistanceFeeRule(
            ruleId
        );
    };


export const deleteDistanceFeeRuleAction =
    async (ruleId) => {
        return await deleteDistanceFeeRule(
            ruleId
        );
    };
