import { useCallback } from "react";

import {
    useDispatch,
    useSelector,
} from "react-redux";
import {
    getPayments,
    getPaymentById,
    createPayment,
    verifyPayment,
    cancelPayment,
    createCheckout,
    reconcilePayment as reconcilePaymentThunk,
    reconcileRefund as reconcileRefundThunk,
    sendRefund as sendRefundThunk,
    completeRefund as completeRefundThunk,
    clearPaymentError,
    clearSelectedPayment,
    resetPaymentState,
} from "../../store/payments";


const usePayment = () => {
    const dispatch = useDispatch();

    const {
        payments,
        selectedPayment,
        loading,
        error,
    } = useSelector(
        (state) => state.payments
    );


    const fetchPayments = useCallback(
    (filters = {}) => {
        return dispatch(
            getPayments(filters)
        );
    },
    [dispatch]
);

    const fetchPaymentById = useCallback(
    (paymentId) => {
        return dispatch(
            getPaymentById(paymentId)
        );
    },
    [dispatch]
);


    const addPayment = (
        bookingId,
        paymentMethod
    ) => {
        return dispatch(
            createPayment({
                bookingId,
                paymentMethod,
            })
        );
    };


    const verifyExistingPayment = (
        paymentId,
        force = false
    ) => {
        return dispatch(
            verifyPayment({
                paymentId,
                force,
            })
        );
    };


    const cancelExistingPayment = (
        paymentId
    ) => {
        return dispatch(
            cancelPayment(paymentId)
        );
    };


    const initiateCheckout = useCallback(
        (paymentId, force = false) => {
            return dispatch(
                createCheckout({
                    paymentId,
                    force,
                })
            );
        },
        [dispatch]
    );


    const reconcilePayment = useCallback(
        (paymentId) => {
            return dispatch(
                reconcilePaymentThunk(paymentId)
            );
        },
        [dispatch]
    );


    const reconcileRefund = useCallback(
        (paymentId) => {
            return dispatch(
                reconcileRefundThunk(paymentId)
            );
        },
        [dispatch]
    );


    const sendRefund = useCallback(
        (paymentId) => {
            return dispatch(
                sendRefundThunk(paymentId)
            );
        },
        [dispatch]
    );


    const completeRefund = useCallback(
        (paymentId, { succeeded = true, notes = "" } = {}) => {
            return dispatch(
                completeRefundThunk({
                    paymentId,
                    succeeded,
                    notes,
                })
            );
        },
        [dispatch]
    );


    const clearError = () => {
        dispatch(clearPaymentError());
    };


    const clearSelected = useCallback(() => {
        dispatch(clearSelectedPayment());
    }, [dispatch]);


    const resetState = () => {
        dispatch(resetPaymentState());
    };


    return {
        payments,
        selectedPayment,
        loading,
        error,

        fetchPayments,
        fetchPaymentById,
        addPayment,
        verifyExistingPayment,
        cancelExistingPayment,
        initiateCheckout,
        reconcilePayment,
        reconcileRefund,
        sendRefund,
        completeRefund,

        clearError,
        clearSelected,
        resetState,
    };
};


export default usePayment;
