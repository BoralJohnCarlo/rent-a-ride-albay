import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    getRefunds,
    approveRefund,
    rejectRefund,
    settleRefund,
    clearRefundError,
    clearSelectedRefund,
    resetRefundState,
} from "../../store/refunds/refundSlice";

const useRefund = () => {
    const dispatch = useDispatch();

    const {
        refunds,
        pagination,
        summary,
        selectedRefund,
        loading,
        error,
    } = useSelector((state) => state.refunds);

    const fetchRefunds = useCallback(
        (filters = {}) => {
            return dispatch(getRefunds(filters));
        },
        [dispatch]
    );

    const approveExistingRefund = useCallback(
        (rentalId, refundId, amount) => {
            return dispatch(
                approveRefund({ rentalId, refundId, amount })
            );
        },
        [dispatch]
    );

    const rejectExistingRefund = useCallback(
        (rentalId, refundId, note = "") => {
            return dispatch(
                rejectRefund({ rentalId, refundId, note })
            );
        },
        [dispatch]
    );

    const settleExistingRefund = useCallback(
        (rentalId, refundId, { succeeded = true, notes = "" } = {}) => {
            return dispatch(
                settleRefund({ rentalId, refundId, succeeded, notes })
            );
        },
        [dispatch]
    );

    const clearError = () => {
        dispatch(clearRefundError());
    };

    const clearSelected = () => {
        dispatch(clearSelectedRefund());
    };

    const resetState = () => {
        dispatch(resetRefundState());
    };

    return {
        refunds,
        pagination,
        summary,
        selectedRefund,
        loading,
        error,

        fetchRefunds,
        approveExistingRefund,
        rejectExistingRefund,
        settleExistingRefund,

        clearError,
        clearSelected,
        resetState,
    };
};

export default useRefund;
