import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    CalendarClock,
    IdCard,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

const CustomerSettings = () => {
    const toast = useToast();

    const {
        settings,
        loading: settingsLoading,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const [localSettings, setLocalSettings] = useState({});
    const [saving, setSaving] = useState(false);

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

    const customerBookingSettings = useMemo(
        () =>
            localSettings.customerBookingSettings ?? {
                maxConcurrentBookings: 0,
                licenseRestrictionEnabled: true,
            },
        [localSettings]
    );

    const handleMaxBookingsChange = (value) => {
        setLocalSettings((prev) => ({
            ...prev,
            customerBookingSettings: {
                ...prev.customerBookingSettings,
                maxConcurrentBookings: Math.max(
                    0,
                    Number(value) || 0
                ),
            },
        }));
    };

    const handleToggleLicenseRestriction = (event) => {
        setLocalSettings((prev) => ({
            ...prev,
            customerBookingSettings: {
                ...prev.customerBookingSettings,
                licenseRestrictionEnabled: event.target.checked,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings(localSettings);
            toast.success("Customer settings saved successfully.");
        } catch (error) {
            toast.error(error.message || "Unable to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const maxConcurrentBookings =
        customerBookingSettings.maxConcurrentBookings ?? 0;

    const licenseRestrictionEnabled = Boolean(
        customerBookingSettings.licenseRestrictionEnabled
    );

    if (settingsLoading && !localSettings.customerBookingSettings) {
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                        <CalendarClock size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Concurrent Booking Limit
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Limit how many vehicles a customer can have booked for overlapping dates at the same time.
                        </p>
                    </div>
                </div>

                <div className="max-w-xs">
                    <Input
                        id="max-concurrent-bookings"
                        name="maxConcurrentBookings"
                        type="number"
                        label="Maximum bookings per customer"
                        min={0}
                        step={1}
                        value={maxConcurrentBookings}
                        onChange={(event) =>
                            handleMaxBookingsChange(event.target.value)
                        }
                        helperText={
                            maxConcurrentBookings > 0
                                ? `A customer may hold at most ${maxConcurrentBookings} booking(s) with overlapping dates.`
                                : "Set to 0 for no limit (customers may hold any number of overlapping bookings)."
                        }
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400">
                        <IdCard size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            License Restriction
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Control whether customers must declare what they're licensed to drive, and whether bookings are restricted accordingly.
                        </p>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        licenseRestrictionEnabled
                            ? "border-yellow-200 bg-yellow-50/60 dark:border-yellow-900 dark:bg-yellow-950/20"
                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Enforce license-based booking restriction
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {licenseRestrictionEnabled
                                ? "Enabled — registration asks customers what they're licensed to drive (and their transmission capability), and self-drive bookings are blocked if the customer isn't licensed for that vehicle or has no driver's license on file at all."
                                : "Disabled — registration no longer asks customers what they're licensed to drive, and bookings are not restricted by license category, transmission, or having no license on file."}
                        </p>
                    </div>

                    <Switch
                        checked={licenseRestrictionEnabled}
                        onChange={handleToggleLicenseRestriction}
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

export default CustomerSettings;
