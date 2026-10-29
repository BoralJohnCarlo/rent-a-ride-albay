import { useEffect, useState } from "react";

import { ReceiptText } from "lucide-react";

import Button from "../../../components/common/Button";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

/*
 * Settings → Registration. Only ever sends its own section, so saving here
 * can't overwrite anything another settings page changed meanwhile.
 */
const RegistrationSettings = () => {
    const toast = useToast();

    const {
        loading: settingsLoading,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    /*
     * null until the stored value has loaded - taken from this page's own
     * fetch, not the store, whose built-in defaults would otherwise show
     * (and could be saved) before the real value arrives.
     */
    const [proofOfBillingEnabled, setProofOfBillingEnabled] =
        useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let active = true;

        Promise.resolve(getSettings()).then((action) => {
            if (!active || action?.error) {
                return;
            }

            setProofOfBillingEnabled(
                action?.payload?.data?.registrationSettings
                    ?.proofOfBillingEnabled !== false
            );
        });

        return () => {
            active = false;
        };
    }, [getSettings]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const handleSave = async () => {
        setSaving(true);

        try {
            const result = await updateSettings({
                registrationSettings: {
                    proofOfBillingEnabled: Boolean(proofOfBillingEnabled),
                },
            });

            // A failed save is toasted by the settingsError effect above.
            if (!result?.error) {
                toast.success("Registration settings saved successfully.");
            }
        } catch (error) {
            toast.error(error.message || "Unable to save settings.");
        } finally {
            setSaving(false);
        }
    };

    if (proofOfBillingEnabled === null) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600 dark:border-gray-700 dark:border-t-blue-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
                        <ReceiptText size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Proof of Billing Address
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Ask customers and partners for one image of a utility bill or bank statement when they register.
                        </p>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        proofOfBillingEnabled
                            ? "border-yellow-200 bg-yellow-50/60 dark:border-yellow-900 dark:bg-yellow-950/20"
                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Require proof of billing address
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {proofOfBillingEnabled
                                ? "Enabled — registration requires the image (below the valid ID), it shows on customer and partner profiles, and on the booking details panel. Accounts without one can still book and can add it from their profile."
                                : "Disabled — registration doesn't ask for it, and it's hidden from profiles and the booking details panel. Images already uploaded are kept and show again if you turn this back on."}
                        </p>
                    </div>

                    <Switch
                        checked={proofOfBillingEnabled}
                        onChange={(event) =>
                            setProofOfBillingEnabled(event.target.checked)
                        }
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={saving || settingsLoading}
                    >
                        Save Changes
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RegistrationSettings;
