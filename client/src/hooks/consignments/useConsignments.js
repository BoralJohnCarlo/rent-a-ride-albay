import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
    createConsignmentThunk,
    updateDraftConsignmentThunk,
    submitConsignmentThunk,
    withdrawConsignmentThunk,
    getConsignmentsThunk,
    getMyConsignmentsThunk,
    getConsignmentByIdThunk,
    reviewConsignmentThunk,
    inspectConsignmentThunk,
    approveConsignmentThunk,
    archiveConsignmentThunk,
    restoreConsignmentThunk,
    requestRescheduleThunk,
    approveRescheduleThunk,
    rejectRescheduleThunk,
    bookInspectionAppointmentThunk,
    clearConsignmentState,
    clearSelectedConsignment,
    getInspectionSettingThunk,
    updateInspectionSettingThunk,
} from "../../store/consignments/consignmentSlice";

const useConsignments = () => {
    const dispatch = useDispatch();

    const {
        consignments,
        selectedConsignment,
        loading,
        success,
        error,
    } = useSelector(
        (state) => state.consignments
    );

    const createConsignment = useCallback(
        (payload) =>
            dispatch(
                createConsignmentThunk(payload)
            ),
        [dispatch]
    );

    const updateDraftConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    updateDraftConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

    const submitConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    submitConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

    const withdrawConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    withdrawConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

    const getConsignments = useCallback(
        (params) =>
            dispatch(
                getConsignmentsThunk(params)
            ),
        [dispatch]
    );

    const getMyConsignments =
    useCallback(
        (params) =>
            dispatch(
                getMyConsignmentsThunk(
                    params
                )
            ),
        [dispatch]
    );

    const getConsignmentById =
        useCallback(
            (id) =>
                dispatch(
                    getConsignmentByIdThunk(id)
                ),
            [dispatch]
        );

    const reviewConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    reviewConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

    const inspectConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    inspectConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

    const approveConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    approveConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

    const archiveConsignment =
        useCallback(
            (payload) =>
                dispatch(
                    archiveConsignmentThunk(
                        payload
                    )
                ),
            [dispatch]
        );

const restoreConsignment =
    useCallback(
        (id) =>
            dispatch(
                restoreConsignmentThunk(id)
            ),
        [dispatch]
    );

    const requestReschedule =
    useCallback(
        ({ consignmentId, data }) =>
            dispatch(
                requestRescheduleThunk({ consignmentId, data })
            ),
        [dispatch]
    );

    const approveReschedule =
    useCallback(
        ({ consignmentId, data }) =>
            dispatch(
                approveRescheduleThunk({ consignmentId, data })
            ),
        [dispatch]
    );

    const rejectReschedule =
    useCallback(
        ({ consignmentId, data }) =>
            dispatch(
                rejectRescheduleThunk({ consignmentId, data })
            ),
        [dispatch]
    );

    const bookInspectionAppointment =
    useCallback(
        ({ consignmentId, data }) =>
            dispatch(
                bookInspectionAppointmentThunk({ consignmentId, data })
            ),
        [dispatch]
    );

    const fetchInspectionSetting =
        useCallback(
            () =>
                dispatch(
                    getInspectionSettingThunk()
                ),
        [dispatch]
    );

    const updateInspectionSetting =
        useCallback(
            (data) =>
                dispatch(
                    updateInspectionSettingThunk(data)
                ),
        [dispatch]
    );

    const clearState = useCallback(
        () =>
            dispatch(
                clearConsignmentState()
            ),
        [dispatch]
    );

    const clearSelected =
        useCallback(
            () =>
                dispatch(
                    clearSelectedConsignment()
                ),
            [dispatch]
        );

    return {
        consignments,
        selectedConsignment,
        loading,
        success,
        error,

        createConsignment,
        updateDraftConsignment,
        submitConsignment,
        withdrawConsignment,
        getConsignments,
        getMyConsignments,
        getConsignmentById,
        reviewConsignment,
        inspectConsignment,
        approveConsignment,
        archiveConsignment,
        restoreConsignment,
        requestReschedule,
        approveReschedule,
        rejectReschedule,
        bookInspectionAppointment,
        fetchInspectionSetting,
        updateInspectionSetting,

        clearState,
        clearSelected,
    };
};

export default useConsignments;