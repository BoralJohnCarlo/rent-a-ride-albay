// Legacy accounts use their last upload as the initial period anchor.
// Requests must advance the anchor when resetting, even without an upload.
export const refreshValidIdRenewalPeriod = (user, periodMs, now = Date.now()) => {
    const anchor = user.validIdRenewalPeriodStartedAt ?? user.lastValidIdRenewalAt;
    if (anchor && now - new Date(anchor).getTime() >= periodMs) {
        user.validIdRenewalCount = 0;
        user.validIdRenewalPeriodStartedAt = new Date(now);
    } else if (!user.validIdRenewalPeriodStartedAt) {
        user.validIdRenewalPeriodStartedAt = anchor ? new Date(anchor) : new Date(now);
    }
};
