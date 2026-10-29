import mongoose from "mongoose";

import {
    DISCOUNT_SCOPE,
    DISCOUNT_SCOPE_VALUES,
    DISCOUNT_METHOD_VALUES,
    DISCOUNT_STATUS,
    DISCOUNT_STATUS_VALUES,
    DISCOUNT_LABEL_MAX_LENGTH,
} from "../constants/discountConstants.js";

/*
 * An automatic discount on vehicles' daily rate (see discountService). Either
 * site-wide ("all_vehicles" - a holiday or summer sale) or for chosen
 * vehicles. startDate/endDate are Manila calendar days, inclusive, and are
 * when the booking is made, not the rental dates. Bookings keep a snapshot of
 * the discount they got, so editing or deleting one never re-prices them.
 */
const discountSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },

        // Badge text on vehicle cards, e.g. "Holiday Sale". Falls back to
        // the amount off when empty.
        label: {
            type: String,
            default: "",
            trim: true,
            maxlength: DISCOUNT_LABEL_MAX_LENGTH,
        },

        description: {
            type: String,
            default: "",
            trim: true,
        },

        scope: {
            type: String,
            enum: DISCOUNT_SCOPE_VALUES,
            default: DISCOUNT_SCOPE.ALL_VEHICLES,
        },

        vehicles: {
            type: [
                {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Vehicle",
                },
            ],
            default: [],
        },

        discountMethod: {
            type: String,
            enum: DISCOUNT_METHOD_VALUES,
            required: true,
        },

        // Percent off the daily rate, or pesos off per day.
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

        status: {
            type: String,
            enum: DISCOUNT_STATUS_VALUES,
            default: DISCOUNT_STATUS.ACTIVE,
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

discountSchema.index({
    status: 1,
    startDate: 1,
    endDate: 1,
});

const Discount = mongoose.model(
    "Discount",
    discountSchema
);

export default Discount;
