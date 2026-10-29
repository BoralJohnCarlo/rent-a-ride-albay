/*
 * Client mirrors of the server's lockedTermsService: a booking's fee rules
 * are locked to its accepted terms, and whichever of those and today's
 * settings is better for the customer applies. The server has the final
 * say; these only keep the screens from offering what it would refuse.
 */

/*
 * The most an admin may set a late charge to: the lower of today's cap and
 * the booking's locked one (a cap is kinder than none). 0 = no cap.
 */
export const getBookingPenaltyCap = (booking, currentCap) => {
    const current = Number(currentCap) || 0;
    const latePenalty = booking?.termsAcceptance?.policySnapshot?.latePenalty;

    if (!latePenalty || typeof latePenalty !== "object") {
        return current;
    }

    const caps = [current, Number(latePenalty.maximumCap) || 0].filter(
        (cap) => cap > 0
    );

    return caps.length ? Math.min(...caps) : 0;
};
