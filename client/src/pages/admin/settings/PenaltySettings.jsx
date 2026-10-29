import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    Clock3,
    Inbox,
    Settings2,
    SlidersHorizontal,
} from "lucide-react";

import Button from "../../../components/common/Button";
import Input from "../../../components/common/Input";
import Select from "../../../components/common/Select";
import Switch from "../../../components/common/Switch";

import useSettings from "../../../hooks/settings/useSettings";
import useRental from "../../../hooks/rentals/useRental";
import useToast from "../../../hooks/toast/useToast";
import StackedTable from "../../../components/tables/StackedTable";
import LockedTermsNotice from "../../../components/admin/LockedTermsNotice";

const CHARGING_UNIT_OPTIONS = [
    { value: "Hour", label: "Per Hour" },
    { value: "Day", label: "Per Day" },
];

const RATE_TYPE_OPTIONS = [
    {
        value: "derived",
        label: "Derived from Daily Rate",
    },
    {
        value: "custom",
        label: "Custom Fixed Rate",
    },
    {
        value: "multiplier",
        label: "Multiplier of Daily Rate",
    },
];

const PenaltySettings = () => {
    const toast = useToast();

    const {
        settings,
        loading: settingsLoading,
        error: settingsError,
        getSettings,
        updateSettings,
        clearError: clearSettingsError,
    } = useSettings();

    const {
        rentals = [],
        fetchRentals,
    } = useRental();

    const [saving, setSaving] = useState(false);
    const [localSettings, setLocalSettings] =
        useState({});

    useEffect(() => {
        void getSettings();
        void fetchRentals(true);
    }, [getSettings, fetchRentals]);

    useEffect(() => {
        if (
            settings &&
            Object.keys(settings).length > 0
        ) {
            setLocalSettings(settings);
        }
    }, [settings]);

    useEffect(() => {
        if (settingsError) {
            toast.error(settingsError);
            clearSettingsError();
        }
    }, [settingsError, toast, clearSettingsError]);

    const penaltySettings = useMemo(
        () =>
            localSettings
                .penaltySettings ?? {
                      gracePeriodMinutes: 0,
                      chargingUnit: "Hour",
                      rateType: "derived",
                      customRate: 0,
                      rateMultiplier: 1,
                      maximumCap: 0,
                      autoApply: true,
                  },
        [localSettings]
    );

    const penaltyHistory = useMemo(() => {
        const history = [];

        rentals.forEach((rental) => {
            if (
                rental.penaltyHistory &&
                rental.penaltyHistory.length > 0
            ) {
                rental.penaltyHistory.forEach(
                    (entry) => {
                        history.push({
                            ...entry,
                            rentalCode:
                                rental.rentalCode,
                            bookingCode:
                                rental.booking
                                    ?.bookingCode,
                            customer:
                                rental.customer,
                            vehicle:
                                rental.vehicle,
                            lateReturn:
                                rental.lateReturn,
                        });
                    }
                );
            }
        });

        return history.sort(
            (a, b) =>
                new Date(
                    b.performedAt
                ) -
                new Date(a.performedAt)
        );
    }, [rentals]);

    const handleChange = (field, value) => {
        setLocalSettings((prev) => ({
            ...prev,
            penaltySettings: {
                ...prev.penaltySettings,
                [field]: value,
            },
        }));
    };

    const handleSave = async () => {
        setSaving(true);

        try {
            await updateSettings(localSettings);
            toast.success(
                "Penalty settings saved successfully."
            );
        } catch (error) {
            toast.error(
                error.message ||
                    "Unable to save settings."
            );
        } finally {
            setSaving(false);
        }
    };

    const formatCurrency = (value) => {
        const amount = Number(value);

        if (Number.isNaN(amount)) {
            return "₱0.00";
        }

        return `₱${amount.toLocaleString("en-PH", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;
    };

    const formatDate = (value) => {
        if (!value) {
            return "—";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "—";
        }

        return date.toLocaleDateString("en-PH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getActionLabel = (action) => {
        switch (action) {
            case "waived":
                return "Waived";

            case "adjusted":
                return "Adjusted";

            case "note_added":
                return "Note Added";

            case "applied":
                return "Applied";

            default:
                return action;
        }
    };

    const getActionColor = (action) => {
        switch (action) {
            case "waived":
                return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";

            case "adjusted":
                return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";

            case "note_added":
                return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";

            case "applied":
                return "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300";

            default:
                return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
        }
    };

    const getCustomerName = (customer) => {
        if (!customer) {
            return "—";
        }

        return [
            customer.firstName,
            customer.lastName,
        ]
            .filter(Boolean)
            .join(" ");
    };

    if (settingsLoading && !localSettings.penaltySettings) {
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
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400">
                        <SlidersHorizontal
                            size={19}
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Penalty Configuration
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Set how late returns are calculated and charged.
                        </p>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            Existing bookings use penalty changes only when they are more favorable to the customer.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <Input
                        id="grace-period"
                        name="gracePeriodMinutes"
                        type="number"
                        label="Grace Period (minutes)"
                        min={0}
                        step={1}
                        value={
                            penaltySettings
                                .gracePeriodMinutes ?? 0
                        }
                        onChange={(event) =>
                            handleChange(
                                "gracePeriodMinutes",
                                Number(
                                    event.target
                                        .value
                                ) || 0
                            )
                        }
                        helperText="Minutes of grace before penalty applies. Set to 0 for no grace."
                    />

                    <Select
                        id="charging-unit"
                        name="chargingUnit"
                        label="Charging Unit"
                        value={
                            penaltySettings
                                .chargingUnit || "Hour"
                        }
                        onChange={(event) =>
                            handleChange(
                                "chargingUnit",
                                event.target
                                    .value
                            )
                        }
                        options={
                            CHARGING_UNIT_OPTIONS
                        }
                        helperText="Whether to charge per hour or per day late."
                    />

                    <Select
                        id="rate-type"
                        name="rateType"
                        label="Rate Type"
                        value={
                            penaltySettings.rateType ||
                            "derived"
                        }
                        onChange={(event) =>
                            handleChange(
                                "rateType",
                                event.target
                                    .value
                            )
                        }
                        options={
                            RATE_TYPE_OPTIONS
                        }
                        helperText="How the penalty rate is calculated."
                    />

                    {penaltySettings.rateType ===
                        "custom" && (
                        <Input
                            id="custom-rate"
                            name="customRate"
                            type="number"
                            label={
                                penaltySettings
                                    .chargingUnit ===
                                "Day"
                                    ? "Custom Daily Rate (₱)"
                                    : "Custom Hourly Rate (₱)"
                            }
                            min={0}
                            step={0.01}
                            value={
                                penaltySettings
                                    .customRate ?? 0
                            }
                            onChange={(
                                event
                            ) =>
                                handleChange(
                                    "customRate",
                                    Number(
                                        event
                                            .target
                                            .value
                                    ) || 0
                                )
                            }
                            helperText={
                                penaltySettings
                                    .chargingUnit ===
                                "Day"
                                    ? "Fixed amount charged per day late."
                                    : "Fixed amount charged per hour late."
                            }
                        />
                    )}

                    {penaltySettings.rateType ===
                        "multiplier" && (
                        <Input
                            id="rate-multiplier"
                            name="rateMultiplier"
                            type="number"
                            label="Rate Multiplier"
                            min={0}
                            step={0.1}
                            value={
                                penaltySettings
                                    .rateMultiplier ??
                                    1
                            }
                            onChange={(
                                event
                            ) =>
                                handleChange(
                                    "rateMultiplier",
                                    Number(
                                        event
                                            .target
                                            .value
                                    ) || 1
                                )
                            }
                            helperText={
                                penaltySettings
                                    .chargingUnit ===
                                    "Day"
                                    ? "Daily rate will be multiplied by this value (e.g., 1.5 = 150% of daily rate per day)."
                                    : "Hourly rate will be multiplied by this value (e.g., 1.5 = 150% of hourly rate per hour)."
                            }
                        />
                    )}

                    <Input
                        id="maximum-cap"
                        name="maximumCap"
                        type="number"
                        label="Maximum Cap (₱)"
                        min={0}
                        step={0.01}
                        value={
                            penaltySettings
                                .maximumCap ?? 0
                        }
                        onChange={(event) =>
                            handleChange(
                                "maximumCap",
                                Number(
                                    event
                                        .target
                                        .value
                                ) || 0
                            )
                        }
                        helperText="Maximum penalty amount. Set to 0 for no cap."
                    />

                    <Switch
                        id="auto-apply"
                        name="autoApply"
                        label="Auto-Apply Penalty"
                        helperText={
                            penaltySettings.autoApply
                                ? "Penalties are automatically calculated and applied on vehicle return."
                                : "Penalties must be manually reviewed and applied by admin."
                        }
                        checked={
                            penaltySettings
                                .autoApply ?? true
                        }
                        onChange={(event) =>
                            handleChange(
                                "autoApply",
                                event.target
                                    .checked
                            )
                        }
                    />
                </div>

                <div className="mt-6 flex justify-end">
                    <Button
                        type="button"
                        onClick={handleSave}
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
                        Save Penalty Settings
                    </Button>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                        <Clock3
                            size={19}
                        />
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Penalty History
                        </h2>

                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Track all penalty actions taken across rentals.
                        </p>
                    </div>
                </div>

                {penaltyHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                            <Inbox
                                size={32}
                                className="text-gray-400"
                            />
                        </div>

                        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                            No penalty actions recorded yet.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <StackedTable className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Rental
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Customer
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Action
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Previous
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        New
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Reason
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Performed By
                                    </th>

                                    <th className="pb-3 font-semibold text-gray-500 dark:text-gray-400">
                                        Performed At
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {penaltyHistory.map(
                                    (entry, index) => (
                                        <tr
                                            key={
                                                `${entry.rentalCode}-${entry.action}-${index}`
                                            }
                                            className="
                                                transition-colors
                                                duration-150
                                                hover:bg-gray-50
                                                dark:hover:bg-gray-800/50
                                            "
                                        >
                                            <td className="py-3">
                                                <span className="font-medium text-gray-900 dark:text-white">
                                                    {
                                                        entry.rentalCode
                                                    }
                                                </span>

                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                    {entry.bookingCode}
                                                </span>
                                            </td>

                                            <td className="py-3 text-gray-700 dark:text-gray-300">
                                                {getCustomerName(
                                                    entry
                                                        .customer
                                                )}
                                            </td>

                                            <td className="py-3">
                                                <span
                                                    className={[
                                                        "inline-flex",
                                                        "items-center",
                                                        "rounded-full",
                                                        "px-2.5",
                                                        "py-0.5",
                                                        "text-xs",
                                                        "font-semibold",
                                                        getActionColor(
                                                            entry
                                                                .action
                                                        ),
                                                    ]
                                                        .filter(
                                                            Boolean
                                                        )
                                                        .join(
                                                            " "
                                                        )}
                                                >
                                                    {getActionLabel(
                                                        entry
                                                            .action
                                                    )}
                                                </span>
                                            </td>

                                            <td className="py-3 text-gray-700 dark:text-gray-300">
                                                {formatCurrency(
                                                    entry
                                                        .previousAmount
                                                )}
                                            </td>

                                            <td className="py-3 font-medium text-gray-900 dark:text-white">
                                                {entry.action ===
                                                "waived"
                                                    ? "₱0.00"
                                                    : formatCurrency(
                                                          entry
                                                              .newAmount
                                                      )}
                                            </td>

                                            <td className="py-3 text-gray-600 dark:text-gray-400">
                                                {entry.reason ||
                                                    "—"}
                                            </td>

                                            <td className="py-3 text-gray-700 dark:text-gray-300">
                                                {entry.performedBy
                                                    ? [
                                                          entry
                                                              .performedBy
                                                              .firstName,
                                                          entry
                                                              .performedBy
                                                              .lastName,
                                                      ]
                                                          .filter(
                                                              Boolean
                                                          )
                                                          .join(
                                                              " "
                                                          ) ||
                                                      entry
                                                          .performedBy
                                                          ?.email ||
                                                      "—"
                                                    : "—"}
                                            </td>

                                            <td className="py-3 text-gray-600 dark:text-gray-400">
                                                {formatDate(
                                                    entry
                                                        .performedAt
                                                )}
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </StackedTable>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PenaltySettings;
