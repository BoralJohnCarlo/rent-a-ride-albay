/*
 * The late-return charge for one set of penalty rules (Settings →
 * Penalties) and daily rate. Pure, so a rental can be priced under both its
 * booking's locked rules and today's and charged the lower (rentalService
 * calculateLateReturn, lockedTermsService).
 *
 * Returns the fields stored on Rental.lateReturn (amount already capped).
 */
export const computeLatePenalty = ({
    penaltySettings = {},
    expectedReturnAt,
    actualReturnAt,
    dailyRate = 0,
}) => {
    const gracePeriodMinutes = penaltySettings.gracePeriodMinutes ?? 0;

    const lateMilliseconds =
        actualReturnAt.getTime() -
        expectedReturnAt.getTime() -
        gracePeriodMinutes * 60 * 1000;

    const lateDurationMinutes = Math.max(
        0,
        Math.ceil(lateMilliseconds / (60 * 1000))
    );

    const chargingUnit = penaltySettings.chargingUnit || "Hour";
    const rateType = penaltySettings.rateType || "derived";

    if (lateDurationMinutes <= 0) {
        return {
            gracePeriodMinutes,
            lateDurationMinutes,
            chargingUnit,
            chargedUnits: 0,
            rate: 0,
            rateType,
            amount: 0,
        };
    }

    let chargedUnits = 0;

    if (chargingUnit === "Hour") {
        chargedUnits = Math.ceil(lateDurationMinutes / 60);
    } else if (chargingUnit === "Day") {
        chargedUnits = Math.max(
            1,
            Math.ceil(lateDurationMinutes / (24 * 60))
        );
    }

    /*
     * Rate is always expressed per charging unit. For hourly charging the
     * daily rate is divided across 24 hours before any rate type is
     * applied, so "multiplier" stays consistent with the unit instead of
     * charging a full day's rate for every hour late.
     */
    const perUnitDailyRate =
        chargingUnit === "Hour" ? dailyRate / 24 : dailyRate;

    let rate = 0;

    if (rateType === "custom") {
        rate = Number(penaltySettings.customRate) || 0;
    } else if (rateType === "multiplier") {
        rate =
            perUnitDailyRate *
            (Number(penaltySettings.rateMultiplier) || 1);
    } else {
        rate = perUnitDailyRate;
    }

    if (!Number.isFinite(rate) || rate < 0) {
        rate = 0;
    }

    const lateAmount = Math.round(chargedUnits * rate * 100) / 100;
    const maximumCap = penaltySettings.maximumCap || 0;

    return {
        gracePeriodMinutes,
        lateDurationMinutes,
        chargingUnit,
        chargedUnits,
        rate,
        rateType,
        amount: maximumCap > 0 ? Math.min(lateAmount, maximumCap) : lateAmount,
    };
};

export default computeLatePenalty;
