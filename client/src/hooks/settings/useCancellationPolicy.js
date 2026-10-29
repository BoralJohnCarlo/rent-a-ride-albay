import usePublicRefundSettings from "./usePublicRefundSettings";

/*
 * The cancellation refund rules, read from the public settings endpoint so
 * customer-facing text (Terms, FAQ) quotes what the admin has configured.
 * `ready` is false until the policy has actually been loaded — callers should
 * fall back to wording without numbers rather than show defaults that might
 * not match what the admin set.
 */
const useCancellationPolicy = () => {
    const { policy, ready } = usePublicRefundSettings();

    return {
        policy,
        ready: ready && policy !== null,
    };
};

export default useCancellationPolicy;
