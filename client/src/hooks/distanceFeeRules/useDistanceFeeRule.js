import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    getDistanceFeeRules,
    getDistanceFeeRuleById,
    createDistanceFeeRule,
    updateDistanceFeeRule,
    disableDistanceFeeRule,
    enableDistanceFeeRule,
    deleteDistanceFeeRule,
    clearDistanceFeeRuleError,
    clearSelectedDistanceFeeRule,
} from "../../store/distanceFeeRules";


const useDistanceFeeRule = () => {
    const dispatch = useDispatch();

    const {
        distanceFeeRules,
        selectedDistanceFeeRule,
        loading,
        error,
    } = useSelector(
        (state) => state.distanceFeeRules
    );

    const fetchDistanceFeeRules =
        useCallback(
            () =>
                dispatch(
                    getDistanceFeeRules()
                ),
            [dispatch]
        );

    const fetchDistanceFeeRuleById =
        useCallback(
            (ruleId) =>
                dispatch(
                    getDistanceFeeRuleById(
                        ruleId
                    )
                ),
            [dispatch]
        );

    const createDistanceFeeRuleAction =
        useCallback(
            (ruleData) =>
                dispatch(
                    createDistanceFeeRule(
                        ruleData
                    )
                ),
            [dispatch]
        );

    const updateDistanceFeeRuleAction =
        useCallback(
            ({ ruleId, ruleData }) =>
                dispatch(
                    updateDistanceFeeRule({
                        ruleId,
                        ruleData,
                    })
                ),
            [dispatch]
        );

    const disableDistanceFeeRuleAction =
        useCallback(
            (ruleId) =>
                dispatch(
                    disableDistanceFeeRule(
                        ruleId
                    )
                ),
            [dispatch]
        );

    const enableDistanceFeeRuleAction =
        useCallback(
            (ruleId) =>
                dispatch(
                    enableDistanceFeeRule(
                        ruleId
                    )
                ),
            [dispatch]
        );

    const deleteDistanceFeeRuleAction =
        useCallback(
            (ruleId) =>
                dispatch(
                    deleteDistanceFeeRule(
                        ruleId
                    )
                ),
            [dispatch]
        );

    const clearErrorAction =
        useCallback(
            () =>
                dispatch(
                    clearDistanceFeeRuleError()
                ),
            [dispatch]
        );

    const clearSelectedAction =
        useCallback(
            () =>
                dispatch(
                    clearSelectedDistanceFeeRule()
                ),
            [dispatch]
        );

    return {
        distanceFeeRules,
        selectedDistanceFeeRule,
        loading,
        error,

        getDistanceFeeRules:
            fetchDistanceFeeRules,
        getDistanceFeeRuleById:
            fetchDistanceFeeRuleById,
        createDistanceFeeRule:
            createDistanceFeeRuleAction,
        updateDistanceFeeRule:
            updateDistanceFeeRuleAction,
        disableDistanceFeeRule:
            disableDistanceFeeRuleAction,
        enableDistanceFeeRule:
            enableDistanceFeeRuleAction,
        deleteDistanceFeeRule:
            deleteDistanceFeeRuleAction,
        clearError: clearErrorAction,
        clearSelectedDistanceFeeRule:
            clearSelectedAction,
    };
};

export default useDistanceFeeRule;
