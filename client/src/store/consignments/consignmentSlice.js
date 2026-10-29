import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import {
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
} from "../../api/consignmentApi";
import {
    getInspectionSetting,
    updateInspectionSetting,
} from "../../api/inspectionSettingApi";

export const createConsignmentThunk =
    createAsyncThunk(
        "consignments/create",
        async (payload, thunkAPI) => {
            try {
                const { data } =
                    await createConsignment(payload);

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const updateDraftConsignmentThunk =
    createAsyncThunk(
        "consignments/updateDraft",
        async (
            { id, payload },
            thunkAPI
        ) => {
            try {
                const { data } =
                    await updateDraftConsignment(
                        id,
                        payload
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const submitConsignmentThunk =
    createAsyncThunk(
        "consignments/submit",
        async (arg, thunkAPI) => {
            try {
                /*
                 * Accepts either a bare consignment ID (existing callers
                 * that don't need to send anything, e.g. submitting an
                 * already-complete draft straight from the list) or
                 * { id, data } when there's a body to send (e.g. the New
                 * Consignment wizard's Terms & Agreement step).
                 */
                const { id, data: body } =
                    typeof arg === "string"
                        ? { id: arg, data: undefined }
                        : arg;

                const { data } =
                    await submitConsignment(
                        id,
                        body
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const withdrawConsignmentThunk =
    createAsyncThunk(
        "consignments/withdraw",
        async (
            { id, payload },
            thunkAPI
        ) => {
            try {
                const { data } =
                    await withdrawConsignment(
                        id,
                        payload
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const getConsignmentsThunk =
    createAsyncThunk(
        "consignments/getAll",
        async (
            params = {},
            thunkAPI
        ) => {
            try {
                const { data } =
                    await getConsignments(
                        params
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const getMyConsignmentsThunk =
    createAsyncThunk(
        "consignments/getMine",
        async (
            params = {},
            thunkAPI
        ) => {
            try {
                const { data } =
                    await getMyConsignments(
                        params
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const getConsignmentByIdThunk =
    createAsyncThunk(
        "consignments/getById",
        async (id, thunkAPI) => {
            try {
                const { data } =
                    await getConsignmentById(id);

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const reviewConsignmentThunk =
    createAsyncThunk(
        "consignments/review",
        async (
            { id, payload },
            thunkAPI
        ) => {
            try {
                const { data } =
                    await reviewConsignment(
                        id,
                        payload
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const inspectConsignmentThunk =
    createAsyncThunk(
        "consignments/inspect",
        async (
            { id, payload },
            thunkAPI
        ) => {
            try {
                const { data } =
                    await inspectConsignment(
                        id,
                        payload
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const approveConsignmentThunk =
    createAsyncThunk(
        "consignments/approve",
        async (
            { id, payload },
            thunkAPI
        ) => {
            try {
                const { data } =
                    await approveConsignment(
                        id,
                        payload
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const archiveConsignmentThunk =
    createAsyncThunk(
        "consignments/archive",
        async (
            { id, payload },
            thunkAPI
        ) => {
            try {
                const { data } =
                    await archiveConsignment(
                        id,
                        payload
                    );

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const restoreConsignmentThunk =
    createAsyncThunk(
        "consignments/restore",
        async (id, thunkAPI) => {
            try {
                const { data } =
                    await restoreConsignment(id);

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const requestRescheduleThunk =
    createAsyncThunk(
        "consignments/requestReschedule",
        async ({ consignmentId, data }, thunkAPI) => {
            try {
                const { data: responseBody } =
                    await requestReschedule(consignmentId, data);

                return responseBody;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const approveRescheduleThunk =
    createAsyncThunk(
        "consignments/approveReschedule",
        async ({ consignmentId, data }, thunkAPI) => {
            try {
                const { data: responseBody } =
                    await approveReschedule(consignmentId, data);

                return responseBody;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const rejectRescheduleThunk =
    createAsyncThunk(
        "consignments/rejectReschedule",
        async ({ consignmentId, data }, thunkAPI) => {
            try {
                const { data: responseBody } =
                    await rejectReschedule(consignmentId, data);

                return responseBody;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const bookInspectionAppointmentThunk =
    createAsyncThunk(
        "consignments/bookInspectionAppointment",
        async ({ consignmentId, data }, thunkAPI) => {
            try {
                const { data: responseBody } =
                    await bookInspectionAppointment(consignmentId, data);

                return responseBody;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const getInspectionSettingThunk =
    createAsyncThunk(
        "consignments/getInspectionSetting",
        async (_, thunkAPI) => {
            try {
                const { data } =
                    await getInspectionSetting();

                return data;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

export const updateInspectionSettingThunk =
    createAsyncThunk(
        "consignments/updateInspectionSetting",
        async (data, thunkAPI) => {
            try {
                const { data: responseData } =
                    await updateInspectionSetting(data);

                return responseData;
            } catch (error) {
                return thunkAPI.rejectWithValue(
                    error.response?.data ||
                        error.message
                );
            }
        }
    );

const initialState = {
    consignments: [],
    selectedConsignment: null,
    loading: false,
    success: false,
    error: null,
    inspectionSetting: {
        inspectionSlots: [],
        disabledDates: [],
    },
    inspectionSettingLoading: false,
    inspectionSettingSuccess: false,
    inspectionSettingError: null,
};

const updateConsignmentInState = (
    state,
    updatedConsignment
) => {
    state.selectedConsignment =
        updatedConsignment;

    const index =
        state.consignments.findIndex(
            (consignment) =>
                consignment._id ===
                updatedConsignment._id
        );

    if (index !== -1) {
        state.consignments[index] =
            updatedConsignment;
    }
};

const consignmentSlice = createSlice({
    name: "consignments",
    initialState,

    reducers: {
        clearConsignmentState: (
            state
        ) => {
            state.loading = false;
            state.success = false;
            state.error = null;
        },

        clearSelectedConsignment:
            (state) => {
                state.selectedConsignment =
                    null;
            },
    },

    extraReducers: (builder) => {
        const pending = (state) => {
            state.loading = true;
            state.error = null;
            state.success = false;
        };

        const rejected = (
            state,
            action
        ) => {
            state.loading = false;
            state.success = false;
            state.error = action.payload;
        };

        builder

            .addCase(
                createConsignmentThunk.pending,
                pending
            )
            .addCase(
                createConsignmentThunk.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.success = true;

                    state.consignments.unshift(
                        action.payload.data
                    );

                    state.selectedConsignment =
                        action.payload.data;
                }
            )
            .addCase(
                createConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                getConsignmentsThunk.pending,
                pending
            )
            .addCase(
                getConsignmentsThunk.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.success = true;

                    state.consignments =
                        action.payload.data;
                }
            )
            .addCase(
                getConsignmentsThunk.rejected,
                rejected
            )

            .addCase(
                getMyConsignmentsThunk.pending,
                pending
            )
            .addCase(
                getMyConsignmentsThunk.fulfilled,
                    (state, action) => {
                    state.loading = false;
                    state.success = true;

                    state.consignments =
                    action.payload.data;
                }
            )
            .addCase(
                getMyConsignmentsThunk.rejected,
                rejected
            )
            .addCase(
                getConsignmentByIdThunk.pending,
                pending
            )
            .addCase(
                getConsignmentByIdThunk.fulfilled,
                (
                    state,
                    action
                ) => {
                    state.loading = false;
                    state.success = true;

                    state.selectedConsignment =
                        action.payload.data;
                }
            )
            .addCase(
                getConsignmentByIdThunk.rejected,
                rejected
            )
                        .addCase(
                updateDraftConsignmentThunk.pending,
                pending
            )
            .addCase(
                updateDraftConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                updateDraftConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                submitConsignmentThunk.pending,
                pending
            )
            .addCase(
                submitConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                submitConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                withdrawConsignmentThunk.pending,
                pending
            )
            .addCase(
                withdrawConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                withdrawConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                reviewConsignmentThunk.pending,
                pending
            )
            .addCase(
                reviewConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                reviewConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                inspectConsignmentThunk.pending,
                pending
            )
            .addCase(
                inspectConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                inspectConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                approveConsignmentThunk.pending,
                pending
            )
            .addCase(
                approveConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                approveConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                archiveConsignmentThunk.pending,
                pending
            )
            .addCase(
                archiveConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                archiveConsignmentThunk.rejected,
                rejected
            )

            .addCase(
                restoreConsignmentThunk.pending,
                pending
            )
            .addCase(
                restoreConsignmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                restoreConsignmentThunk.rejected,
                rejected
            )
            .addCase(
                requestRescheduleThunk.pending,
                pending
            )
            .addCase(
                requestRescheduleThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                requestRescheduleThunk.rejected,
                rejected
            )
            .addCase(
                approveRescheduleThunk.pending,
                pending
            )
            .addCase(
                approveRescheduleThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                approveRescheduleThunk.rejected,
                rejected
            )
            .addCase(
                rejectRescheduleThunk.pending,
                pending
            )
            .addCase(
                rejectRescheduleThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                rejectRescheduleThunk.rejected,
                rejected
            )
            .addCase(
                bookInspectionAppointmentThunk.pending,
                pending
            )
            .addCase(
                bookInspectionAppointmentThunk.fulfilled,
                (state, action) => {
                    state.loading = false;
                    state.success = true;

                    updateConsignmentInState(
                        state,
                        action.payload.data
                    );
                }
            )
            .addCase(
                bookInspectionAppointmentThunk.rejected,
                rejected
            )
            .addCase(
                getInspectionSettingThunk.pending,
                (state) => {
                    state.inspectionSettingLoading = true;
                    state.inspectionSettingError = null;
                }
            )
            .addCase(
                getInspectionSettingThunk.fulfilled,
                (state, action) => {
                    state.inspectionSettingLoading = false;
                    state.inspectionSettingSuccess = true;
                    state.inspectionSetting =
                        action.payload.data;
                }
            )
            .addCase(
                getInspectionSettingThunk.rejected,
                (state, action) => {
                    state.inspectionSettingLoading = false;
                    state.inspectionSettingError =
                        action.payload;
                }
            )
            .addCase(
                updateInspectionSettingThunk.pending,
                (state) => {
                    state.inspectionSettingLoading = true;
                    state.inspectionSettingError = null;
                }
            )
            .addCase(
                updateInspectionSettingThunk.fulfilled,
                (state, action) => {
                    state.inspectionSettingLoading = false;
                    state.inspectionSettingSuccess = true;
                    state.inspectionSetting =
                        action.payload.data;
                }
            )
            .addCase(
                updateInspectionSettingThunk.rejected,
                (state, action) => {
                    state.inspectionSettingLoading = false;
                    state.inspectionSettingError =
                        action.payload;
                }
            );
    },
});

export const {
    clearConsignmentState,
    clearSelectedConsignment,
} = consignmentSlice.actions;

export default consignmentSlice.reducer;