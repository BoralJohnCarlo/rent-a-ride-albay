import mongoose from "mongoose";

const distanceFeeRuleSchema =
    new mongoose.Schema(
        {
            minDistanceKm: {
                type: Number,
                required: true,
                min: 0,
            },

            maxDistanceKm: {
                type: Number,
                required: true,
                min: 0,
            },

            pickupFee: {
                type: Number,
                required: true,
                min: 0,
                default: 0,
            },

            returnFee: {
                type: Number,
                required: true,
                min: 0,
                default: 0,
            },

            enabled: {
                type: Boolean,
                default: true,
            },
        },
        {
            timestamps: true,
        }
    );

distanceFeeRuleSchema.index(
    { enabled: 1, minDistanceKm: 1 }
);

const DistanceFeeRule = mongoose.model(
    "DistanceFeeRule",
    distanceFeeRuleSchema
);

export default DistanceFeeRule;
