import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    MapPin,
    Route,
    Settings2,
} from "lucide-react";

import Button from "../../../components/common/Button";
import DataTable from "../../../components/tables/DataTable";
import Switch from "../../../components/common/Switch";

import ServiceLocationDialogs from "../../../components/modals/ServiceLocationDialogs";
import DistanceFeeRuleDialogs from "../../../components/modals/DistanceFeeRuleDialogs";

import useServiceLocation from "../../../hooks/serviceLocations/useServiceLocation";
import useDistanceFeeRule from "../../../hooks/distanceFeeRules/useDistanceFeeRule";
import useSettings from "../../../hooks/settings/useSettings";
import useToast from "../../../hooks/toast/useToast";

const formatRange = (rule) => {
    if (!rule) return "";

    const start = rule.minDistanceKm ?? 0;
    const end = rule.maxDistanceKm;

    return end !== undefined && end !== null
        ? `${start} - ${end} km`
        : `${start}+ km`;
};

const ServiceLocations = () => {
    const toast = useToast();

    const {
        serviceLocations,
        loading: locationsLoading,
        error: locationsError,
        getServiceLocations,
        createServiceLocation,
        updateServiceLocation,
        disableServiceLocation,
        enableServiceLocation,
        deleteServiceLocation,
        clearError: clearLocationsError,
    } = useServiceLocation();

    const {
        distanceFeeRules,
        loading: rulesLoading,
        error: rulesError,
        getDistanceFeeRules,
        createDistanceFeeRule,
        updateDistanceFeeRule,
        disableDistanceFeeRule,
        enableDistanceFeeRule,
        deleteDistanceFeeRule,
        clearError: clearRulesError,
    } = useDistanceFeeRule();

    const {
        settings,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const [locationDialog, setLocationDialog] = useState({
        mode: null,
        location: null,
        isOpen: false,
    });
    const [ruleDialog, setRuleDialog] = useState({
        mode: null,
        rule: null,
        isOpen: false,
    });
    /*
     * Kept separate per section (not one shared flag) so submitting a rule
     * or location doesn't also show the unrelated General Settings "Save
     * Changes" button as loading/disabled, and vice versa.
     */
    const [locationSubmitting, setLocationSubmitting] = useState(false);
    const [ruleSubmitting, setRuleSubmitting] = useState(false);
    const [settingsSubmitting, setSettingsSubmitting] = useState(false);
    const [localSettings, setLocalSettings] = useState({});

    useEffect(() => {
        void getServiceLocations();
        void getDistanceFeeRules();
        void getSettings();
    }, [getServiceLocations, getDistanceFeeRules, getSettings]);

    useEffect(() => {
        if (locationsError) {
            toast.error(locationsError);
            clearLocationsError();
        }
    }, [locationsError, toast, clearLocationsError]);

    useEffect(() => {
        if (rulesError) {
            toast.error(rulesError);
            clearRulesError();
        }
    }, [rulesError, toast, clearRulesError]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    useEffect(() => {
        if (settings && Object.keys(settings).length > 0) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const handleLocationOpen = useCallback(
        (mode, location = null) => {
            setLocationDialog({ mode, location, isOpen: true });
        },
        [setLocationDialog]
    );

    const handleLocationClose = () => {
        if (!locationSubmitting) {
            setLocationDialog({ mode: null, location: null, isOpen: false });
        }
    };

    const handleRuleOpen = useCallback(
        (mode, rule = null) => {
            setRuleDialog({ mode, rule, isOpen: true });
        },
        [setRuleDialog]
    );

    const handleRuleClose = () => {
        if (!ruleSubmitting) {
            setRuleDialog({ mode: null, rule: null, isOpen: false });
        }
    };

    const handleLocationSubmit = async (payload) => {
        setLocationSubmitting(true);

        try {
            if (locationDialog.mode === "create") {
                await createServiceLocation(payload);
                toast.success("Service location created successfully.");
            } else if (locationDialog.mode === "edit") {
                await updateServiceLocation({
                    locationId: locationDialog.location._id,
                    locationData: payload,
                });
                toast.success("Service location updated successfully.");
            } else if (locationDialog.mode === "disable") {
                await disableServiceLocation(locationDialog.location._id);
                toast.success("Service location disabled.");
            } else if (locationDialog.mode === "enable") {
                await enableServiceLocation(locationDialog.location._id);
                toast.success("Service location enabled.");
            } else if (locationDialog.mode === "delete") {
                await deleteServiceLocation(locationDialog.location._id);
                toast.success("Service location deleted.");
            }

            handleLocationClose();
            await getServiceLocations();
        } catch (error) {
            toast.error(error.message || "Something went wrong.");
        } finally {
            setLocationSubmitting(false);
        }
    };

    const handleRuleSubmit = async (payload) => {
        setRuleSubmitting(true);

        try {
            if (ruleDialog.mode === "create") {
                await createDistanceFeeRule(payload);
                toast.success("Distance fee rule created successfully.");
            } else if (ruleDialog.mode === "edit") {
                await updateDistanceFeeRule({
                    ruleId: ruleDialog.rule._id,
                    ruleData: payload,
                });
                toast.success("Distance fee rule updated successfully.");
            } else if (ruleDialog.mode === "disable") {
                await disableDistanceFeeRule(ruleDialog.rule._id);
                toast.success("Distance fee rule disabled.");
            } else if (ruleDialog.mode === "enable") {
                await enableDistanceFeeRule(ruleDialog.rule._id);
                toast.success("Distance fee rule enabled.");
            } else if (ruleDialog.mode === "delete") {
                await deleteDistanceFeeRule(ruleDialog.rule._id);
                toast.success("Distance fee rule deleted.");
            }

            handleRuleClose();
            await getDistanceFeeRules();
        } catch (error) {
            toast.error(error.message || "Something went wrong.");
        } finally {
            setRuleSubmitting(false);
        }
    };

    const handleGeneralSave = async () => {
        setSettingsSubmitting(true);

        try {
            await updateSettings(localSettings);
            toast.success("Settings saved successfully.");
        } catch (error) {
            toast.error(error.message || "Something went wrong.");
        } finally {
            setSettingsSubmitting(false);
        }
    };

    const handleToggle = (key) => {
        setLocalSettings((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const locationColumns = useMemo(
        () => [
            {
                key: "name",
                header: "Name",
            },
            {
                key: "address",
                header: "Address",
            },
            {
                key: "city",
                header: "City",
            },
            {
                key: "province",
                header: "Province",
            },
            {
                key: "enabled",
                header: "Status",
                render: (row) =>
                    row.enabled ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Enabled
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Disabled
                        </span>
                    ),
            },
            {
                key: "actions",
                header: "Actions",
                render: (row) => (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleLocationOpen("view", row)}
                        >
                            View
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleLocationOpen("edit", row)}
                        >
                            Edit
                        </Button>
                        {row.enabled ? (
                            <Button
                                type="button"
                                variant="warning"
                                size="sm"
                                onClick={() => handleLocationOpen("disable", row)}
                            >
                                Disable
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="success"
                                size="sm"
                                onClick={() => handleLocationOpen("enable", row)}
                            >
                                Enable
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleLocationOpen("delete", row)}
                        >
                            Delete
                        </Button>
                    </div>
                ),
            },
        ],
        [handleLocationOpen]
    );

    const ruleColumns = useMemo(
        () => [
            {
                key: "range",
                header: "Distance Range",
                render: (row) => formatRange(row),
            },
            {
                key: "pickupFee",
                header: "Pickup Fee",
                render: (row) =>
                    `PHP ${Number(row.pickupFee).toFixed(2)}`,
            },
            {
                key: "returnFee",
                header: "Return Fee",
                render: (row) =>
                    `PHP ${Number(row.returnFee).toFixed(2)}`,
            },
            {
                key: "enabled",
                header: "Status",
                render: (row) =>
                    row.enabled ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Enabled
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            Disabled
                        </span>
                    ),
            },
            {
                key: "actions",
                header: "Actions",
                render: (row) => (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRuleOpen("view", row)}
                        >
                            View
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRuleOpen("edit", row)}
                        >
                            Edit
                        </Button>
                        {row.enabled ? (
                            <Button
                                type="button"
                                variant="warning"
                                size="sm"
                                onClick={() => handleRuleOpen("disable", row)}
                            >
                                Disable
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="success"
                                size="sm"
                                onClick={() => handleRuleOpen("enable", row)}
                            >
                                Enable
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleRuleOpen("delete", row)}
                        >
                            Delete
                        </Button>
                    </div>
                ),
            },
        ],
        [handleRuleOpen]
    );

    const settingItems = useMemo(
        () => [
            {
                key: "allowOnlyDefaultLocation",
                label: "Allow Only Default Location",
                description:
                    "When enabled, customers can only select the default pickup and return location for bookings.",
            },
            {
                key: "enableDistanceFeeCalculation",
                label: "Enable Distance Fee Calculation",
                description:
                    "When enabled, distance-based fees will be automatically calculated for bookings.",
            },
        ],
        []
    );

    return (
        <div className="space-y-8">
            <section className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                            <MapPin size={19} />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Service Locations
                            </h2>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Manage pickup and return locations for vehicle rentals.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={() => handleLocationOpen("create")}
                    >
                        Add Location
                    </Button>
                </div>

                {settings?.enableDistanceFeeCalculation && serviceLocations.some(
                    (location) => location.enabled && (location.latitude == null || location.longitude == null)
                ) && (
                    <p role="alert" className="mb-4 text-sm text-amber-700 dark:text-amber-300">
                        Some enabled locations are missing map coordinates. Add coordinates before customers can book them with distance pricing.
                    </p>
                )}
                <DataTable
                    columns={locationColumns}
                    data={serviceLocations}
                    loading={locationsLoading}
                    getRowId={(row) => row._id}
                />

                <ServiceLocationDialogs
                    mode={locationDialog.mode}
                    location={locationDialog.location}
                    isOpen={locationDialog.isOpen}
                    loading={locationSubmitting}
                    errors={locationsError}
                    onClose={handleLocationClose}
                    onSubmit={handleLocationSubmit}
                />
            </section>

            <section className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                            <Route size={19} />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Distance Fee Rules
                            </h2>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Configure distance-based pickup and return fees.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={() => handleRuleOpen("create")}
                    >
                        Add Rule
                    </Button>
                </div>

                <DataTable
                    columns={ruleColumns}
                    data={distanceFeeRules}
                    loading={rulesLoading}
                    getRowId={(row) => row._id}
                />

                <DistanceFeeRuleDialogs
                    mode={ruleDialog.mode}
                    rule={ruleDialog.rule}
                    isOpen={ruleDialog.isOpen}
                    loading={ruleSubmitting}
                    errors={rulesError}
                    onClose={handleRuleClose}
                    onSubmit={handleRuleSubmit}
                />
            </section>

            <section className="space-y-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                            <Settings2 size={19} />
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                General Settings
                            </h2>

                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                System-wide preferences and policies.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {settingItems.map((item) => {
                            const enabled = Boolean(
                                localSettings[item.key]
                            );

                            return (
                                <div
                                    key={item.key}
                                    className={`flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors ${
                                        enabled
                                            ? "border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/20"
                                            : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40"
                                    }`}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {item.label}
                                        </p>

                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            {item.description}
                                        </p>
                                    </div>

                                    <Switch
                                        checked={enabled}
                                        onChange={() =>
                                            handleToggle(item.key)
                                        }
                                    />
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button
                            type="button"
                            onClick={handleGeneralSave}
                            loading={settingsSubmitting}
                        >
                            Save Changes
                        </Button>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ServiceLocations;