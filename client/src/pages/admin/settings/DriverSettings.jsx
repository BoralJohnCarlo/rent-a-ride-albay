import { useEffect, useState } from "react";

import { UserRound } from "lucide-react";
import { DollarSign } from "lucide-react";
import { Motorbike } from "lucide-react";

import Button from "../../../components/common/Button";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";
import { normalizeDriverSettings, buildDriverSettingsPatch } from "../../../utils/driverSettings";

const DRIVER_PRICING_MODE_OPTIONS = [
    { value: "global", label: "Global rate for all drivers" },
    { value: "individual", label: "Individual driver rates" },
];

const DriverSettings = () => {
    const toast = useToast();

    const {
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const [localSettings, setLocalSettings] = useState({});
    const [savedSettings, setSavedSettings] = useState({});
    const [loadState, setLoadState] = useState("loading");
    const [loadAttempt, setLoadAttempt] = useState(0);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let active = true;
        setLoadState("loading");
        getSettings().unwrap().then(
            (response) => {
                if (!active) return;
                const loaded = normalizeDriverSettings(response.data);
                setLocalSettings(loaded);
                setSavedSettings(loaded);
                setLoadState("ready");
            },
            () => { if (active) setLoadState("error"); }
        );
        return () => { active = false; };
    }, [getSettings, loadAttempt]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const handleToggle = (key) => {
        if (loadState !== "ready" || submitting) return;
        setLocalSettings((prev) => ({
            ...prev,
            driverAssignmentSettings: {
                ...prev.driverAssignmentSettings,
                [key]: !prev.driverAssignmentSettings?.[key],
            },
        }));
    };

    // On unless explicitly turned off (older settings don't have it).
    const handleMotorcycleDriversToggle = () => {
        if (loadState !== "ready" || submitting) return;
        setLocalSettings((prev) => ({
            ...prev,
            driverAssignmentSettings: {
                ...prev.driverAssignmentSettings,
                motorcycleDriversEnabled:
                    prev.driverAssignmentSettings
                        ?.motorcycleDriversEnabled === false,
            },
        }));
    };

    const handlePricingChange = (key, value) => {
        if (loadState !== "ready" || submitting) return;
        setLocalSettings((prev) => ({
            ...prev,
            driverPricingSettings: {
                ...prev.driverPricingSettings,
                [key]: value,
            },
        }));
    };

    const handleSave = async () => {
        if (loadState !== "ready" || submitting) return;
        const rate = Number(localSettings.driverPricingSettings?.globalDailyRate ?? 0);
        if (!Number.isFinite(rate) || rate < 0 || rate > 1000000) {
            toast.error("The global driver rate must be a number from 0 to 1,000,000.");
            return;
        }
        const submitted = {
            ...localSettings,
            driverPricingSettings: { ...localSettings.driverPricingSettings, globalDailyRate: rate },
        };
        const patch = buildDriverSettingsPatch(submitted, savedSettings);
        if (!Object.keys(patch).length) {
            toast.success("No changes to save.");
            return;
        }
        setSubmitting(true);

        try {
            const response = await updateSettings(patch).unwrap();
            const refreshed = normalizeDriverSettings(response.data);
            setLocalSettings(refreshed);
            setSavedSettings(refreshed);
            toast.success("Driver settings saved successfully.");
        } catch (error) {
            toast.error((typeof error === "string" ? error : error?.message) || "Something went wrong.");
        } finally {
            setSubmitting(false);
        }
    };

    const requireAdminDriverAssignment = Boolean(
        localSettings.driverAssignmentSettings
            ?.requireAdminDriverAssignment
    );
    const motorcycleDriversEnabled =
        localSettings.driverAssignmentSettings
            ?.motorcycleDriversEnabled !== false;
    const driverPricing = localSettings.driverPricingSettings || {
        mode: "global",
        globalDailyRate: 0,
    };

    if (loadState === "error") {
        return (
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-gray-200 p-6 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-red-600 dark:text-red-400">Unable to load driver settings. Retry before making changes.</p>
                <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Retry</Button>
            </div>
        );
    }
    if (loadState !== "ready") {
        return <p role="status" className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading driver settings…</p>;
    }

    return (
        <fieldset disabled={submitting} className="min-w-0 space-y-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <DollarSign size={19} />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Driver Pricing</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Set the daily fee added to bookings made with a driver.</p>
                    </div>
                </div>
                <div className="mb-5 sm:max-w-sm">
                    <Select
                        name="driverPricingMode"
                        label="Pricing mode"
                        value={driverPricing.mode || "global"}
                        onChange={(event) => handlePricingChange("mode", event.target.value)}
                        options={DRIVER_PRICING_MODE_OPTIONS}
                    />
                </div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:max-w-sm">
                    Global daily rate (PHP)
                    <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={driverPricing.globalDailyRate ?? 0}
                        onChange={(event) => handlePricingChange("globalDailyRate", event.target.value)}
                        className="mt-2 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    />
                </label>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Individual mode uses each driver's daily rate; drivers without one use the global rate. Existing bookings keep their quoted rate.
                </p>
                <div className="mt-6 flex justify-end">
                    <Button type="button" onClick={handleSave} loading={submitting}>Save Changes</Button>
                </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
                        <UserRound size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Driver Assignment
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Control whether customers can select their own driver or if the admin assigns one.
                        </p>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        requireAdminDriverAssignment
                            ? "border-violet-200 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20"
                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Require Admin Driver Assignment
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {requireAdminDriverAssignment
                                ? "Enabled — customers cannot choose a driver during booking. The admin must assign one when approving the booking."
                                : "Disabled — customers can select their preferred driver during booking."}
                        </p>
                    </div>

                    <Switch
                        checked={
                            requireAdminDriverAssignment
                        }
                        onChange={() =>
                            handleToggle(
                                "requireAdminDriverAssignment"
                            )
                        }
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={
                            submitting
                        }
                    >
                        Save Changes
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                        <Motorbike size={19} />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Motorcycle Drivers
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Choose whether customers can book a motorcycle with one of our drivers.
                        </p>
                    </div>
                </div>

                <div
                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                        motorcycleDriversEnabled
                            ? "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                            : "border-orange-200 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/20"
                    }`}
                >
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                            Offer drivers for motorcycles
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {motorcycleDriversEnabled
                                ? "On — customers booking a motorcycle can choose self-drive or with a driver."
                                : "Off — motorcycles are self-drive only: the driver option is hidden when booking one. Bookings already made with a driver are kept."}
                        </p>
                    </div>

                    <Switch
                        checked={motorcycleDriversEnabled}
                        onChange={handleMotorcycleDriversToggle}
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={handleSave}
                        loading={
                            submitting
                        }
                    >
                        Save Changes
                    </Button>
                </div>
            </div>
        </fieldset>
    );
};

export default DriverSettings;
