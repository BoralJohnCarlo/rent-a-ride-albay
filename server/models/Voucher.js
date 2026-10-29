import mongoose from "mongoose";

import {
    VOUCHER_TYPE,
    VOUCHER_TYPE_VALUES,
    VOUCHER_DISCOUNT_METHOD,
    VOUCHER_DISCOUNT_METHOD_VALUES,
    VOUCHER_STATUS,
    VOUCHER_STATUS_VALUES,
    VOUCHER_ASSIGNMENT_TYPE,
    VOUCHER_ASSIGNMENT_TYPE_VALUES,
} from "../constants/voucherConstants.js";

const voucherSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            uppercase: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        type: {
            type: String,
            enum: VOUCHER_TYPE_VALUES,
            required: true,
            trim: true,
        },

        discountMethod: {
            type: String,
            enum: VOUCHER_DISCOUNT_METHOD_VALUES,
            required: true,
            trim: true,
        },

        discountValue: {
            type: Number,
            required: true,
            min: 0,
        },

        startDate: {
            type: Date,
            required: true,
        },

        endDate: {
            type: Date,
            required: true,
        },

        usageCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        maxUsagesPerUser: {
            type: Number,
            default: 1,
            min: 1,
        },

        status: {
            type: String,
            enum: VOUCHER_STATUS_VALUES,
            default: VOUCHER_STATUS.ACTIVE,
            trim: true,
        },

        assignmentType: {
            type: String,
            enum: VOUCHER_ASSIGNMENT_TYPE_VALUES,
            default: VOUCHER_ASSIGNMENT_TYPE.ALL_CUSTOMERS,
            trim: true,
        },

        assignedTo: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
            ],
            default: [],
        },

        usedBy: {
            type: [
                {
                    user: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "User",
                    },
                    booking: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Booking",
                    },
                    usedAt: {
                        type: Date,
                        default: Date.now,
                    },
                },
            ],
            default: [],
        },

        /*
         * Distinguishes vouchers an admin hand-created (marketing promos)
         * from ones the system issued automatically (e.g. an approved
         * early-return credit) so the admin Vouchers table can flag and
         * lock down the latter.
         */
        source: {
            type: String,
            enum: ["manual", "early_return"],
            default: "manual",
        },

        relatedRental: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Rental",
            default: null,
        },

        audit: {
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },

            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                default: null,
            },
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

voucherSchema.index({
    status: 1,
});

voucherSchema.index({
    startDate: 1,
    endDate: 1,
});

const Voucher = mongoose.model(
    "Voucher",
    voucherSchema
);

export default Voucher;
