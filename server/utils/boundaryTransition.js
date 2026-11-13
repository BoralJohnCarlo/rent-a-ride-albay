// Pure state machine. Only fresh, strictly newer fixes advance evidence.
// Unknown intervals pause the evidence clock; border jitter never resets it.
export const transitionBoundary = (previous, fix, policy, now, maxGapMs) => {
    const at = new Date(fix.recordedAt).getTime();
    const last = previous.lastAt ? new Date(previous.lastAt).getTime() : 0;
    if (!fix.gpsFix || !fix.zone || !Number.isFinite(at) || at > now || now - at > maxGapMs || at <= last)
        return { state: previous, events: [] };
    const state = { ...previous, paused: false, lastAt: new Date(at), zone: fix.zone };
    const events = [];
    const gap = at - last;
    if (fix.zone === "outside") {
        state.insideSince = null;
        if (!state.outsideSince) {
            state.outsideSince = new Date(at);
            state.outsideSamples = 1;
            state.evidenceMs = 0;
        } else {
            state.outsideSamples = (state.outsideSamples || 0) + 1;
            if (!previous.paused && gap <= maxGapMs && previous.zone === "outside") {
                state.evidenceMs = (state.evidenceMs || 0) + gap;
                if (state.confirmed) {
                    const start = state.graceStartedAt ? new Date(state.graceStartedAt).getTime() : last;
                    state.graceEvidenceMs = (state.graceEvidenceMs ?? Math.max(0, (previous.evidenceMs || 0) - (previous.graceEvidenceStart || 0))) + Math.max(0, at - Math.max(last, start));
                }
            }
        }
        if (!state.confirmed && state.outsideSamples >= 2 && state.evidenceMs >= policy.confirmationSeconds * 1000) {
            state.confirmed = true;
            state.graceEvidenceStart = state.evidenceMs;
            state.graceStartedAt = new Date(now);
            state.graceEvidenceMs = 0;
            events.push("outside");
        }
        if (state.confirmed && !state.eligible && policy.penaltiesEnabled &&
            (state.graceEvidenceMs ?? state.evidenceMs - state.graceEvidenceStart) >= policy.gracePeriodMinutes * 60000) {
            state.eligible = true;
            events.push("eligible");
        }
    } else if (fix.zone !== "border") {
        if (state.outsideSince) {
            // Two consecutive inside fixes, beyond the border tolerance.
            if (previous.paused || !previous.insideSince || gap > maxGapMs || previous.zone === "outside" || previous.zone === "border") state.insideSince = new Date(at);
            else if (at - new Date(state.insideSince).getTime() >= policy.confirmationSeconds * 1000) {
                events.push("returned");
                return { state: { lastAt: new Date(at), zone: fix.zone }, events };
            }
        } else if (fix.zone === "near" && !state.warned) {
            state.warned = true;
            events.push("near");
        } else if (fix.zone === "inside") state.warned = false;
    } else state.insideSince = null;
    return { state, events };
};
