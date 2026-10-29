import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Clock,
    Plus,
    Settings2,
    Trash2,
    Wallet,
} from "lucide-react";

import ActionIconButton from "../../../components/common/ActionIconButton";
import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Switch from "../../../components/common/Switch";
import LockedTermsNotice from "../../../components/admin/LockedTermsNotice";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

import {
    DEFAULT_CANCELLATION_POLICY,
    MAX_CANCELLATION_TIERS,
    describeCancellationPolicy,
    getCancellationPolicyError,
    resolveCancellationPolicy,
} from "../../../utils/cancellationPolicy";
import { DEFAULT_NO_SHOW_GRACE_HOURS } from "../../../constants/bookingStatus";

/* A cleared number input is "" (kept so the admin can retype), not 0. */
const toNumberOrBlank = (value) =>
    value === "" ? "" : Number(value);

const RefundSettings = () => {
    const toast = useToast();

    const {
        settings,
        loading: settingsLoading,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const [saving, setSaving] = useState(false);
    const [localSettings, setLocalSettings] =
        useState({});

    useEffect(() => {
        void getSettings();
    }, [getSettings]);

    useEffect(() => {
        if (
            settings &&
            Object.keys(settings).length > 0
        ) {
            /*
             * earlyReturnSettings doesn't exist yet on documents saved
             * before this feature shipped. Filling in every field here
             * (not just as a display fallback) guarantees
             * handleEarlyReturnChange's spread always starts from a
             * complete object — otherwise saving after touching only one
             * of the three fields would persist just that one field,
             * silently dropping the other two from the stored document.
             */
            setLocalSettings({
                ...settings,
                /*
                 * Same reason as earlyReturnSettings below: a document saved
                 * before the cancellation policy existed has no
                 * cancellationPolicy, and refundSettings is written to the
                 * server as a whole section.
                 */
                refundSettings: {
                    autoApproveRefundThreshold: 500,
                    requireCancellationReason: true,
                    gracePeriodHours: 24,
                    noShowGraceHours: DEFAULT_NO_SHOW_GRACE_HOURS,
                    noShowRefundPercent: 0,
                    noShowKeepsDistanceFee: true,
                    noShowAutoMark: true,
                    ...settings.refundSettings,
                    cancellationPolicy: resolveCancellationPolicy(
                        settings.refundSettings?.cancellationPolicy
                    ),
                },
                earlyReturnSettings: {
                    enabled: true,
                    autoApprove: false,
                    voucherValidityMonths: 12,
                    minUnusedDaysToQualify: 1,
                    ...settings.earlyReturnSettings,
                },
            });
        }
    }, [settings]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const refundSettings = useMemo(
        () =>
            localSettings
                .refundSettings ?? {
                    autoApproveRefundThreshold: 500,
                    requireCancellationReason: true,
                    gracePeriodHours: 24,
                    noShowGraceHours: DEFAULT_NO_SHOW_GRACE_HOURS,
                    noShowRefundPercent: 0,
                    noShowKeepsDistanceFee: true,
                    noShowAutoMark: true,
                    cancellationPolicy:
                        DEFAULT_CANCELLATION_POLICY,
                },
        [localSettings]
    );

    const cancellationPolicy = useMemo(
        () =>
            resolveCancellationPolicy(
                refundSettings.cancellationPolicy
            ),
        [refundSettings.cancellationPolicy]
    );

    /*
     * resolveCancellationPolicy drops blank/invalid tiers and re-sorts, which
     * is right for the preview but would make rows jump around and vanish
     * while typing — so the editable rows come from the raw state.
     */
    const policyTiers =
        refundSettings.cancellationPolicy?.tiers ??
        cancellationPolicy.tiers;

    const noShowPolicy = useMemo(
        () => ({
            refundPercent: refundSettings.noShowRefundPercent ?? 0,
            keepsDistanceFee:
                refundSettings.noShowKeepsDistanceFee !== false,
        }),
        [
            refundSettings.noShowRefundPercent,
            refundSettings.noShowKeepsDistanceFee,
        ]
    );

    const cancellationPreviewLines = useMemo(
        () =>
            describeCancellationPolicy(cancellationPolicy, noShowPolicy),
        [cancellationPolicy, noShowPolicy]
    );

    const earlyReturnSettings = useMemo(
        () =>
            localSettings
                .earlyReturnSettings ?? {
                    enabled: true,
                    autoApprove: false,
                    voucherValidityMonths: 12,
                    minUnusedDaysToQualify: 1,
                },
        [localSettings]
    );

    const handleChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            refundSettings: {
                ...prev.refundSettings,
                [field]: value,
            },
        }));
    };

    const handleEarlyReturnChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            earlyReturnSettings: {
                ...prev.earlyReturnSettings,
                [field]: value,
            },
        }));
    };

    /*
     * `updater` gets the policy as currently edited (raw rows, blank ones
     * included) and returns just the fields to change.
     */
    const updatePolicy = (updater) => {
        setLocalSettings((prev) => {
            const currentPolicy =
                prev.refundSettings?.cancellationPolicy ??
                DEFAULT_CANCELLATION_POLICY;

            return {
                ...prev,
                refundSettings: {
                    ...prev.refundSettings,
                    cancellationPolicy: {
                        ...currentPolicy,
                        ...updater(currentPolicy),
                    },
                },
            };
        });
    };

    const handlePolicyChange = (field, value) => {
        updatePolicy(() => ({ [field]: value }));
    };

    const handleTierChange = (index, field, value) => {
        updatePolicy((policy) => ({
            tiers: policy.tiers.map((tier, tierIndex) =>
                tierIndex === index
                    ? { ...tier, [field]: value }
                    : tier
            ),
        }));
    };

    const handleAddTier = () => {
        updatePolicy((policy) => ({
            tiers: [
                ...policy.tiers,
                { hoursBefore: "", refundPercent: 0 },
            ],
        }));
    };

    const handleRemoveTier = (index) => {
        updatePolicy((policy) => ({
            tiers: policy.tiers.filter(
                (_, tierIndex) => tierIndex !== index
            ),
        }));
    };

    const handleSave = async (
        successMessage = "Refund settings saved successfully."
    ) => {
        /*
         * Every card on this page saves the whole local state, so the
         * cancellation policy is checked whichever Save was pressed. Tiers go
         * out largest cutoff first, the order the server stores them in.
         */
        const savedPolicy = {
            ...localSettings.refundSettings
                ?.cancellationPolicy,
            tiers: [
                ...(localSettings.refundSettings
                    ?.cancellationPolicy?.tiers ?? []),
            ].sort((a, b) => b.hoursBefore - a.hoursBefore),
        };

        const policyError =
            getCancellationPolicyError(savedPolicy);

        if (policyError) {
            toast.error(policyError);
            return;
        }

        setSaving(true);

        try {
            const result = await updateSettings({
                ...localSettings,
                refundSettings: {
                    ...localSettings.refundSettings,
                    cancellationPolicy: savedPolicy,
                },
            });

            /*
             * A rejected save doesn't throw here — the error effect above
             * already shows it, so don't also claim success.
             */
            if (result?.meta?.requestStatus !== "rejected") {
                toast.success(successMessage);
            }
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to save settings."
            );
        } finally {
            setSaving(false);
        }
    };

    if (settingsLoading && !localSettings.refundSettings) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <LockedTermsNotice />

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <Wallet
                            size={19}
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Refund Configuration
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Set how refunds are processed and validated.
                            Looking for refund history? See the Refunds
                            tab on the Financials page.
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Existing bookings use refund changes only when they are more favorable to the customer.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Switch
                        id="require-cancellation-reason"
                        name="requireCancellationReason"
                        label="Require Cancellation Reason"
                        helperText={
                            refundSettings.requireCancellationReason ??
                            true
                                ? "Customers must explain why they're cancelling a booking. Admins are always exempt."
                                : "Customers can cancel a booking without giving a reason."
                        }
                        checked={
                            refundSettings.requireCancellationReason ??
                            true
                        }
                        onChange={(event) =>
                            handleChange(
                                "requireCancellationReason",
                                event.target.checked
                            )
                        }
                    />

                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        How much of the reservation fee a customer gets back
                        when they cancel is set in Cancellation Refund Policy
                        below. Anything paid on top of the reservation fee is
                        always refunded, and admin-initiated cancellations
                        always refund in full.
                    </p>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 dark:border-gray-800 md:grid-cols-2">
                    <Input
                        id="auto-approve-threshold"
                        name="autoApproveRefundThreshold"
                        type="number"
                        label="Auto-Approve Refund Threshold (₱)"
                        min={0}
                        step={0.01}
                        value={
                            refundSettings.autoApproveRefundThreshold ??
                            500
                        }
                        onChange={(event) =>
                            handleChange(
                                "autoApproveRefundThreshold",
                                Number(event.target.value) || 0
                            )
                        }
                        helperText="Cancellation refunds at or below this amount are sent automatically. Larger refunds are held for admin review and must be paid out manually — keep this above your typical reservation fee if you want full-fee refunds to go out automatically. Set to 0 to always send automatically, regardless of amount."
                    />

                    <Input
                        id="refund-request-window"
                        name="gracePeriodHours"
                        type="number"
                        label="Refund Request Window (Hours)"
                        min={0}
                        max={72}
                        step={1}
                        value={
                            refundSettings.gracePeriodHours ??
                            24
                        }
                        onChange={(event) =>
                            handleChange(
                                "gracePeriodHours",
                                Number(event.target.value) || 0
                            )
                        }
                        helperText="How long, in hours after a vehicle is returned, a customer can request a refund for that trip from My Bookings. The option disappears once this window passes."
                    />

                    <Input
                        id="no-show-grace"
                        name="noShowGraceHours"
                        type="number"
                        label="No-Show Grace Period (Hours)"
                        min={0}
                        max={16}
                        step={1}
                        value={
                            refundSettings.noShowGraceHours ??
                            DEFAULT_NO_SHOW_GRACE_HOURS
                        }
                        onChange={(event) =>
                            handleChange(
                                "noShowGraceHours",
                                Number(event.target.value) || 0
                            )
                        }
                        helperText="How long after the booked pickup time an admin can mark an approved booking as a no-show (0–16)."
                    />

                    <Input
                        id="no-show-refund-percent"
                        name="noShowRefundPercent"
                        type="number"
                        label="No-Show Refund (% of Reservation Fee)"
                        min={0}
                        max={100}
                        step={1}
                        value={refundSettings.noShowRefundPercent ?? 0}
                        onChange={(event) =>
                            handleChange(
                                "noShowRefundPercent",
                                Math.min(
                                    100,
                                    Math.max(
                                        0,
                                        Math.round(
                                            Number(event.target.value) || 0
                                        )
                                    )
                                )
                            )
                        }
                        helperText="How much of the reservation fee a no-show gets back (0 keeps all of it). Anything paid on top of the fees is always refunded, and a voucher isn't returned."
                    />

                    <div className="grid grid-cols-1 gap-6 md:col-span-2 md:grid-cols-2">
                        <Switch
                            id="no-show-keeps-distance-fee"
                            name="noShowKeepsDistanceFee"
                            label="Keep the Pickup Distance Fee on a No-Show"
                            helperText={
                                refundSettings.noShowKeepsDistanceFee !==
                                false
                                    ? "A no-show keeps the pickup distance fee."
                                    : "A no-show gets the pickup distance fee back."
                            }
                            checked={
                                refundSettings.noShowKeepsDistanceFee !==
                                false
                            }
                            onChange={(event) =>
                                handleChange(
                                    "noShowKeepsDistanceFee",
                                    event.target.checked
                                )
                            }
                        />

                        <Switch
                            id="no-show-auto-mark"
                            name="noShowAutoMark"
                            label="Mark No-Shows Automatically"
                            helperText={
                                refundSettings.noShowAutoMark !== false
                                    ? "Bookings still not picked up by the end of the day are marked as no-shows automatically (unless something on our side stood in the way)."
                                    : "Only admins mark no-shows. You're alerted once when a booking reaches the end of its pickup day."
                            }
                            checked={refundSettings.noShowAutoMark !== false}
                            onChange={(event) =>
                                handleChange(
                                    "noShowAutoMark",
                                    event.target.checked
                                )
                            }
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={() =>
                            handleSave(
                                "Refund settings saved successfully."
                            )
                        }
                        loading={saving}
                        disabled={
                            settingsLoading
                        }
                        leftIcon={
                            <Settings2
                                size={16}
                            />
                        }
                    >
                        Save Refund Settings
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <Clock
                            size={19}
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Cancellation Refund Policy
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            How much of the reservation fee a customer gets
                            back when they cancel before pickup, measured from
                            the pickup date and time they booked (Philippine
                            time). The rental period itself is timed from the
                            actual hand-over.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Switch
                        id="full-refund-before-approval"
                        name="fullRefundBeforeApproval"
                        label="Full Refund Before Approval"
                        helperText={
                            cancellationPolicy.fullRefundBeforeApproval
                                ? "Until an admin approves a booking, cancelling refunds the reservation fee in full — nothing has been committed to the customer yet."
                                : "The refund tiers below apply even before a booking is approved."
                        }
                        checked={
                            cancellationPolicy.fullRefundBeforeApproval
                        }
                        onChange={(event) =>
                            handlePolicyChange(
                                "fullRefundBeforeApproval",
                                event.target.checked
                            )
                        }
                    />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 dark:border-gray-800 md:grid-cols-2">
                    <Input
                        id="approval-grace-hours"
                        name="approvalGraceHours"
                        type="number"
                        label="Cooling-Off After Approval (Hours)"
                        min={0}
                        max={168}
                        step={1}
                        value={
                            refundSettings.cancellationPolicy
                                ?.approvalGraceHours ??
                            cancellationPolicy.approvalGraceHours
                        }
                        onChange={(event) =>
                            handlePolicyChange(
                                "approvalGraceHours",
                                toNumberOrBlank(
                                    event.target.value
                                )
                            )
                        }
                        helperText="For this many hours after a booking is approved, the customer can cancel for a full refund of the reservation fee. Set to 0 to turn this off."
                    />

                    <Input
                        id="approval-grace-min-lead-hours"
                        name="approvalGraceMinLeadHours"
                        type="number"
                        label="Cooling-Off Minimum Lead Time (Hours)"
                        min={0}
                        max={720}
                        step={1}
                        value={
                            refundSettings.cancellationPolicy
                                ?.approvalGraceMinLeadHours ??
                            cancellationPolicy.approvalGraceMinLeadHours
                        }
                        onChange={(event) =>
                            handlePolicyChange(
                                "approvalGraceMinLeadHours",
                                toNumberOrBlank(
                                    event.target.value
                                )
                            )
                        }
                        helperText="The cooling-off only applies while pickup is at least this many hours away, so it can't be used to dodge the late-cancellation tiers."
                    />
                </div>

                <div className="mt-6 space-y-4 border-t border-gray-100 pt-6 dark:border-gray-800">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                            Refund Tiers
                        </h3>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Cancelling at least the given number of hours before
                            pickup refunds that percentage of the reservation
                            fee. Closer to pickup than the smallest tier,
                            nothing is refunded. A closer tier can&apos;t refund
                            more than an earlier one.
                        </p>
                    </div>

                    {policyTiers.length === 0 && (
                        <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                            No tiers — once a booking is approved, the
                            reservation fee is never refunded (apart from the
                            cooling-off above).
                        </p>
                    )}

                    {policyTiers.map((tier, index) => (
                        <div
                            key={index}
                            className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[1fr_1fr_auto]"
                        >
                            <Input
                                id={`cancellation-tier-hours-${index}`}
                                name={`cancellationTierHours${index}`}
                                type="number"
                                label="Cancelled at least (hours before pickup)"
                                min={1}
                                max={720}
                                step={1}
                                value={tier.hoursBefore}
                                onChange={(event) =>
                                    handleTierChange(
                                        index,
                                        "hoursBefore",
                                        toNumberOrBlank(
                                            event.target.value
                                        )
                                    )
                                }
                            />

                            <Input
                                id={`cancellation-tier-percent-${index}`}
                                name={`cancellationTierPercent${index}`}
                                type="number"
                                label="Refund of reservation fee (%)"
                                min={0}
                                max={100}
                                step={1}
                                value={tier.refundPercent}
                                onChange={(event) =>
                                    handleTierChange(
                                        index,
                                        "refundPercent",
                                        toNumberOrBlank(
                                            event.target.value
                                        )
                                    )
                                }
                            />

                            <div className="sm:pt-8">
                                <ActionIconButton
                                    icon={Trash2}
                                    title="Remove tier"
                                    variant="danger"
                                    onClick={() =>
                                        handleRemoveTier(index)
                                    }
                                />
                            </div>
                        </div>
                    ))}

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddTier}
                        disabled={
                            policyTiers.length >=
                            MAX_CANCELLATION_TIERS
                        }
                        leftIcon={<Plus size={16} />}
                    >
                        Add Tier
                    </Button>
                </div>

                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        What customers will read (Terms &amp; FAQ)
                    </p>

                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-400">
                        {cancellationPreviewLines.map((line) => (
                            <li key={line}>{line}</li>
                        ))}
                    </ul>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={() =>
                            handleSave(
                                "Cancellation refund policy saved successfully."
                            )
                        }
                        loading={saving}
                        disabled={
                            settingsLoading
                        }
                        leftIcon={
                            <Settings2
                                size={16}
                            />
                        }
                    >
                        Save Cancellation Policy
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        <Wallet
                            size={19}
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Early Return Credits
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure how unused rental days are
                            credited when a vehicle is returned early.
                            Looking for the approval queue? See the
                            Early Returns tab on the Financials page.
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Existing bookings use early-return changes only when they are more favorable to the customer.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <Switch
                        id="early-return-enabled"
                        name="enabled"
                        label="Detect Early Returns"
                        helperText={
                            earlyReturnSettings.enabled ??
                            true
                                ? "Returns before the scheduled end date are flagged for admin review."
                                : "Early returns are not detected or flagged."
                        }
                        checked={
                            earlyReturnSettings.enabled ??
                            true
                        }
                        onChange={(event) =>
                            handleEarlyReturnChange(
                                "enabled",
                                event.target.checked
                            )
                        }
                    />

                    <Switch
                        id="early-return-auto-approve"
                        name="autoApprove"
                        label="Automatically Approve Qualifying Early Returns"
                        helperText={
                            earlyReturnSettings.autoApprove
                                ? "A voucher is issued the moment a return qualifies - it skips the approval queue entirely."
                                : "Qualifying returns wait in the approval queue (Financials → Early Returns) for an admin to approve before a voucher is issued."
                        }
                        disabled={
                            !(earlyReturnSettings.enabled ?? true)
                        }
                        checked={
                            Boolean(earlyReturnSettings.autoApprove) &&
                            (earlyReturnSettings.enabled ?? true)
                        }
                        onChange={(event) =>
                            handleEarlyReturnChange(
                                "autoApprove",
                                event.target.checked
                            )
                        }
                    />
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 border-t border-gray-100 pt-6 dark:border-gray-800 md:grid-cols-2">
                    <Input
                        id="early-return-validity-months"
                        name="voucherValidityMonths"
                        type="number"
                        label="Voucher Validity (Months)"
                        min={6}
                        max={12}
                        step={1}
                        value={
                            earlyReturnSettings.voucherValidityMonths ??
                            12
                        }
                        onChange={(event) =>
                            handleEarlyReturnChange(
                                "voucherValidityMonths",
                                Number(event.target.value) || 6
                            )
                        }
                        helperText="How long an approved early-return voucher stays valid, from 6 to 12 months."
                    />

                    <Input
                        id="early-return-min-days"
                        name="minUnusedDaysToQualify"
                        type="number"
                        label="Minimum Unused Days to Qualify"
                        min={1}
                        step={1}
                        value={
                            earlyReturnSettings.minUnusedDaysToQualify ??
                            1
                        }
                        onChange={(event) =>
                            handleEarlyReturnChange(
                                "minUnusedDaysToQualify",
                                Number(event.target.value) || 1
                            )
                        }
                        helperText="The return must be at least this many full days early to qualify. Below that, no credit applies; once qualified, the customer is credited for the actual number of days early, not just this minimum."
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={() =>
                            handleSave(
                                "Early return settings saved successfully."
                            )
                        }
                        loading={saving}
                        disabled={
                            settingsLoading
                        }
                        leftIcon={
                            <Settings2
                                size={16}
                            />
                        }
                    >
                        Save Early Return Settings
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RefundSettings;
