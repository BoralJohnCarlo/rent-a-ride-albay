import mongoose from "mongoose";

import {
    WALLET_TRANSACTION_TYPE_VALUES,
    WALLET_TRANSACTION_STATUS,
    WALLET_TRANSACTION_STATUS_VALUES,
} from "../constants/walletConstants.js";

const walletTransactionSchema = new mongoose.Schema(
    {
        wallet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Wallet",
            required: true,
            index: true,
        },

        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        type: {
            type: String,
            enum: WALLET_TRANSACTION_TYPE_VALUES,
            required: true,
        },

        status: {
            type: String,
            enum: WALLET_TRANSACTION_STATUS_VALUES,
            default: WALLET_TRANSACTION_STATUS.COMPLETED,
        },

        amount: {
            type: Number,
            required: true,
            min: 0.01,
        },

        balanceAfter: {
            type: Number,
            required: true,
            min: 0,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        referenceModel: {
            type: String,
            default: "",
            trim: true,
        },

        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        failureReason: {
            type: String,
            default: "",
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

walletTransactionSchema.index({ wallet: 1, createdAt: -1 });

const WalletTransaction = mongoose.model(
    "WalletTransaction",
    walletTransactionSchema
);

export default WalletTransaction;
