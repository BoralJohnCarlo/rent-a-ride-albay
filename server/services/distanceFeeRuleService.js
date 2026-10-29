import createError from "../utils/createError.js";

import DistanceFeeRule from "../models/DistanceFeeRule.js";

const findOverlappingEnabledRule =
    async (minDistanceKm, maxDistanceKm, excludeId = null) => {
        const query = {
            enabled: true,
            minDistanceKm: {
                $lt: maxDistanceKm,
            },
            maxDistanceKm: {
                $gt: minDistanceKm,
            },
        };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        return DistanceFeeRule.findOne(
            query
        ).lean();
    };

export const getAllDistanceFeeRules =
    async () => {
        return DistanceFeeRule.find()
            .sort({
                minDistanceKm: 1,
            })
            .lean();
    };

export const getDistanceFeeRuleById =
    async (ruleId) => {
        const rule =
            await DistanceFeeRule.findById(
                ruleId
            ).lean();

        if (!rule) {
            throw createError(
                "Distance fee rule not found.",
                404
            );
        }

        return rule;
    };

export const getEnabledDistanceFeeRules =
    async () => {
        return DistanceFeeRule.find({
            enabled: true,
        })
            .sort({
                minDistanceKm: 1,
            })
            .lean();
    };

export const createDistanceFeeRule =
    async (ruleData) => {
        const { minDistanceKm, maxDistanceKm } =
            ruleData;

        if (maxDistanceKm <= minDistanceKm) {
            throw createError(
                "Maximum distance must be greater than minimum distance.",
                400
            );
        }

        const overlappingRule =
            await findOverlappingEnabledRule(
                minDistanceKm,
                maxDistanceKm
            );

        if (overlappingRule) {
            throw createError(
                `Distance range overlaps with existing rule (${overlappingRule.minDistanceKm}–${overlappingRule.maxDistanceKm} km).`,
                409
            );
        }

        const rule =
            await DistanceFeeRule.create(
                ruleData
            );

        return rule.toObject();
    };

export const updateDistanceFeeRule =
    async (ruleId, ruleData) => {
        const rule =
            await DistanceFeeRule.findById(
                ruleId
            );

        if (!rule) {
            throw createError(
                "Distance fee rule not found.",
                404
            );
        }

        const minDistanceKm =
            ruleData.minDistanceKm ??
            rule.minDistanceKm;

        const maxDistanceKm =
            ruleData.maxDistanceKm ??
            rule.maxDistanceKm;

        if (maxDistanceKm <= minDistanceKm) {
            throw createError(
                "Maximum distance must be greater than minimum distance.",
                400
            );
        }

        const overlappingRule =
            await findOverlappingEnabledRule(
                minDistanceKm,
                maxDistanceKm,
                ruleId
            );

        if (overlappingRule) {
            throw createError(
                `Distance range overlaps with existing rule (${overlappingRule.minDistanceKm}–${overlappingRule.maxDistanceKm} km).`,
                409
            );
        }

        Object.assign(rule, ruleData);

        await rule.save();

        return rule.toObject();
    };

export const disableDistanceFeeRule =
    async (ruleId) => {
        const rule =
            await DistanceFeeRule.findById(
                ruleId
            );

        if (!rule) {
            throw createError(
                "Distance fee rule not found.",
                404
            );
        }

        rule.enabled = false;

        await rule.save();

        return rule.toObject();
    };

export const enableDistanceFeeRule =
    async (ruleId) => {
        const rule =
            await DistanceFeeRule.findById(
                ruleId
            );

        if (!rule) {
            throw createError(
                "Distance fee rule not found.",
                404
            );
        }

        const overlappingRule = await findOverlappingEnabledRule(
            rule.minDistanceKm, rule.maxDistanceKm, ruleId
        );
        if (overlappingRule) {
            throw createError("Distance range overlaps with an enabled rule.", 409);
        }

        rule.enabled = true;

        await rule.save();

        return rule.toObject();
    };

export const deleteDistanceFeeRule =
    async (ruleId) => {
        const rule =
            await DistanceFeeRule.findById(
                ruleId
            );

        if (!rule) {
            throw createError(
                "Distance fee rule not found.",
                404
            );
        }

        rule.enabled = false;

        await rule.save();

        return rule.toObject();
    };

export const getDistanceFeeRuleForDistance =
    async (distanceKm) => {
        if (
            distanceKm == null ||
            isNaN(distanceKm) ||
            distanceKm < 0
        ) {
            return null;
        }

        const rule =
            await DistanceFeeRule.findOne({
                enabled: true,
                $or: [
                    {
                        minDistanceKm: 0,
                        maxDistanceKm: {
                            $gte: distanceKm,
                        },
                    },
                    {
                        minDistanceKm: {
                            $lt: distanceKm,
                        },
                        maxDistanceKm: {
                            $gte: distanceKm,
                        },
                    },
                ],
            })
                .sort({
                    minDistanceKm: -1,
                })
                .lean();

        if (rule) {
            return rule;
        }

        /*
         * No bracket matched — this happens both when the distance is
         * truly beyond every configured bracket, and when it merely falls
         * in a gap between two enabled brackets that aren't contiguous
         * (nothing here enforces that brackets tile without gaps, only
         * that they don't overlap — see findOverlappingEnabledRule). Only
         * the "beyond every bracket" case should fall back to the
         * furthest bracket treated as open-ended; a gap should charge
         * nothing rather than silently billing the wrong (furthest)
         * bracket's fee for a distance that bracket was never meant to
         * cover.
         */
        const furthestRule =
            await DistanceFeeRule.findOne({
                enabled: true,
            })
                .sort({
                    maxDistanceKm: -1,
                })
                .lean();

        if (
            furthestRule &&
            distanceKm > furthestRule.maxDistanceKm
        ) {
            return furthestRule;
        }

        return null;
    };
