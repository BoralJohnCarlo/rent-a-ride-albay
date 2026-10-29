/*
 * A vehicle with its own negotiated commission (set at consignment approval
 * time) always overrides the platform default — see calculateBookingPayout
 * in payoutService.js for the source of truth this mirrors.
 */
const formatCommission = (
    commission,
    platformCommissionRate = null
) => {
    if (commission?.mode === "PERCENTAGE" && commission.value != null) {
        return {
            label: `${commission.value}% per booking`,
            isIndividual: true,
        };
    }

    if (commission?.mode === "FIXED" && commission.value != null) {
        return {
            label: `₱${commission.value.toLocaleString()} per booking`,
            isIndividual: true,
        };
    }

    return {
        label:
            platformCommissionRate != null
                ? `Platform default (${platformCommissionRate}%)`
                : "Platform default",
        isIndividual: false,
    };
};

export default formatCommission;
