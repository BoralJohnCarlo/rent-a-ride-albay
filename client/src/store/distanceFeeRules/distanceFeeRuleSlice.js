import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchDistanceFeeRules,
    fetchDistanceFeeRuleById,
    createNewDistanceFeeRule,
    updateExistingDistanceFeeRule,
    disableDistanceFeeRuleAction,
    enableDistanceFeeRuleAction,
    deleteDistanceFeeRuleAction,
} from "../../services/distanceFeeRuleService";


const initialState = {
    distanceFeeRules: [],

    selectedDistanceFeeRule: null,

    loading: false,

    error: null,
};


export const getDistanceFeeRules =
    createAsyncThunk(
        "distanceFeeRule/getDistanceFeeRules",
        async (_, { rejectWithValue }) => {
            try {
                return await fetchDistanceFeeRules();
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch distance fee rules."
                );
            }
        }
    );


export const getDistanceFeeRuleById =
    createAsyncThunk(
        "distanceFeeRule/getDistanceFeeRuleById",
        async (ruleId, { rejectWithValue }) => {
            try {
                return await fetchDistanceFeeRuleById(
                    ruleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to fetch distance fee rule."
                );
            }
        }
    );


export const createDistanceFeeRule =
    createAsyncThunk(
        "distanceFeeRule/createDistanceFeeRule",
        async (ruleData, { rejectWithValue }) => {
            try {
                return await createNewDistanceFeeRule(
                    ruleData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to create distance fee rule."
                );
            }
        }
    );


export const updateDistanceFeeRule =
    createAsyncThunk(
        "distanceFeeRule/updateDistanceFeeRule",
        async (
            { ruleId, ruleData },
            { rejectWithValue }
        ) => {
            try {
                return await updateExistingDistanceFeeRule(
                    ruleId,
                    ruleData
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to update distance fee rule."
                );
            }
        }
    );


export const disableDistanceFeeRule =
    createAsyncThunk(
        "distanceFeeRule/disableDistanceFeeRule",
        async (ruleId, { rejectWithValue }) => {
            try {
                return await disableDistanceFeeRuleAction(
                    ruleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to disable distance fee rule."
                );
            }
        }
    );


export const enableDistanceFeeRule =
    createAsyncThunk(
        "distanceFeeRule/enableDistanceFeeRule",
        async (ruleId, { rejectWithValue }) => {
            try {
                return await enableDistanceFeeRuleAction(
                    ruleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to enable distance fee rule."
                );
            }
        }
    );


export const deleteDistanceFeeRule =
    createAsyncThunk(
        "distanceFeeRule/deleteDistanceFeeRule",
        async (ruleId, { rejectWithValue }) => {
            try {
                return await deleteDistanceFeeRuleAction(
                    ruleId
                );
            } catch (error) {
                return rejectWithValue(
                    error.response?.data?.message ||
                        "Unable to delete distance fee rule."
                );
            }
        }
    );


export const clearDistanceFeeRuleError =
    createAsyncThunk(
        "distanceFeeRule/clearDistanceFeeRuleError",
        async (_, { rejectWithValue }) => {
            return rejectWithValue(null);
        }
    );


const distanceFeeRuleSlice =
    createSlice({
        name: "distanceFeeRule",
        initialState,
        reducers: {
            clearError: (state) => {
                state.error = null;
            },

            clearSelectedDistanceFeeRule:
                (state) => {
                    state.selectedDistanceFeeRule =
                        null;
                },
        },
        extraReducers: (builder) => {
            builder
                .addCase(
                    getDistanceFeeRules.pending,
                    (state) => {
                        state.loading = true;
                        state.error = null;
                    }
                )
                .addCase(
                    getDistanceFeeRules.fulfilled,
                    (state, action) => {
                        state.loading = false;
                        state.distanceFeeRules =
                            action.payload?.data ||
                            [];
                    }
                )
                .addCase(
                    getDistanceFeeRules.rejected,
                    (state, action) => {
                        state.loading = false;
                        state.error =
                            action.payload;
                    }
                )

                .addCase(
                    getDistanceFeeRuleById.fulfilled,
                    (state, action) => {
                        state.selectedDistanceFeeRule =
                            action.payload?.data ||
                            null;
                    }
                )

                .addCase(
                    createDistanceFeeRule.fulfilled,
                    (state, action) => {
                        state.distanceFeeRules.push(
                            action.payload?.data ||
                                {}
                        );
                    }
                )

                .addCase(
                    updateDistanceFeeRule.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.distanceFeeRules.findIndex(
                                    (rule) =>
                                        rule._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.distanceFeeRules[
                                    index
                                ] = updated;
                            }
                        }
                    }
                )

                .addCase(
                    disableDistanceFeeRule.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.distanceFeeRules.findIndex(
                                    (rule) =>
                                        rule._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.distanceFeeRules[
                                    index
                                ] = updated;
                            }
                        }
                    }
                )

                .addCase(
                    enableDistanceFeeRule.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.distanceFeeRules.findIndex(
                                    (rule) =>
                                        rule._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.distanceFeeRules[
                                    index
                                ] = updated;
                            }
                        }
                    }
                )

                .addCase(
                    deleteDistanceFeeRule.fulfilled,
                    (state, action) => {
                        const updated =
                            action.payload?.data;

                        if (updated?._id) {
                            const index =
                                state.distanceFeeRules.findIndex(
                                    (rule) =>
                                        rule._id ===
                                        updated._id
                                );

                            if (
                                index !==
                                -1
                            ) {
                                state.distanceFeeRules[
                                    index
                                ] = updated;
                            }
                        }
                    }
                );
        },
    });


export const {
    clearError,
    clearSelectedDistanceFeeRule,
} = distanceFeeRuleSlice.actions;

export default distanceFeeRuleSlice.reducer;
