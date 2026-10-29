import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AttributionControl,
    MapContainer,
    TileLayer,
    useMap,
} from "react-leaflet";
import { AnimatePresence, motion } from "framer-motion";
import {
    Crosshair,
    History as HistoryIcon,
    Map as MapIcon,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    Satellite,
    ScanSearch,
    SatelliteDish,
} from "lucide-react";

import "leaflet/dist/leaflet.css";

import VehicleMarker from "./VehicleMarker";
import HistoryRoute from "./HistoryRoute";
import PillTabs from "../common/PillTabs";
import useIsDarkTheme from "../../hooks/theme/useIsDarkTheme";
import {
    GPS_STATUS,
    GPS_STATUS_COLORS,
    GPS_ROUTE_COLORS,
    filterValidRoutePoints,
} from "../../constants/gpsConstants";

// Keyless tile sources only, no Google/Mapbox (CARTO's basemaps now need
// an API key - don't switch back to them). Streets is OSM's standard layer,
// recoloured for the dark theme by a CSS filter (gps-map.css); Satellite is
// Esri imagery with Esri's place + road labels on top.
const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const MAP_STYLE = {
    STREETS: "streets",
    SATELLITE: "satellite",
};

const STREETS_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

const SATELLITE_TILES = {
    imagery:
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    roads: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    places:
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    attribution:
        "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
};

const MAP_STYLE_OPTIONS = [
    { value: MAP_STYLE.STREETS, label: "Map", icon: MapIcon },
    { value: MAP_STYLE.SATELLITE, label: "Satellite", icon: Satellite },
];

// Remembered per browser - a viewing preference only.
const MAP_STYLE_STORAGE_KEY = "gps-map-style";

const readStoredMapStyle = () => {
    try {
        const stored = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY);
        return Object.values(MAP_STYLE).includes(stored)
            ? stored
            : MAP_STYLE.STREETS;
    } catch {
        return MAP_STYLE.STREETS;
    }
};

const storeMapStyle = (style) => {
    try {
        window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, style);
    } catch {
        // Storage blocked (private mode etc.) - the choice just won't stick.
    }
};

const DEFAULT_CENTER = { lat: 13.1483, lng: 123.7128 };
const DEFAULT_ZOOM = 13;
const MAX_ZOOM = 19;

// Statuses that can appear on the map - a vehicle without a position
// (Waiting / No Tracker) has no marker, so it's tallied separately.
const LIVE_LEGEND = [
    { status: GPS_STATUS.LIVE, label: "Live" },
    { status: GPS_STATUS.GPS_LOST, label: "GPS lost" },
    { status: GPS_STATUS.OFFLINE, label: "Offline" },
];

const HISTORY_LEGEND = [
    { color: GPS_ROUTE_COLORS.start, label: "Start" },
    { color: GPS_ROUTE_COLORS.end, label: "End" },
    { color: GPS_ROUTE_COLORS.route, label: "Route", line: true },
    { color: GPS_ROUTE_COLORS.played, label: "Replayed", line: true },
];

const GLASS_PANEL =
    "pointer-events-auto border border-gray-200/80 bg-white/90 shadow-lg shadow-gray-900/10 backdrop-blur-xl dark:border-gray-700/80 dark:bg-gray-900/90 dark:shadow-black/40";

const hasValidPosition = (telemetry) =>
    Boolean(
        telemetry &&
            telemetry.latitude !== null &&
            telemetry.latitude !== undefined &&
            telemetry.longitude !== null &&
            telemetry.longitude !== undefined
    );

const fitMapTo = (map, latLngs, maxZoom) => {
    if (!map || latLngs.length === 0) {
        return;
    }

    if (latLngs.length === 1) {
        map.flyTo(latLngs[0], Math.max(map.getZoom(), 15), { duration: 0.6 });
    } else {
        map.flyToBounds(latLngs, {
            padding: [56, 56],
            maxZoom,
            duration: 0.6,
        });
    }
};

/*
 * Fits the map to every known vehicle position exactly once, the first time
 * any position becomes available. Never re-fits afterward, so the admin can
 * pan/zoom freely without the map jumping back on every realtime update.
 */
const FitBoundsOnce = ({ positions }) => {
    const map = useMap();
    const didFitRef = useRef(false);

    useEffect(() => {
        if (didFitRef.current || positions.length === 0) {
            return;
        }

        didFitRef.current = true;

        if (positions.length === 1) {
            map.setView(positions[0], 14);
        } else {
            map.fitBounds(positions, {
                padding: [56, 56],
                maxZoom: 15,
            });
        }
    }, [positions, map]);

    return null;
};

/*
 * Pans to a vehicle only when the admin explicitly selects a different one
 * from the list (id changes) - not on every telemetry update of the
 * already-selected vehicle, so the map doesn't fight the admin's panning.
 * A vehicle picked by clicking its marker (`pickedOnMapRef`) is already on
 * screen; flying to centre it would undo the popup's auto-pan and push the
 * popup off the top of the map.
 */
const FlyToSelected = ({ selectedVehicleId, position, pickedOnMapRef }) => {
    const map = useMap();
    const lastFlownIdRef = useRef(null);

    useEffect(() => {
        if (!selectedVehicleId || !position) {
            return;
        }

        if (lastFlownIdRef.current === selectedVehicleId) {
            return;
        }

        lastFlownIdRef.current = selectedVehicleId;

        if (pickedOnMapRef.current === selectedVehicleId) {
            pickedOnMapRef.current = null;
            return;
        }

        map.flyTo(position, Math.max(map.getZoom(), 15), {
            duration: 0.8,
        });
    }, [selectedVehicleId, position, map, pickedOnMapRef]);

    return null;
};

/*
 * Fits the map to a newly-loaded historical route exactly once per load
 * (keyed on the `points` array reference, which changes only when a fresh
 * "Load Route" response arrives) - playback advancing the marker doesn't
 * touch this array, so it never re-fits mid-playback.
 */
const FitBoundsToRoute = ({ points }) => {
    const map = useMap();
    const firedForRef = useRef(null);

    useEffect(() => {
        if (!points || points.length === 0 || firedForRef.current === points) {
            return;
        }

        firedForRef.current = points;

        const bounds = filterValidRoutePoints(points).map((point) => [
            point.latitude,
            point.longitude,
        ]);

        if (bounds.length === 0) {
            return;
        }

        if (bounds.length === 1) {
            map.setView(bounds[0], 15);
        } else {
            map.fitBounds(bounds, { padding: [56, 56], maxZoom: 16 });
        }
    }, [points, map]);

    return null;
};

const MapControlButton = ({ icon: Icon, label, onClick, disabled = false }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className="flex h-9 w-9 items-center justify-center text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:bg-gray-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white dark:focus-visible:bg-gray-800 dark:disabled:hover:bg-transparent"
    >
        <Icon size={17} strokeWidth={2.2} />
    </button>
);

const LegendSwatch = ({ color, line = false }) =>
    line ? (
        <span
            className="h-1 w-4 rounded-full"
            style={{ backgroundColor: color }}
        />
    ) : (
        <span
            className="h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-900"
            style={{ backgroundColor: color }}
        />
    );

const formatPlaybackTime = (value) =>
    new Date(value).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
    });

const GPSMap = ({
    entries,
    selectedVehicleId,
    onSelectVehicle,
    historyPoints = null,
    playbackIndex = null,
}) => {
    const wrapperRef = useRef(null);
    const [map, setMap] = useState(null);
    const [mapStyle, setMapStyle] = useState(readStoredMapStyle);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const isDark = useIsDarkTheme();

    // Marker clicks are flagged so FlyToSelected leaves the view to the
    // popup's auto-pan. Only flagged when the click changes the selection -
    // otherwise no effect runs to clear the flag, and it would wrongly skip
    // a later list selection of the same vehicle.
    const pickedOnMapRef = useRef(null);
    const selectedIdRef = useRef(selectedVehicleId);

    useEffect(() => {
        selectedIdRef.current = selectedVehicleId;
    }, [selectedVehicleId]);

    const handleMarkerSelect = useCallback(
        (vehicleId) => {
            if (vehicleId !== selectedIdRef.current) {
                pickedOnMapRef.current = vehicleId;
            }

            onSelectVehicle?.(vehicleId);
        },
        [onSelectVehicle]
    );

    const fullscreenSupported =
        typeof document !== "undefined" && Boolean(document.fullscreenEnabled);

    const positions = useMemo(
        () =>
            entries
                .filter((entry) => hasValidPosition(entry.telemetry))
                .map((entry) => [
                    entry.telemetry.latitude,
                    entry.telemetry.longitude,
                ]),
        [entries]
    );

    const statusCounts = useMemo(() => {
        const counts = {};

        entries.forEach((entry) => {
            if (hasValidPosition(entry.telemetry)) {
                counts[entry.status] = (counts[entry.status] || 0) + 1;
            }
        });

        return counts;
    }, [entries]);

    const offMapCount = entries.length - positions.length;

    const routePoints = useMemo(
        () => filterValidRoutePoints(historyPoints),
        [historyPoints]
    );

    const routeLatLngs = useMemo(
        () => routePoints.map((point) => [point.latitude, point.longitude]),
        [routePoints]
    );

    const isHistory = Boolean(historyPoints);
    const playbackPoint =
        isHistory && playbackIndex !== null
            ? routePoints[playbackIndex] || null
            : null;

    const selectedEntry = entries.find(
        (entry) => entry.vehicle._id === selectedVehicleId
    );
    const selectedPosition = hasValidPosition(selectedEntry?.telemetry)
        ? [
              selectedEntry.telemetry.latitude,
              selectedEntry.telemetry.longitude,
          ]
        : null;

    // Leaflet only measures its container on window resize - entering or
    // leaving fullscreen needs an explicit re-measure.
    useEffect(() => {
        const handleChange = () => {
            setIsFullscreen(document.fullscreenElement === wrapperRef.current);
            requestAnimationFrame(() => map?.invalidateSize());
        };

        document.addEventListener("fullscreenchange", handleChange);

        return () =>
            document.removeEventListener("fullscreenchange", handleChange);
    }, [map]);

    const handleMapStyleChange = (style) => {
        setMapStyle(style);
        storeMapStyle(style);
    };

    const handleFitAll = () => {
        if (isHistory && routeLatLngs.length > 0) {
            fitMapTo(map, routeLatLngs, 16);
        } else {
            fitMapTo(map, positions, 15);
        }
    };

    const handleFocusSelected = () => {
        if (map && selectedPosition) {
            map.flyTo(selectedPosition, Math.max(map.getZoom(), 16), {
                duration: 0.6,
            });
        }
    };

    const handleToggleFullscreen = () => {
        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        } else {
            wrapperRef.current?.requestFullscreen?.().catch(() => {});
        }
    };

    const canFit = isHistory ? routeLatLngs.length > 0 : positions.length > 0;
    const darkBasemap = mapStyle === MAP_STYLE.STREETS && isDark;

    return (
        <div
            ref={wrapperRef}
            className={`gps-map relative h-full w-full overflow-hidden bg-gray-200 dark:bg-gray-950 ${
                isFullscreen
                    ? ""
                    : "rounded-2xl border border-gray-200/80 shadow-sm dark:border-gray-800"
            }`}
        >
            <MapContainer
                ref={setMap}
                center={[DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]}
                zoom={DEFAULT_ZOOM}
                maxZoom={MAX_ZOOM}
                style={{ height: "100%", width: "100%" }}
                zoomControl={false}
                attributionControl={false}
            >
                <AttributionControl position="bottomright" prefix={false} />

                {mapStyle === MAP_STYLE.SATELLITE ? (
                    <>
                        <TileLayer
                            key="satellite-imagery"
                            url={SATELLITE_TILES.imagery}
                            attribution={SATELLITE_TILES.attribution}
                            maxNativeZoom={18}
                            maxZoom={MAX_ZOOM}
                        />
                        <TileLayer
                            key="satellite-roads"
                            url={SATELLITE_TILES.roads}
                            maxNativeZoom={18}
                            maxZoom={MAX_ZOOM}
                            opacity={0.85}
                        />
                        <TileLayer
                            key="satellite-places"
                            url={SATELLITE_TILES.places}
                            maxNativeZoom={18}
                            maxZoom={MAX_ZOOM}
                        />
                    </>
                ) : (
                    <TileLayer
                        key="streets"
                        url={STREETS_TILE_URL}
                        attribution={OSM_ATTRIBUTION}
                        className="gps-map-street-tiles"
                        maxZoom={MAX_ZOOM}
                    />
                )}

                <FitBoundsOnce positions={positions} />
                <FlyToSelected
                    selectedVehicleId={selectedVehicleId}
                    position={selectedPosition}
                    pickedOnMapRef={pickedOnMapRef}
                />
                {historyPoints && (
                    <FitBoundsToRoute points={historyPoints} />
                )}

                {entries.map(({ vehicle, telemetry, status }) => (
                    <VehicleMarker
                        key={vehicle._id}
                        vehicle={vehicle}
                        telemetry={telemetry}
                        status={status}
                        selected={vehicle._id === selectedVehicleId}
                        onSelect={handleMarkerSelect}
                    />
                ))}

                {historyPoints && (
                    <HistoryRoute
                        points={historyPoints}
                        playbackIndex={playbackIndex}
                        darkBasemap={darkBasemap}
                    />
                )}
            </MapContainer>

            {/* Overlays sit outside MapContainer, so clicks on them never
                reach the map; the layer itself ignores the pointer so the
                map stays draggable between them. */}
            <div className="pointer-events-none absolute inset-0 z-1000">
                <div className="absolute top-3 left-3 flex flex-col items-start gap-2">
                    <div className="pointer-events-auto">
                        <PillTabs
                            label="Map style"
                            size="xs"
                            layoutId="gps-map-style-pill"
                            value={mapStyle}
                            onChange={handleMapStyleChange}
                            options={MAP_STYLE_OPTIONS}
                        />
                    </div>

                    <AnimatePresence>
                        {playbackPoint && (
                            <motion.div
                                key="playback-chip"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                className={`w-52 overflow-hidden rounded-xl ${GLASS_PANEL}`}
                            >
                                <div className="flex items-center gap-2 px-3 pt-2 pb-1.5">
                                    <HistoryIcon
                                        size={14}
                                        className="shrink-0 text-violet-600 dark:text-violet-400"
                                    />
                                    <span className="text-xs font-semibold tabular-nums text-gray-900 dark:text-white">
                                        {formatPlaybackTime(
                                            playbackPoint.recordedAt
                                        )}
                                    </span>
                                    <span className="ml-auto text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                                        {typeof playbackPoint.speed === "number"
                                            ? `${playbackPoint.speed} km/h`
                                            : "N/A"}
                                    </span>
                                </div>

                                <div className="h-1 bg-gray-100 dark:bg-gray-800">
                                    <div
                                        className="h-full bg-violet-600 transition-[width] duration-300 dark:bg-violet-400"
                                        style={{
                                            width: `${
                                                routePoints.length > 1
                                                    ? (playbackIndex /
                                                          (routePoints.length -
                                                              1)) *
                                                      100
                                                    : 100
                                            }%`,
                                        }}
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <div
                        className={`flex flex-col divide-y divide-gray-200/80 overflow-hidden rounded-xl dark:divide-gray-700/80 ${GLASS_PANEL}`}
                    >
                        <MapControlButton
                            icon={Plus}
                            label="Zoom in"
                            onClick={() => map?.zoomIn()}
                            disabled={!map}
                        />
                        <MapControlButton
                            icon={Minus}
                            label="Zoom out"
                            onClick={() => map?.zoomOut()}
                            disabled={!map}
                        />
                    </div>

                    <div
                        className={`flex flex-col divide-y divide-gray-200/80 overflow-hidden rounded-xl dark:divide-gray-700/80 ${GLASS_PANEL}`}
                    >
                        <MapControlButton
                            icon={ScanSearch}
                            label={isHistory ? "Fit the whole route" : "Show all vehicles"}
                            onClick={handleFitAll}
                            disabled={!canFit}
                        />
                        <MapControlButton
                            icon={Crosshair}
                            label="Go to the selected vehicle"
                            onClick={handleFocusSelected}
                            disabled={!selectedPosition}
                        />
                        {fullscreenSupported && (
                            <MapControlButton
                                icon={isFullscreen ? Minimize2 : Maximize2}
                                label={isFullscreen ? "Exit full screen" : "Full screen"}
                                onClick={handleToggleFullscreen}
                            />
                        )}
                    </div>
                </div>

                <div
                    className={`absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-xl px-3 py-2 sm:max-w-[65%] ${GLASS_PANEL}`}
                >
                    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                        {isHistory
                            ? HISTORY_LEGEND.map(({ color, label, line }) => (
                                  <span
                                      key={label}
                                      className="inline-flex items-center gap-1.5"
                                  >
                                      <LegendSwatch color={color} line={line} />
                                      {label}
                                  </span>
                              ))
                            : LIVE_LEGEND.map(({ status, label }) => (
                                  <span
                                      key={status}
                                      className="inline-flex items-center gap-1.5"
                                  >
                                      <LegendSwatch
                                          color={GPS_STATUS_COLORS[status]}
                                      />
                                      {label}
                                      <span className="tabular-nums text-gray-400 dark:text-gray-500">
                                          {statusCounts[status] || 0}
                                      </span>
                                  </span>
                              ))}
                    </div>

                    {!isHistory && offMapCount > 0 && (
                        <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                            {offMapCount} vehicle{offMapCount === 1 ? "" : "s"}{" "}
                            without a position
                        </div>
                    )}
                </div>

                <AnimatePresence>
                    {positions.length === 0 && !isHistory && (
                        <motion.div
                            key="no-positions"
                            initial={{ opacity: 0, scale: 0.96 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 flex items-center justify-center p-6"
                        >
                            <div
                                className={`flex max-w-xs flex-col items-center gap-2 rounded-2xl px-5 py-4 text-center ${GLASS_PANEL}`}
                            >
                                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                    <SatelliteDish size={20} />
                                </span>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                    No live positions yet
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Vehicles appear here as soon as their
                                    trackers report a GPS position.
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default GPSMap;
