import mongoose from "mongoose";

import {
    WITHDRAWAL_STATUS,
    WITHDRAWAL_STATUS_VALUES,
} from "../constants/withdrawalConstants.js";

const withdrawalRequestSchema = new mongoose.Schema(
    {
        withdrawalCode: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        currency: {
            type: String,
            default: "PHP",
            trim: true,
        },

        gcashNumber: {
            type: String,
            required: true,
            trim: true,
        },

        accountName: {
            type: String,
            required: true,
            trim: true,
        },

        status: {
            type: String,
            enum: WITHDRAWAL_STATUS_VALUES,
            default: WITHDRAWAL_STATUS.PENDING,
            index: true,
        },

        walletTransaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WalletTransaction",
            default: null,
        },

        xenditPayoutId: {
            type: String,
            default: "",
            trim: true,
            index: true,
        },

        failureReason: {
            type: String,
            default: "",
            trim: true,
        },

        completedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

withdrawalRequestSchema.index({
    operator: 1,
    createdAt: -1,
});

const WithdrawalRequest = mongoose.model(
    "WithdrawalRequest",
    withdrawalRequestSchema
);

export default WithdrawalRequest;
