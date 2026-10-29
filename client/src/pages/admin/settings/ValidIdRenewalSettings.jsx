import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Settings2,
    Users,
    Clock3,
    Bell,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

const RENEWAL_PERIOD_OPTIONS = [
    { value: 1, label: "1 Year" },
    { value: 2, label: "2 Years" },
    { value: 3, label: "3 Years" },
    { value: 4, label: "4 Years" },
    { value: 5, label: "5 Years" },
];

const ValidIdRenewalSettings = () => {
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

    const validIdRenewalSettings = useMemo(
        () =>
            localSettings
                .validIdRenewalSettings ?? {
                    maxUploadsPerYear: 1,
                    renewalPeriodYears: 1,
                    maxAttempts: 3,
                },
        [localSettings]
    );

    const validIdExpirationSettings = useMemo(
        () =>
            localSettings.validIdExpirationSettings ?? {
                enabled: false,
                firstReminderDays: 30,
                secondReminderDays: 7,
                thirdReminderDays: 1,
                notifyOnExpired: false,
            },
        [localSettings]
    );

    const handleSwitchChange = (field, event) => {
        setLocalSettings((prev) => ({
            ...prev,
            validIdExpirationSettings: {
                ...prev.validIdExpirationSettings,
                [field]: event.target.checked,
            },
        }));
    };

    const handleExpirationNumberChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            validIdExpirationSettings: {
                ...prev.validIdExpirationSettings,
                [field]: Math.max(1, Number(value) || 1),
            },
        }));
    };

    const handleChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            validIdRenewalSettings: {
                ...prev.validIdRenewalSettings,
                [field]: value,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings(localSettings);
            toast.success("Valid ID renewal settings saved successfully.");
        } catch (error) {
            toast.error(
                error.message || "Unable to save settings."
            );
        } finally {
            setSaving(false);
        }
    };

    if (settingsLoading && !localSettings.validIdRenewalSettings) {
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                        <Clock3 size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Renewal Configuration
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Set how many times users can renew their valid ID per year and the renewal period.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <Input
                        id="max-uploads"
                        name="maxUploadsPerYear"
                        type="number"
                        label="Maximum Renewals Per Year"
                        min={1}
                        step={1}
                        value={validIdRenewalSettings.maxUploadsPerYear ?? 1}
                        onChange={(event) =>
                            handleChange(
                                "maxUploadsPerYear",
                                Number(event.target.value) || 1
                            )
                        }
                        helperText="Maximum number of times a user can directly upload a renewed ID per year."
                    />

                    <Input
                        id="max-attempts"
                        name="maxAttempts"
                        type="number"
                        label="Maximum Renewal Attempts"
                        min={1}
                        step={1}
                        value={validIdRenewalSettings.maxAttempts ?? 3}
                        onChange={(event) =>
                            handleChange(
                                "maxAttempts",
                                Number(event.target.value) || 1
                            )
                        }
                        helperText="Maximum number of renewal attempts a user can request per period."
                    />

                    <Select
                        id="renewal-period"
                        name="renewalPeriodYears"
                        label="Renewal Period"
                        value={validIdRenewalSettings.renewalPeriodYears || 1}
                        onChange={(event) =>
                            handleChange(
                                "renewalPeriodYears",
                                Number(event.target.value)
                            )
                        }
                        options={RENEWAL_PERIOD_OPTIONS}
                        helperText="How long a renewal attempt is valid (in years)."
                    />
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
                            Configure reminders sent to users before their valid ID expires.
                        </p>
                    </div>
                </div>

                <div className="space-y-6">
                    <Switch
                        id="expiration-notifications-enabled"
                        name="enabled"
                        label="Enable expiration notifications"
                        helperText="Send reminder emails to users when their valid ID is nearing expiration."
                        checked={validIdExpirationSettings.enabled}
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
                            value={validIdExpirationSettings.firstReminderDays ?? 30}
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
                            value={validIdExpirationSettings.secondReminderDays ?? 7}
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
                            value={validIdExpirationSettings.thirdReminderDays ?? 1}
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
                        helperText="Send an additional notification when a valid ID has already expired."
                        checked={validIdExpirationSettings.notifyOnExpired}
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
                            Save Renewal Settings
                        </Button>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/60">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <Users size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Current Settings
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Read-only overview of the current valid ID renewal configuration.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Max Renewals Per Year</h3>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {validIdRenewalSettings.maxUploadsPerYear ?? 1}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Max Renewal Attempts</h3>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {validIdRenewalSettings.maxAttempts ?? 3}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Renewal Period</h3>
                            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {validIdRenewalSettings.renewalPeriodYears ?? 1} Year(s)
                            </p>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Description</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Users can directly upload up to {validIdRenewalSettings.maxUploadsPerYear ?? 1} renewed ID(s) per year, or request up to {validIdRenewalSettings.maxAttempts ?? 3} renewal attempt(s) per period.
                            Each renewal is valid for {validIdRenewalSettings.renewalPeriodYears ?? 1} year(s) from the time it's granted.
                            Customers can request additional renewal attempts by contacting support.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidIdRenewalSettings;