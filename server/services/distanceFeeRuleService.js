import createError from "../utils/createError.js";

import DistanceFeeRule from "../models/DistanceFeeRule.js";
import { withBookingCreationTransaction } from "./bookingCreationTransaction.js";

const RULE_RESOURCE = "distance-fee-rules";

const resolveDistanceRange = (data) => {
    const minDistanceKm = Number(data.minDistanceKm);
    const maxDistanceKm = Number(data.maxDistanceKm);
    if (!Number.isFinite(minDistanceKm) || !Number.isFinite(maxDistanceKm) ||
        minDistanceKm < 0 || maxDistanceKm <= minDistanceKm) {
        throw createError("Maximum distance must be greater than minimum distance, and both must be finite non-negative numbers.", 400);
    }
    return { minDistanceKm, maxDistanceKm };
};

const findOverlappingEnabledRule =
    async (minDistanceKm, maxDistanceKm, excludeId = null, session = null) => {
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
        ).session(session).lean();
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

export const createDistanceFeeRule = async (ruleData) =>
    withBookingCreationTransaction([RULE_RESOURCE], async (session) => {
        const range = resolveDistanceRange(ruleData);
        if (ruleData.enabled !== false && await findOverlappingEnabledRule(
            range.minDistanceKm, range.maxDistanceKm, null, session
        )) {
            throw createError("Distance range overlaps with an enabled rule.", 409);
        }
        const rule = new DistanceFeeRule({ ...ruleData, ...range });
        await rule.save({ session });
        return rule.toObject();
    });

export const updateDistanceFeeRule = async (ruleId, ruleData) =>
    withBookingCreationTransaction([RULE_RESOURCE], async (session) => {
        const rule = await DistanceFeeRule.findById(ruleId).session(session);
        if (!rule) throw createError("Distance fee rule not found.", 404);
        const next = { ...rule.toObject(), ...ruleData };
        const range = resolveDistanceRange(next);
        if (next.enabled && await findOverlappingEnabledRule(
            range.minDistanceKm, range.maxDistanceKm, ruleId, session
        )) {
            throw createError("Distance range overlaps with an enabled rule.", 409);
        }
        Object.assign(rule, ruleData, range);
        await rule.save({ session });
        return rule.toObject();
    });

export const disableDistanceFeeRule = (ruleId) =>
    updateDistanceFeeRule(ruleId, { enabled: false });

export const enableDistanceFeeRule = (ruleId) =>
    updateDistanceFeeRule(ruleId, { enabled: true });

export const deleteDistanceFeeRule = (ruleId) =>
    updateDistanceFeeRule(ruleId, { enabled: false });

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
