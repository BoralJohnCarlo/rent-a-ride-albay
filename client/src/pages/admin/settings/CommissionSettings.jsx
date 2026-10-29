import { useEffect, useState } from "react";

import { Percent, Wallet } from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";

import { usePayouts } from "../../../hooks/payouts/usePayouts";
import useToast from "../../../hooks/toast/useToast";

const CommissionSettings = () => {
    const toast = useToast();

    const {
        settings,
        loading,
        error,
        loadPayoutSettings,
        updatePayoutSettings,
    } = usePayouts();

    const [saving, setSaving] = useState(false);
    const [localSettings, setLocalSettings] = useState({
        platformCommissionRate: 10,
        payoutCurrency: "PHP",
        payoutHoldHours: 24,
    });

    useEffect(() => {
        loadPayoutSettings();
    }, [loadPayoutSettings]);

    useEffect(() => {
        if (settings && Object.keys(settings).length > 0) {
            setLocalSettings((prev) => ({
                ...prev,
                ...settings,
            }));
        }
    }, [settings]);

    useEffect(() => {
        if (error) {
            toast.error(
                typeof error === "string"
                    ? error
                    : error?.message ||
                          "Unable to load commission settings."
            );
        }
    }, [error, toast]);

    const handleChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            await updatePayoutSettings({
                ...localSettings,
                payoutCurrency: "PHP",
            }).unwrap();
            toast.success(
                "Commission & payout settings saved successfully."
            );
        } catch (error) {
            toast.error(
                error?.message ||
                    (typeof error === "string"
                        ? error
                        : "Unable to save settings.")
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        <Percent size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Platform Commission
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            The default rate used for every partner's payouts. When approving a consignment, an admin can still give that specific vehicle its own individually-negotiated rate instead.
                        </p>
                    </div>
                </div>

                <Input
                    id="platform-commission"
                    name="platformCommissionRate"
                    type="number"
                    label="Platform Commission (%)"
                    min={0}
                    max={100}
                    step={0.1}
                    value={
                        localSettings.platformCommissionRate ??
                        10
                    }
                    onChange={(event) =>
                        handleChange(
                            "platformCommissionRate",
                            Number(event.target.value) || 0
                        )
                    }
                    helperText="Percentage of each rental payment the platform keeps by default. The partner gets the remaining percentage, unless their vehicle has its own individual rate set."
                />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                        <Wallet size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Payout Rules
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Currency and timing used when paying out partners.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Input
                        id="payout-currency"
                        name="payoutCurrency"
                        type="text"
                        label="Payout Currency"
                        maxLength={3}
                        value={
                            localSettings.payoutCurrency ||
                            "PHP"
                        }
                        readOnly
                        disabled
                        onChange={(event) => {
                            // No-op since field is read-only
                        }}
                        helperText="Three-letter currency code used for payouts. This is always set to PHP and cannot be changed."
                    />

                    <Input
                        id="payout-hold-hours"
                        name="payoutHoldHours"
                        type="number"
                        label="Payout Hold Period (hours)"
                        min={0}
                        step={1}
                        value={
                            localSettings.payoutHoldHours ??
                            24
                        }
                        onChange={(event) =>
                            handleChange(
                                "payoutHoldHours",
                                Number(event.target.value) || 0
                            )
                        }
                        helperText="How long after a rental completes before its payout is automatically released to the partner's wallet. Gives time to catch a late refund or dispute first."
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={saving || loading}
                    >
                        Save Commission Settings
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default CommissionSettings;
