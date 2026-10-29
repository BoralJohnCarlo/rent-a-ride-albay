import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Settings2,
    Car,
    Clock3,
    Bell,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

const RENEWAL_PERIOD_UNIT_OPTIONS = [
    { value: "Month", label: "Month(s)" },
    { value: "Year", label: "Year(s)" },
];

const VehicleRegistrationSettings = () => {
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
    const [localSettings, setLocalSettings] = useState({});

    useEffect(() => {
        void getSettings();
    }, [getSettings]);

    useEffect(() => {
        if (settings && Object.keys(settings).length > 0) {
            setLocalSettings(settings);
        }
    }, [settings]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const renewalSettings = useMemo(
        () =>
            localSettings
                .vehicleRegistrationRenewalSettings ?? {
                    maxRenewalsPerPeriod: 1,
                    renewalPeriodValue: 1,
                    renewalPeriodUnit: "Year",
                    maxAttempts: 3,
                },
        [localSettings]
    );

    const expirationSettings = useMemo(
        () =>
            localSettings
                .vehicleRegistrationExpirationSettings ?? {
                    enabled: false,
                    firstReminderDays: 30,
                    secondReminderDays: 7,
                    thirdReminderDays: 1,
                    notifyOnExpired: false,
                },
        [localSettings]
    );

    const handleRenewalChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            vehicleRegistrationRenewalSettings: {
                ...prev.vehicleRegistrationRenewalSettings,
                [field]: value,
            },
        }));
    };

    const handleSwitchChange = (field, event) => {
        setLocalSettings((prev) => ({
            ...prev,
            vehicleRegistrationExpirationSettings: {
                ...prev.vehicleRegistrationExpirationSettings,
                [field]: event.target.checked,
            },
        }));
    };

    const handleExpirationNumberChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            vehicleRegistrationExpirationSettings: {
                ...prev.vehicleRegistrationExpirationSettings,
                [field]: Math.max(1, Number(value) || 1),
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings(localSettings);
            toast.success("Vehicle registration settings saved successfully.");
        } catch (error) {
            toast.error(
                error.message || "Unable to save settings."
            );
        } finally {
            setSaving(false);
        }
    };

    if (
        settingsLoading &&
        !localSettings.vehicleRegistrationRenewalSettings
    ) {
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                        <Clock3 size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Renewal Configuration
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Set how many times an operator can renew a vehicle's registration per period, and how many renewal attempts they're allowed. Admins are never subject to these limits.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Input
                        id="max-renewals-per-period"
                        name="maxRenewalsPerPeriod"
                        type="number"
                        label="Maximum Renewals Per Period"
                        min={1}
                        step={1}
                        value={renewalSettings.maxRenewalsPerPeriod ?? 1}
                        onChange={(event) =>
                            handleRenewalChange(
                                "maxRenewalsPerPeriod",
                                Number(event.target.value) || 1
                            )
                        }
                        helperText="Maximum number of times an operator can directly renew a vehicle's registration per period."
                    />

                    <Input
                        id="max-attempts"
                        name="maxAttempts"
                        type="number"
                        label="Maximum Renewal Attempts"
                        min={1}
                        step={1}
                        value={renewalSettings.maxAttempts ?? 3}
                        onChange={(event) =>
                            handleRenewalChange(
                                "maxAttempts",
                                Number(event.target.value) || 1
                            )
                        }
                        helperText="Maximum number of renewal attempts an operator can request per period."
                    />

                    <div className="grid grid-cols-2 gap-3 md:col-span-2 md:max-w-md">
                        <Input
                            id="renewal-period-value"
                            name="renewalPeriodValue"
                            type="number"
                            label="Renewal Period"
                            min={1}
                            step={1}
                            value={renewalSettings.renewalPeriodValue ?? 1}
                            onChange={(event) =>
                                handleRenewalChange(
                                    "renewalPeriodValue",
                                    Number(event.target.value) || 1
                                )
                            }
                        />

                        <Select
                            id="renewal-period-unit"
                            name="renewalPeriodUnit"
                            label="Unit"
                            value={renewalSettings.renewalPeriodUnit || "Year"}
                            onChange={(event) =>
                                handleRenewalChange(
                                    "renewalPeriodUnit",
                                    event.target.value
                                )
                            }
                            options={RENEWAL_PERIOD_UNIT_OPTIONS}
                        />
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <Bell size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Expiration Notifications
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Configure reminders sent to the vehicle's operator and all admins before a vehicle's registration expires.
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <Switch
                        id="expiration-notifications-enabled"
                        name="enabled"
                        label="Enable expiration notifications"
                        helperText="Send reminders when a vehicle's registration is nearing expiration."
                        checked={expirationSettings.enabled}
                        onChange={(event) =>
                            handleSwitchChange("enabled", event)
                        }
                    />

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <Input
                            id="first-reminder"
                            name="firstReminderDays"
                            type="number"
                            label="First reminder (days)"
                            min={1}
                            step={1}
                            value={expirationSettings.firstReminderDays ?? 30}
                            onChange={(event) =>
                                handleExpirationNumberChange(
                                    "firstReminderDays",
                                    event.target.value
                                )
                            }
                            helperText="Days before expiry to send the first reminder."
                        />

                        <Input
                            id="second-reminder"
                            name="secondReminderDays"
                            type="number"
                            label="Second reminder (days)"
                            min={1}
                            step={1}
                            value={expirationSettings.secondReminderDays ?? 7}
                            onChange={(event) =>
                                handleExpirationNumberChange(
                                    "secondReminderDays",
                                    event.target.value
                                )
                            }
                            helperText="Days before expiry to send the second reminder."
                        />

                        <Input
                            id="third-reminder"
                            name="thirdReminderDays"
                            type="number"
                            label="Third reminder (days)"
                            min={1}
                            step={1}
                            value={expirationSettings.thirdReminderDays ?? 1}
                            onChange={(event) =>
                                handleExpirationNumberChange(
                                    "thirdReminderDays",
                                    event.target.value
                                )
                            }
                            helperText="Days before expiry to send the final reminder."
                        />
                    </div>

                    <Switch
                        id="notify-on-expired"
                        name="notifyOnExpired"
                        label="Notify on expired"
                        helperText="Send an additional notification once a vehicle's registration has already expired."
                        checked={expirationSettings.notifyOnExpired}
                        onChange={(event) =>
                            handleSwitchChange("notifyOnExpired", event)
                        }
                    />

                    <div className="mt-6 flex justify-end">
                        <Button
                            type="button"
                            onClick={handleSave}
                            loading={saving}
                            disabled={settingsLoading}
                            leftIcon={
                                <Settings2 size={16} />
                            }
                        >
                            Save Registration Settings
                        </Button>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/60">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <Car size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Current Settings
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Read-only overview of the current vehicle registration renewal configuration.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Max Renewals Per Period</h3>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {renewalSettings.maxRenewalsPerPeriod ?? 1}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Max Renewal Attempts</h3>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {renewalSettings.maxAttempts ?? 3}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Renewal Period</h3>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {renewalSettings.renewalPeriodValue ?? 1} {renewalSettings.renewalPeriodUnit ?? "Year"}(s)
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Description</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Operators can directly renew up to {renewalSettings.maxRenewalsPerPeriod ?? 1} vehicle registration(s) per period, or request up to {renewalSettings.maxAttempts ?? 3} renewal attempt(s) from an admin.
                            Each period lasts {renewalSettings.renewalPeriodValue ?? 1} {(renewalSettings.renewalPeriodUnit ?? "Year").toLowerCase()}(s).
                            Admins can renew any vehicle's registration at any time, without restriction.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VehicleRegistrationSettings;
