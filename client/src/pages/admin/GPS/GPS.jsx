import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
    LocateFixed,
    Radio,
    History as HistoryIcon,
    Satellite,
    BellRing,
    Plus,
} from "lucide-react";

import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ErrorState from "../../../components/common/ErrorState";
import EmptyState from "../../../components/common/EmptyState";
import Alert from "../../../components/common/Alert";
import Button from "../../../components/common/Button";
import ConfirmDialog from "../../../components/common/ConfirmDialog";
import PillTabs from "../../../components/common/PillTabs";
import PillSearch from "../../../components/common/PillSearch";
import GPSMap from "../../../components/gps/GPSMap";
import VehicleTrackingList from "../../../components/gps/VehicleTrackingList";
import HistoryControls from "../../../components/gps/HistoryControls";
import ConnectionIndicator from "../../../components/gps/ConnectionIndicator";
import TrackerTable from "../../../components/tables/TrackerTable";
import AlertTable from "../../../components/tables/AlertTable";
import TrackerDialogs from "../../../components/modals/TrackerDialogs";
import TrackerAssignDialog from "../../../components/modals/TrackerAssignDialog";
import TrackerDeviceKeyDialog from "../../../components/modals/TrackerDeviceKeyDialog";

import { getVehicles } from "../../../store/vehicles";
import { getTrackers } from "../../../store/trackers";
import useGPS from "../../../hooks/gps/useGPS";
import useNowTicker, { latestTimestamp } from "../../../hooks/gps/useNowTicker";
import useRouteHistory from "../../../hooks/gps/useRouteHistory";
import useSocket from "../../../hooks/shared/useSocket";
import useTracker from "../../../hooks/trackers";
import useAlerts from "../../../hooks/alerts";
import useToast from "../../../hooks/toast/useToast";
import {
    getVehicleGpsStatus,
    GPS_MODE,
} from "../../../constants/gpsConstants";
import {
    ALERT_TYPE,
    ALERT_TYPE_LABELS,
    ALERT_STATUS,
} from "../../../constants/alertConstants";

const NOW_TICK_MS = 5000;

// Three merged views on one page - was previously three separate admin
// pages/routes (GPS Tracking, GPS Trackers, GPS Alerts).
const GPS_SECTION = {
    MAP: "map",
    TRACKERS: "trackers",
    ALERTS: "alerts",
};

const ALERT_STATUS_TABS = [
    { value: "all", label: "All" },
    { value: ALERT_STATUS.ACTIVE, label: "Active" },
    { value: ALERT_STATUS.RESOLVED, label: "Resolved" },
];

const ALERT_TYPE_OPTIONS = [
    { value: "all", label: "All types" },
    ...Object.values(ALERT_TYPE).map((type) => ({
        value: type,
        label: ALERT_TYPE_LABELS[type],
    })),
];

const INITIAL_TRACKER_FORM_DIALOG = {
    open: false,
    mode: "create",
    tracker: null,
};

const INITIAL_TRACKER_ASSIGN_DIALOG = {
    open: false,
    tracker: null,
};

const INITIAL_TRACKER_DEVICE_KEY_DIALOG = {
    open: false,
    tracker: null,
    regenerated: false,
};

const INITIAL_TRACKER_CONFIRM_DIALOG = {
    open: false,
    action: null,
    tracker: null,
};

// State-changing tracker actions, each confirmed through ConfirmDialog.
const TRACKER_ACTION = {
    UNASSIGN: "unassign",
    DISABLE: "disable",
    ENABLE: "enable",
    REGENERATE_KEY: "regenerate-key",
};

const TRACKER_ACTION_CONFIG = {
    [TRACKER_ACTION.UNASSIGN]: {
        title: "Unassign Tracker",
        message: (tracker) =>
            `Unassign tracker ${tracker.imei} from its vehicle? Its active GPS alerts will be resolved. Telemetry history is kept, and no new telemetry is stored until it is assigned again.`,
        confirmText: "Unassign",
        confirmVariant: "danger",
        success: "Tracker unassigned.",
    },
    [TRACKER_ACTION.DISABLE]: {
        title: "Disable Tracker",
        message: (tracker) =>
            `Disable tracker ${tracker.imei}? It will stop accepting telemetry and won't raise offline alerts. Its active alerts will be resolved. History and assignment are kept.`,
        confirmText: "Disable",
        confirmVariant: "danger",
        success: "Tracker disabled.",
    },
    [TRACKER_ACTION.ENABLE]: {
        title: "Enable Tracker",
        message: (tracker) =>
            `Enable tracker ${tracker.imei}? It will accept telemetry again.`,
        confirmText: "Enable",
        confirmVariant: "primary",
        success: "Tracker enabled.",
    },
    [TRACKER_ACTION.REGENERATE_KEY]: {
        title: "Regenerate Device Key",
        message: (tracker) =>
            `Generate a new device key for ${tracker.imei}? The current key stops working immediately - anything using it (e.g. the simulator) must be updated with the new key.`,
        confirmText: "Regenerate Key",
        confirmVariant: "danger",
        success: "Device key regenerated.",
    },
};

// Mounted once per vehicle purely for its side effects (initial REST fetch
// + Socket.IO room subscription via the existing useGPS/useSocket
// architecture) - the resulting data is read back from the gps Redux slice
// by GPSMap/VehicleTrackingList, not passed through here. Kept mounted
// regardless of which section is active so telemetry stays warm even while
// the Trackers/Alerts tabs are open.
const VehicleGpsSubscriber = ({ vehicleId }) => {
    useGPS(vehicleId);
    return null;
};

const GPS = () => {
    const dispatch = useDispatch();
    const toast = useToast();
    const { connected: socketConnected, error: socketError } =
        useSocket();

    const vehicles = useSelector((state) => state.vehicles.vehicles);
    const vehiclesLoading = useSelector(
        (state) => state.vehicles.loading
    );
    const vehiclesError = useSelector((state) => state.vehicles.error);
    const byVehicleId = useSelector((state) => state.gps.byVehicleId);

    const {
        trackers,
        loading: trackersLoading,
        error: trackersError,
        assignTracker,
        unassignTracker,
        disableTracker,
        enableTracker,
        regenerateTrackerKey,
    } = useTracker();

    const {
        alerts,
        loading: alertsLoading,
        error: alertsError,
        getAlerts: refetchAlerts,
        readAlert,
        resolveAlert,
    } = useAlerts();

    // Supports deep-linking from elsewhere via ?vehicle=<id> - read once on
    // mount only, so it never fights the admin's own later selections.
    const [searchParams] = useSearchParams();
    const [section, setSection] = useState(GPS_SECTION.MAP);
    const [selectedVehicleId, setSelectedVehicleId] = useState(
        () => searchParams.get("vehicle") || null
    );
    const [mode, setMode] = useState(GPS_MODE.LIVE);
    const [vehicleSearch, setVehicleSearch] = useState("");
    const {
        range: historyRange,
        setRange: setHistoryRange,
        history: historyState,
        playback,
        load: handleLoadHistory,
        togglePlayback: handlePlaybackToggle,
        resetPlayback: handlePlaybackReset,
    } = useRouteHistory(selectedVehicleId, mode);

    const [trackerSearch, setTrackerSearch] = useState("");
    const [trackerFormDialog, setTrackerFormDialog] = useState(
        INITIAL_TRACKER_FORM_DIALOG
    );
    const [trackerAssignDialog, setTrackerAssignDialog] = useState(
        INITIAL_TRACKER_ASSIGN_DIALOG
    );
    const [trackerAssigning, setTrackerAssigning] = useState(false);
    const [trackerDeviceKeyDialog, setTrackerDeviceKeyDialog] = useState(
        INITIAL_TRACKER_DEVICE_KEY_DIALOG
    );
    const [trackerConfirmDialog, setTrackerConfirmDialog] = useState(
        INITIAL_TRACKER_CONFIRM_DIALOG
    );
    const [trackerActionLoading, setTrackerActionLoading] = useState(false);

    const [alertSearch, setAlertSearch] = useState("");
    const [alertStatusFilter, setAlertStatusFilter] = useState("all");
    const [alertTypeFilter, setAlertTypeFilter] = useState("all");

    const now = useNowTicker(NOW_TICK_MS);

    useEffect(() => {
        dispatch(getVehicles());
        dispatch(getTrackers());
        refetchAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    const activeVehicles = useMemo(
        () =>
            (vehicles || []).filter(
                (vehicle) => vehicle.status !== "Archived"
            ),
        [vehicles]
    );

    // Full lookup (not just active vehicles) - the Trackers/Alerts tables
    // may reference a vehicle that's since been archived.
    const vehiclesById = useMemo(() => {
        const map = {};

        (vehicles || []).forEach((vehicle) => {
            map[vehicle._id] = vehicle;
        });

        return map;
    }, [vehicles]);

    // Each vehicle's assigned tracker, reusing the existing GET /api/trackers
    // list - never a second tracker API, never a guessed/faked signal. Also
    // supplies Tracker.lastSeenAt (communication) for the GPS status.
    const trackerByVehicleId = useMemo(() => {
        const map = new Map();

        (trackers || []).forEach((tracker) => {
            if (tracker.vehicle) {
                map.set(String(tracker.vehicle), tracker);
            }
        });

        return map;
    }, [trackers]);

    const entries = useMemo(
        () =>
            activeVehicles.map((vehicle) => {
                const telemetry = byVehicleId[vehicle._id] || null;
                const tracker = trackerByVehicleId.get(vehicle._id);

                return {
                    vehicle,
                    telemetry,
                    status: getVehicleGpsStatus(
                        telemetry,
                        now,
                        Boolean(tracker),
                        latestTimestamp(
                            tracker?.lastSeenAt,
                            telemetry?.lastSeenAt
                        )
                    ),
                };
            }),
        [activeVehicles, byVehicleId, now, trackerByVehicleId]
    );

    const selectedVehicle =
        activeVehicles.find(
            (vehicle) => vehicle._id === selectedVehicleId
        ) || null;

    // The tracker list's lastSeenAt is a page-load snapshot; merge in live
    // socket activity (telemetry/heartbeats) for assigned trackers so the
    // Communication column stays current without refetching.
    const liveTrackers = useMemo(
        () =>
            trackers.map((tracker) => {
                const live = tracker.vehicle
                    ? byVehicleId[String(tracker.vehicle)]
                    : null;

                if (!live) {
                    return tracker;
                }

                const liveReceivedAt =
                    live.trackerId === tracker._id ? live.receivedAt : null;

                return {
                    ...tracker,
                    lastSeenAt: latestTimestamp(
                        tracker.lastSeenAt,
                        latestTimestamp(liveReceivedAt, live.lastSeenAt)
                    ),
                };
            }),
        [trackers, byVehicleId]
    );

    const filteredTrackers = useMemo(() => {
        const keyword = trackerSearch.trim().toLowerCase();

        if (!keyword) {
            return liveTrackers;
        }

        return liveTrackers.filter((tracker) => {
            const vehicle = tracker.vehicle
                ? vehiclesById[tracker.vehicle]
                : null;

            const haystack = [
                tracker.imei,
                tracker.model,
                tracker.simNumber,
                vehicle?.brand,
                vehicle?.model,
                vehicle?.plateNumber,
                vehicle?.vehicleCode,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(keyword);
        });
    }, [liveTrackers, vehiclesById, trackerSearch]);

    const handleTrackerCreate = () =>
        setTrackerFormDialog({ open: true, mode: "create", tracker: null });

    const handleTrackerEdit = (tracker) =>
        setTrackerFormDialog({ open: true, mode: "edit", tracker });

    const handleTrackerFormClose = () =>
        setTrackerFormDialog(INITIAL_TRACKER_FORM_DIALOG);

    const handleTrackerRegistered = (createdTracker) => {
        if (createdTracker?.deviceKey) {
            setTrackerDeviceKeyDialog({
                open: true,
                tracker: createdTracker,
                regenerated: false,
            });
        }

        dispatch(getTrackers());
    };

    const openTrackerConfirm = (action) => (tracker) =>
        setTrackerConfirmDialog({ open: true, action, tracker });

    const handleTrackerConfirmClose = () => {
        if (!trackerActionLoading) {
            setTrackerConfirmDialog(INITIAL_TRACKER_CONFIRM_DIALOG);
        }
    };

    const handleTrackerConfirm = async () => {
        const { action, tracker } = trackerConfirmDialog;
        const runAction = {
            [TRACKER_ACTION.UNASSIGN]: unassignTracker,
            [TRACKER_ACTION.DISABLE]: disableTracker,
            [TRACKER_ACTION.ENABLE]: enableTracker,
            [TRACKER_ACTION.REGENERATE_KEY]: regenerateTrackerKey,
        }[action];

        setTrackerActionLoading(true);

        try {
            const result = await runAction(tracker._id).unwrap();

            toast.success(TRACKER_ACTION_CONFIG[action].success);
            setTrackerConfirmDialog(INITIAL_TRACKER_CONFIRM_DIALOG);

            // The new plaintext key goes straight to the one-time dialog via
            // local state - never into Redux. (Alerts resolved by
            // unassign/disable arrive via the alerts:resolved socket event.)
            if (
                action === TRACKER_ACTION.REGENERATE_KEY &&
                result?.data?.deviceKey
            ) {
                setTrackerDeviceKeyDialog({
                    open: true,
                    tracker: result.data,
                    regenerated: true,
                });
            }
        } catch (err) {
            toast.error(err || "Unable to update tracker.");
        } finally {
            setTrackerActionLoading(false);
        }
    };

    const trackerConfirmConfig = trackerConfirmDialog.action
        ? TRACKER_ACTION_CONFIG[trackerConfirmDialog.action]
        : null;

    const handleTrackerAssignOpen = (tracker) =>
        setTrackerAssignDialog({ open: true, tracker });

    const handleTrackerAssignClose = () =>
        setTrackerAssignDialog(INITIAL_TRACKER_ASSIGN_DIALOG);

    const handleTrackerAssignConfirm = async (vehicleId) => {
        setTrackerAssigning(true);

        try {
            await assignTracker(
                trackerAssignDialog.tracker._id,
                vehicleId
            ).unwrap();

            toast.success("Tracker assigned successfully.");
            handleTrackerAssignClose();
        } catch (err) {
            toast.error(err || "Unable to assign tracker.");
        } finally {
            setTrackerAssigning(false);
        }
    };

    const activeAlertCount = useMemo(
        () =>
            alerts.filter(
                (alert) => alert.status === ALERT_STATUS.ACTIVE
            ).length,
        [alerts]
    );

    const filteredAlerts = useMemo(() => {
        const keyword = alertSearch.trim().toLowerCase();

        return alerts.filter((alert) => {
            if (
                alertStatusFilter !== "all" &&
                alert.status !== alertStatusFilter
            ) {
                return false;
            }

            if (
                alertTypeFilter !== "all" &&
                alert.type !== alertTypeFilter
            ) {
                return false;
            }

            if (!keyword) {
                return true;
            }

            const vehicle = vehiclesById[alert.vehicle];

            const haystack = [
                alert.title,
                alert.message,
                ALERT_TYPE_LABELS[alert.type],
                vehicle?.brand,
                vehicle?.model,
                vehicle?.plateNumber,
                vehicle?.vehicleCode,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return haystack.includes(keyword);
        });
    }, [alerts, alertStatusFilter, alertTypeFilter, alertSearch, vehiclesById]);

    const handleAlertRead = async (alert) => {
        try {
            await readAlert(alert._id).unwrap();
        } catch (err) {
            toast.error(err || "Unable to mark alert as read.");
        }
    };

    const handleAlertResolve = async (alert) => {
        try {
            await resolveAlert(alert._id).unwrap();
            toast.success("Alert resolved.");
        } catch (err) {
            toast.error(err || "Unable to resolve alert.");
        }
    };

    // Jump straight to the vehicle on the live map instead of navigating to
    // a separate page - everything now lives on this one screen.
    const handleAlertSelectVehicle = (vehicleId) => {
        setSelectedVehicleId(vehicleId);
        setMode(GPS_MODE.LIVE);
        setSection(GPS_SECTION.MAP);
    };

    const sectionOptions = useMemo(
        () => [
            { value: GPS_SECTION.MAP, label: "Map", icon: LocateFixed },
            {
                value: GPS_SECTION.TRACKERS,
                label: "Trackers",
                icon: Satellite,
            },
            {
                value: GPS_SECTION.ALERTS,
                label: "Alerts",
                icon: BellRing,
                count: activeAlertCount,
            },
        ],
        [activeAlertCount]
    );

    // The centred search above the section pills - each section searches its
    // own list; Alerts also carries its type filter inside the pill.
    const topSearch =
        section === GPS_SECTION.MAP
            ? {
                  value: vehicleSearch,
                  onChange: setVehicleSearch,
                  placeholder: "Search vehicles by name or plate...",
                  label: "Search vehicles",
              }
            : section === GPS_SECTION.TRACKERS
              ? {
                    value: trackerSearch,
                    onChange: setTrackerSearch,
                    placeholder: "Search trackers by Device ID, model, SIM, or vehicle...",
                    label: "Search trackers",
                }
              : {
                    value: alertSearch,
                    onChange: setAlertSearch,
                    placeholder: "Search alerts by vehicle, plate, or alert...",
                    label: "Search alerts",
                    filters: [
                        {
                            value: alertTypeFilter,
                            onChange: setAlertTypeFilter,
                            options: ALERT_TYPE_OPTIONS,
                            label: "Filter by alert type",
                        },
                    ],
                };

    if (vehiclesLoading && activeVehicles.length === 0) {
        return <LoadingSpinner fullScreen={false} message="Loading fleet..." />;
    }

    if (vehiclesError) {
        return (
            <ErrorState
                title="Unable to load vehicles"
                message={vehiclesError}
            />
        );
    }

    return (
        <div className="flex h-full flex-col gap-6">
            {activeVehicles.map((vehicle) => (
                <VehicleGpsSubscriber
                    key={vehicle._id}
                    vehicleId={vehicle._id}
                />
            ))}

            {/* Controls, centred and stepping down in size: search → Map/
                Trackers/Alerts → Live/History or alert status + connection.
                The navbar already names the page, so no title here. */}
            <div className="flex flex-col items-center gap-3">
                <PillSearch {...topSearch} />

                <PillTabs
                    label="GPS sections"
                    layoutId="gps-section-pill"
                    value={section}
                    onChange={setSection}
                    options={sectionOptions}
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                    {section === GPS_SECTION.MAP && (
                        <PillTabs
                            label="Map mode"
                            size="sm"
                            layoutId="gps-mode-pill"
                            value={mode}
                            onChange={setMode}
                            options={[
                                { value: GPS_MODE.LIVE, label: "Live", icon: Radio },
                                { value: GPS_MODE.HISTORY, label: "History", icon: HistoryIcon },
                            ]}
                        />
                    )}

                    {section === GPS_SECTION.ALERTS && (
                        <PillTabs
                            label="Alert status"
                            size="sm"
                            layoutId="gps-alert-status-pill"
                            value={alertStatusFilter}
                            onChange={setAlertStatusFilter}
                            options={ALERT_STATUS_TABS}
                        />
                    )}

                    <AnimatePresence>
                        {section === GPS_SECTION.ALERTS &&
                            activeAlertCount > 0 && (
                                <motion.span
                                    key="active-alert-chip"
                                    initial={{ opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.85 }}
                                    transition={{
                                        type: "spring",
                                        stiffness: 400,
                                        damping: 22,
                                    }}
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400"
                                >
                                    <span className="relative flex h-2 w-2">
                                        <span className="absolute inline-flex h-full w-full animate-status-ping rounded-full bg-amber-500" />
                                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                                    </span>
                                    <BellRing size={16} />
                                    {activeAlertCount} active
                                </motion.span>
                            )}
                    </AnimatePresence>

                    <ConnectionIndicator />
                </div>
            </div>

            <AnimatePresence>
                {!socketConnected && socketError && (
                    <motion.div
                        key="socket-alert"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Alert
                            variant="warning"
                            message="Realtime connection unavailable. Showing last known data - updates will resume automatically once reconnected."
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
                {section === GPS_SECTION.MAP && (
                    <motion.div
                        key="map"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        {activeVehicles.length === 0 ? (
                            <EmptyState
                                icon={LocateFixed}
                                title="No Vehicles"
                                description="There are no vehicles in the fleet yet."
                            />
                        ) : (
                            <>
                                <AnimatePresence>
                                    {mode === GPS_MODE.HISTORY && (
                                        <motion.div
                                            key="history-controls"
                                            initial={{ opacity: 0, y: -8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <HistoryControls
                                                selectedVehicle={selectedVehicle}
                                                range={historyRange}
                                                onRangeChange={setHistoryRange}
                                                onLoad={handleLoadHistory}
                                                loading={historyState.loading}
                                                error={historyState.error}
                                                data={historyState.data}
                                                playback={playback}
                                                onPlaybackToggle={handlePlaybackToggle}
                                                onPlaybackReset={handlePlaybackReset}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
                                    <div className="order-2 min-h-70 lg:order-1 lg:min-h-0">
                                        <VehicleTrackingList
                                            search={vehicleSearch}
                                            entries={entries}
                                            selectedVehicleId={selectedVehicleId}
                                            onSelectVehicle={setSelectedVehicleId}
                                        />
                                    </div>

                                    <div className="order-1 min-h-105 lg:order-2 lg:min-h-0">
                                        <GPSMap
                                            entries={entries}
                                            selectedVehicleId={selectedVehicleId}
                                            onSelectVehicle={setSelectedVehicleId}
                                            historyPoints={
                                                mode === GPS_MODE.HISTORY
                                                    ? historyState.data?.points || null
                                                    : null
                                            }
                                            playbackIndex={
                                                mode === GPS_MODE.HISTORY
                                                    ? playback.index
                                                    : null
                                            }
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </motion.div>
                )}

                {section === GPS_SECTION.TRACKERS && (
                    <motion.div
                        key="trackers"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        <div className="flex justify-end">
                            <Button
                                onClick={handleTrackerCreate}
                                leftIcon={<Plus size={16} />}
                                className="rounded-full!"
                            >
                                Register Tracker
                            </Button>
                        </div>

                        {trackersError && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {trackersError}
                            </p>
                        )}

                        <TrackerTable
                            trackers={filteredTrackers}
                            vehiclesById={vehiclesById}
                            loading={trackersLoading}
                            now={now}
                            onEdit={handleTrackerEdit}
                            onAssign={handleTrackerAssignOpen}
                            onUnassign={openTrackerConfirm(
                                TRACKER_ACTION.UNASSIGN
                            )}
                            onDisable={openTrackerConfirm(
                                TRACKER_ACTION.DISABLE
                            )}
                            onEnable={openTrackerConfirm(
                                TRACKER_ACTION.ENABLE
                            )}
                            onRegenerateKey={openTrackerConfirm(
                                TRACKER_ACTION.REGENERATE_KEY
                            )}
                        />

                        <TrackerDialogs
                            open={trackerFormDialog.open}
                            mode={trackerFormDialog.mode}
                            tracker={trackerFormDialog.tracker}
                            vehicles={activeVehicles}
                            trackers={trackers}
                            onClose={handleTrackerFormClose}
                            onRegistered={handleTrackerRegistered}
                        />

                        <TrackerAssignDialog
                            isOpen={trackerAssignDialog.open}
                            tracker={trackerAssignDialog.tracker}
                            vehicles={activeVehicles}
                            trackers={trackers}
                            loading={trackerAssigning}
                            onClose={handleTrackerAssignClose}
                            onConfirm={handleTrackerAssignConfirm}
                        />

                        <ConfirmDialog
                            isOpen={trackerConfirmDialog.open}
                            onClose={handleTrackerConfirmClose}
                            onConfirm={handleTrackerConfirm}
                            loading={trackerActionLoading}
                            title={trackerConfirmConfig?.title}
                            message={
                                trackerConfirmDialog.tracker
                                    ? trackerConfirmConfig?.message(
                                          trackerConfirmDialog.tracker
                                      )
                                    : ""
                            }
                            confirmText={trackerConfirmConfig?.confirmText}
                            confirmVariant={
                                trackerConfirmConfig?.confirmVariant
                            }
                        />

                        <TrackerDeviceKeyDialog
                            open={trackerDeviceKeyDialog.open}
                            tracker={trackerDeviceKeyDialog.tracker}
                            title={
                                trackerDeviceKeyDialog.regenerated
                                    ? "Device Key Regenerated"
                                    : "Tracker Registered"
                            }
                            notice={
                                trackerDeviceKeyDialog.regenerated
                                    ? "The previous key no longer works - update the simulator's MOCK_TRACKER_KEY."
                                    : null
                            }
                            onClose={() =>
                                setTrackerDeviceKeyDialog(
                                    INITIAL_TRACKER_DEVICE_KEY_DIALOG
                                )
                            }
                        />
                    </motion.div>
                )}

                {section === GPS_SECTION.ALERTS && (
                    <motion.div
                        key="alerts"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        {alertsError && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                {alertsError}
                            </p>
                        )}

                        <AlertTable
                            alerts={filteredAlerts}
                            vehiclesById={vehiclesById}
                            loading={alertsLoading}
                            onRead={handleAlertRead}
                            onResolve={handleAlertResolve}
                            onSelectVehicle={handleAlertSelectVehicle}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GPS;
