import api from "../lib/axios";

export const createConsignment = (data) =>
    api.post("/consignments", data);

export const updateDraftConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/draft`,
        data
    );

export const submitConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/submit`,
        data
    );

export const withdrawConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/withdraw`,
        data
    );

export const getConsignments = (
    params = {}
) =>
    api.get("/consignments", {
        params,
    });

export const getMyConsignments = (
    params = {}
) =>
    api.get("/consignments/my", {
        params,
    });

export const getConsignmentById = (
    consignmentId
) =>
    api.get(
        `/consignments/${consignmentId}`
    );

export const reviewConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/review`,
        data
    );

export const inspectConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/inspect`,
        data
    );

export const approveConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/approve`,
        data
    );

export const archiveConsignment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/archive`,
        data
    );

export const restoreConsignment = (
    consignmentId
) =>
    api.patch(
        `/consignments/${consignmentId}/restore`
    );

export const bookInspectionAppointment = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/inspection-appointment`,
        data
    );

export const requestReschedule = (
    consignmentId,
    data
) =>
    api.post(
        `/consignments/${consignmentId}/reschedule`,
        data
    );

export const approveReschedule = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/reschedule/approve`,
        data
    );

export const rejectReschedule = (
    consignmentId,
    data
) =>
    api.patch(
        `/consignments/${consignmentId}/reschedule/reject`,
        data
    );