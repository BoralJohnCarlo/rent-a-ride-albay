import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import {
    fetchSettings,
    updateSettingsAction,
} from "../../services/settingsService";

import { DEFAULT_CANCELLATION_POLICY } from "../../utils/cancellationPolicy";
import { queueSettingsRequest } from "../../utils/settingsRequestQueue";

const initialState = {
    settings: {
        allowOnlyDefaultLocation: false,
        enableDistanceFeeCalculation: false,
        penaltySettings: {
            gracePeriodMinutes: 0,
            chargingUnit: "Hour",
            rateType: "derived",
            customRate: 0,
            rateMultiplier: 1,
            maximumCap: 0,
            autoApply: true,
        },
        refundSettings: {
            gracePeriodHours: 24,
            autoApproveRefundThreshold: 500,
            requireCancellationReason: true,
            cancellationPolicy: DEFAULT_CANCELLATION_POLICY,
        },
        validIdRenewalSettings: {
            maxUploadsPerYear: 1,
            renewalPeriodYears: 1,
        },
        driverAssignmentSettings: {
            requireAdminDriverAssignment: false,
            motorcycleDriversEnabled: true,
        },
    },
    loading: false,
    pendingRequests: 0,
    error: null,
};

export const getSettings = createAsyncThunk(
    "settings/getSettings",
    async (_, { rejectWithValue }) => {
        try {
            return await queueSettingsRequest(() => fetchSettings());
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.message ||
                    "Unable to fetch settings."
            );
        }
    }
);

export const updateSettings = createAsyncThunk(
    "settings/updateSettings",
    async (settingsData, { rejectWithValue }) => {
        try {
            return await queueSettingsRequest(() => updateSettingsAction(settingsData));
        } catch (error) {
            return rejectWithValue(
                error.response?.data?.errors?.[0]?.msg ||
                error.response?.data?.message ||
                    "Unable to update settings."
            );
        }
    }
);

const settingsSlice = createSlice({
    name: "settings",
    initialState,
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getSettings.pending, (state) => {
                state.pendingRequests += 1;
                state.loading = true;
                state.error = null;
            })
            .addCase(getSettings.fulfilled, (state, action) => {
                state.pendingRequests -= 1;
                state.loading = state.pendingRequests > 0;
                state.settings =
                    action.payload?.data || state.settings;
            })
            .addCase(getSettings.rejected, (state, action) => {
                state.pendingRequests -= 1;
                state.loading = state.pendingRequests > 0;
                state.error = action.payload;
            })
            .addCase(updateSettings.pending, (state) => {
                state.pendingRequests += 1;
                state.loading = true;
                state.error = null;
            })
            .addCase(updateSettings.fulfilled, (state, action) => {
                state.pendingRequests -= 1;
                state.loading = state.pendingRequests > 0;
                state.settings =
                    action.payload?.data || state.settings;
            })
            .addCase(updateSettings.rejected, (state, action) => {
                state.pendingRequests -= 1;
                state.loading = state.pendingRequests > 0;
                state.error = action.payload;
            });
    },
});

export const { clearError } = settingsSlice.actions;

export default settingsSlice.reducer;
