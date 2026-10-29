import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import {
    LocateFixed,
    Radio,
    History as HistoryIcon,
    BellRing,
    ShieldCheck,
} from "lucide-react";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import ErrorState from "../../components/common/ErrorState";
import EmptyState from "../../components/common/EmptyState";
import Alert from "../../components/common/Alert";
import Button from "../../components/common/Button";
import PillTabs from "../../components/common/PillTabs";
import PillSearch from "../../components/common/PillSearch";
import GPSMap from "../../components/gps/GPSMap";
import VehicleTrackingList from "../../components/gps/VehicleTrackingList";
import HistoryControls from "../../components/gps/HistoryControls";
import ConnectionIndicator from "../../components/gps/ConnectionIndicator";
import AlertTable from "../../components/tables/AlertTable";

import { getMyFleetTracking } from "../../api/telemetryApi";
import { telemetryReceived } from "../../store/gps";
import useGPS, { normalizeTrackingState } from "../../hooks/gps/useGPS";
import useNowTicker, { latestTimestamp } from "../../hooks/gps/useNowTicker";
import useRouteHistory from "../../hooks/gps/useRouteHistory";
import useSocket from "../../hooks/shared/useSocket";
import useAlerts from "../../hooks/alerts";
import useToast from "../../hooks/toast/useToast";
import {
    getVehicleGpsStatus,
    toDatetimeLocalValue,
    GPS_MODE,
    GPS_LIST_SCOPE,
    GPS_OPERATOR_HISTORY_WINDOW_MS,
    GPS_OPERATOR_HISTORY_WINDOW_DAYS,
} from "../../constants/gpsConstants";
import { ALERT_STATUS } from "../../constants/alertConstants";

const NOW_TICK_MS = 5000;

const SECTION = {
    MAP: "map",
    ALERTS: "alerts",
};

const ALERT_STATUS_TABS = [
    { value: "all", label: "All" },
    { value: ALERT_STATUS.ACTIVE, label: "Active" },
    { value: ALERT_STATUS.RESOLVED, label: "Resolved" },
];

const HISTORY_WINDOW_MESSAGE = `Route history is only available for the last ${GPS_OPERATOR_HISTORY_WINDOW_DAYS} days.`;

/*
 * Mounted once per vehicle for its side effects only: the Socket.IO room
 * subscription. The initial position already came from the fleet request,
 * so the per-vehicle REST seed is skipped.
 */
const VehicleGpsSubscriber = ({ vehicleId }) => {
    useGPS(vehicleId, { seed: false });
    return null;
};

/*
 * Partner Live Tracking - read-only view of the partner's own vehicles.
 * Tracker management stays admin-only, alerts can be marked read but only
 * an admin resolves them, and route history only reaches back
 * GPS_OPERATOR_HISTORY_WINDOW_MS. Renter details are never part of this
 * page's data (see getOperatorFleetTracking on the server).
 */
const Tracking = () => {
    const dispatch = useDispatch();
    const toast = useToast();
    const { connected: socketConnected, error: socketError } = useSocket();
    const byVehicleId = useSelector((state) => state.gps.byVehicleId);

    const {
        alerts,
        loading: alertsLoading,
        error: alertsError,
        getAlerts: refetchAlerts,
        readAlert,
    } = useAlerts();

    const [fleet, setFleet] = useState({
        loading: true,
        error: null,
        entries: [],
    });
    const [section, setSection] = useState(SECTION.MAP);
    const [selectedVehicleId, setSelectedVehicleId] = useState(null);
    const [mode, setMode] = useState(GPS_MODE.LIVE);
    const [vehicleSearch, setVehicleSearch] = useState("");
    const [alertSearch, setAlertSearch] = useState("");
    const [alertStatusFilter, setAlertStatusFilter] = useState("all");

    const now = useNowTicker(NOW_TICK_MS);

    // Recomputed on each clock tick so the History start picker's minimum
    // keeps moving with the partner window.
    const earliestStartMs = now - GPS_OPERATOR_HISTORY_WINDOW_MS;

    const {
        range: historyRange,
        setRange: setHistoryRange,
        history: historyState,
        playback,
        load: handleLoadHistory,
        togglePlayback: handlePlaybackToggle,
        resetPlayback: handlePlaybackReset,
    } = useRouteHistory(selectedVehicleId, mode, {
        earliestStartMs,
        earliestStartMessage: HISTORY_WINDOW_MESSAGE,
    });

    const loadFleet = useCallback(async () => {
        setFleet((current) => ({ ...current, loading: true, error: null }));

        try {
            const response = await getMyFleetTracking();
            const entries = response.data || [];

            entries.forEach(({ trackingState }) => {
                if (trackingState) {
                    dispatch(
                        telemetryReceived(
                            normalizeTrackingState(trackingState)
                        )
                    );
                }
            });

            setFleet({ loading: false, error: null, entries });
        } catch (error) {
            setFleet({
                loading: false,
                error:
                    error.response?.data?.message ||
                    "Unable to load your vehicles.",
                entries: [],
            });
        }
    }, [dispatch]);

    useEffect(() => {
        loadFleet();
        refetchAlerts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadFleet]);

    const vehiclesById = useMemo(() => {
        const map = {};

        fleet.entries.forEach(({ vehicle }) => {
            map[vehicle._id] = vehicle;
        });

        return map;
    }, [fleet.entries]);

    const entries = useMemo(
        () =>
            fleet.entries.map(({ vehicle, tracker }) => {
                const telemetry = byVehicleId[vehicle._id] || null;

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
        [fleet.entries, byVehicleId, now]
    );

    const selectedVehicle = vehiclesById[selectedVehicleId] || null;

    const activeAlertCount = useMemo(
        () =>
            alerts.filter((alert) => alert.status === ALERT_STATUS.ACTIVE)
                .length,
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

            if (!keyword) {
                return true;
            }

            const vehicle = vehiclesById[alert.vehicle];

            return [
                alert.title,
                alert.message,
                vehicle?.brand,
                vehicle?.model,
                vehicle?.plateNumber,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(keyword);
        });
    }, [alerts, alertStatusFilter, alertSearch, vehiclesById]);

    const handleAlertRead = async (alert) => {
        try {
            await readAlert(alert._id).unwrap();
        } catch (err) {
            toast.error(err || "Unable to mark alert as read.");
        }
    };

    const handleAlertSelectVehicle = (vehicleId) => {
        setSelectedVehicleId(vehicleId);
        setMode(GPS_MODE.LIVE);
        setSection(SECTION.MAP);
    };

    const sectionOptions = useMemo(
        () => [
            { value: SECTION.MAP, label: "Map", icon: LocateFixed },
            {
                value: SECTION.ALERTS,
                label: "Alerts",
                icon: BellRing,
                count: activeAlertCount,
            },
        ],
        [activeAlertCount]
    );

    if (fleet.loading && fleet.entries.length === 0) {
        return (
            <LoadingSpinner
                fullScreen={false}
                message="Loading your vehicles..."
            />
        );
    }

    if (fleet.error) {
        return (
            <div className="flex flex-col items-center gap-2">
                <ErrorState
                    title="Unable to load your vehicles"
                    message={fleet.error}
                />
                <Button variant="outline" onClick={loadFleet}>
                    Try again
                </Button>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-6">
            {fleet.entries.map(({ vehicle }) => (
                <VehicleGpsSubscriber
                    key={vehicle._id}
                    vehicleId={vehicle._id}
                />
            ))}

            <div className="flex flex-col items-center gap-3">
                {section === SECTION.MAP ? (
                    <PillSearch
                        value={vehicleSearch}
                        onChange={setVehicleSearch}
                        placeholder="Search your vehicles by name or plate..."
                        label="Search vehicles"
                    />
                ) : (
                    <PillSearch
                        value={alertSearch}
                        onChange={setAlertSearch}
                        placeholder="Search alerts by vehicle or plate..."
                        label="Search alerts"
                    />
                )}

                <PillTabs
                    label="Tracking sections"
                    layoutId="partner-gps-section-pill"
                    value={section}
                    onChange={setSection}
                    options={sectionOptions}
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                    {section === SECTION.MAP ? (
                        <PillTabs
                            label="Map mode"
                            size="sm"
                            layoutId="partner-gps-mode-pill"
                            value={mode}
                            onChange={setMode}
                            options={[
                                { value: GPS_MODE.LIVE, label: "Live", icon: Radio },
                                { value: GPS_MODE.HISTORY, label: "History", icon: HistoryIcon },
                            ]}
                        />
                    ) : (
                        <PillTabs
                            label="Alert status"
                            size="sm"
                            layoutId="partner-gps-alert-status-pill"
                            value={alertStatusFilter}
                            onChange={setAlertStatusFilter}
                            options={ALERT_STATUS_TABS}
                        />
                    )}

                    <ConnectionIndicator />
                </div>

                <p className="inline-flex items-center gap-1.5 text-center text-xs text-gray-500 dark:text-gray-400">
                    <ShieldCheck size={14} className="shrink-0" />
                    Vehicles are tracked for security. Renter details are
                    never shown here.
                </p>
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
                {section === SECTION.MAP && (
                    <motion.div
                        key="map"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        {entries.length === 0 ? (
                            <EmptyState
                                icon={LocateFixed}
                                title="No Vehicles Yet"
                                description="Once your consigned vehicles are live on the platform, they'll appear here."
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
                                                minStart={toDatetimeLocalValue(
                                                    new Date(earliestStartMs)
                                                )}
                                                windowNote={`History goes back ${GPS_OPERATOR_HISTORY_WINDOW_DAYS} days.`}
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
                                            defaultScope={GPS_LIST_SCOPE.ALL}
                                            noTrackerMessage="No GPS tracker installed yet. Contact the Rent-a-Ride team to have one fitted."
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

                {section === SECTION.ALERTS && (
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
                            onSelectVehicle={handleAlertSelectVehicle}
                            partnerView
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tracking;
