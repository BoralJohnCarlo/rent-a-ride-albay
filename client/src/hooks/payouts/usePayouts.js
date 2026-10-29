import { useDispatch, useSelector } from "react-redux";
import { useCallback } from "react";
import {
    fetchPayoutRequests,
    fetchPayoutRequestsByOperator,
    fetchOperatorPayoutSummary,
    fetchPayoutStats,
    fetchPayoutSettings,
    updatePayoutSettingsHandler,
    fetchPayoutRequestById,
    approvePayoutHandler,
    rejectPayoutHandler,
    markPayoutAsPaidHandler,
    cancelPayoutHandler,
    createPayoutRequestHandler,
    clearPayoutRequests,
    clearPayoutRequest,
} from "../../store/payouts";

export const usePayouts = () => {
    const dispatch = useDispatch();
    const {
        payoutRequests,
        payoutRequest,
        loading,
        success,
        error,
        pagination,
        summary,
        stats,
        settings
    } = useSelector((state) => state.payouts);

    const loadPayoutRequests = useCallback(
        (params = {}) =>
            dispatch(fetchPayoutRequests(params)).unwrap(),
        [dispatch]
    );

    const loadPayoutRequestsByOperator = useCallback(
        (params = {}) =>
            dispatch(
                fetchPayoutRequestsByOperator(params)
            ).unwrap(),
        [dispatch]
    );

    const loadOperatorPayoutSummary = useCallback(
        () =>
            dispatch(fetchOperatorPayoutSummary()).unwrap(),
        [dispatch]
    );

    const loadPayoutStats = useCallback(
        () => dispatch(fetchPayoutStats()).unwrap(),
        [dispatch]
    );

    const loadPayoutSettings = useCallback(
        () => dispatch(fetchPayoutSettings()).unwrap(),
        [dispatch]
    );

    const updatePayoutSettings = useCallback(
        (settingsData) =>
            dispatch(updatePayoutSettingsHandler(settingsData)),
        [dispatch]
    );

    const loadPayoutRequestById = useCallback(
        (id) =>
            dispatch(fetchPayoutRequestById(id)).unwrap(),
        [dispatch]
    );

    const approvePayout = useCallback(
        (id) =>
            dispatch(approvePayoutHandler(id)).unwrap(),
        [dispatch]
    );

    const rejectPayout = useCallback(
        ({ id, reason }) =>
            dispatch(
                rejectPayoutHandler({ id, reason })
            ).unwrap(),
        [dispatch]
    );

    const markPayoutAsPaid = useCallback(
        ({ id, paidVia }) =>
            dispatch(
                markPayoutAsPaidHandler({ id, paidVia })
            ).unwrap(),
        [dispatch]
    );

    const cancelPayout = useCallback(
        (id, reason = "") =>
            dispatch(
                cancelPayoutHandler({ id, reason })
            ).unwrap(),
        [dispatch]
    );

    const createPayoutRequest = useCallback(
        (payoutData) =>
            dispatch(
                createPayoutRequestHandler(payoutData)
            ).unwrap(),
        [dispatch]
    );

    const clearPayoutRequestsData = useCallback(() => {
        dispatch(clearPayoutRequests());
    }, [dispatch]);

    const clearPayoutRequestData = useCallback(() => {
        dispatch(clearPayoutRequest());
    }, [dispatch]);

    return {
        payoutRequests,
        payoutRequest,
        loading,
        success,
        error,
        pagination,
        summary,
        stats,
        settings,
        loadPayoutRequests,
        loadPayoutRequestsByOperator,
        loadOperatorPayoutSummary,
        loadPayoutStats,
        loadPayoutSettings,
        updatePayoutSettings,
        loadPayoutRequestById,
        approvePayout,
        rejectPayout,
        markPayoutAsPaid,
        cancelPayout,
        createPayoutRequest,
        clearPayoutRequestsData,
        clearPayoutRequestData,
    };
};
