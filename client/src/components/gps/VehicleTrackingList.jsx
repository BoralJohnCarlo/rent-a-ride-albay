import { memo, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gauge, Power } from "lucide-react";

import Badge from "../common/Badge";
import EmptyState from "../common/EmptyState";
import PillTabs from "../common/PillTabs";
import SearchBar from "../common/SearchBar";
import { VEHICLE_STATUS } from "../../constants/vehicleConstants";
import timeAgo from "../../utils/timeAgo";
import {
    GPS_STATUS,
    GPS_STATUS_LABELS,
    GPS_STATUS_BADGE_VARIANT,
    GPS_LIST_SCOPE,
} from "../../constants/gpsConstants";
import {
    TELEMETRY_SOURCE_LABELS,
    isSimulatedSource,
} from "../../constants/trackerConstants";

// The list opens on vehicles out with a renter (Rented) unless the page
// asks for the whole fleet first - see GPS_LIST_SCOPE.
const SCOPE = GPS_LIST_SCOPE;

const isOnTheRoad = (vehicle) =>
    vehicle?.status === VEHICLE_STATUS.RENTED;

const vehicleLabel = (vehicle) => {
    const name = [vehicle?.brand, vehicle?.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle?.vehicleCode || "Vehicle";
};

const matchesSearch = (vehicle, query) => {
    if (!query.trim()) {
        return true;
    }

    const haystack = [
        vehicle?.brand,
        vehicle?.model,
        vehicle?.vehicleCode,
        vehicle?.plateNumber,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return haystack.includes(query.trim().toLowerCase());
};

const VehicleTrackingRowBase = ({
    entry,
    selected,
    onSelect,
    index = 0,
    noTrackerMessage,
}) => {
    const { vehicle, status } = entry;

    // A heartbeat-only entry (communicating, no position yet) has no
    // coordinates - never render readings for it.
    const telemetry =
        entry.telemetry &&
        entry.telemetry.latitude !== null &&
        entry.telemetry.latitude !== undefined
            ? entry.telemetry
            : null;

    return (
        <motion.button
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{
                duration: 0.18,
                delay: Math.min(index * 0.02, 0.15),
            }}
            type="button"
            onClick={() => onSelect(vehicle._id)}
            className={`
                w-full
                rounded-lg
                border
                px-3
                py-3
                text-left
                transition-all
                duration-200
                ${
                    selected
                        ? "border-blue-500 bg-blue-50 shadow-sm ring-1 ring-blue-500/20 dark:border-blue-500 dark:bg-blue-950/30"
                        : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700 dark:hover:bg-gray-800"
                }
            `}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {vehicleLabel(vehicle)}
                    </p>

                    {vehicle?.plateNumber && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {vehicle.plateNumber}
                        </p>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    {isSimulatedSource(telemetry?.source) && (
                        <Badge variant="purple" size="sm">
                            {TELEMETRY_SOURCE_LABELS[telemetry.source]}
                        </Badge>
                    )}

                    <Badge
                        variant={
                            GPS_STATUS_BADGE_VARIANT[status] || "default"
                        }
                        size="sm"
                        dot
                        pulse={status === GPS_STATUS.LIVE}
                    >
                        {GPS_STATUS_LABELS[status] || "Unknown"}
                    </Badge>
                </div>
            </div>

            {telemetry ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <span className="inline-flex items-center gap-1">
                        <Gauge size={14} />
                        {telemetry.speed === null ||
                        telemetry.speed === undefined
                            ? "N/A"
                            : `${telemetry.speed} km/h`}
                    </span>

                    <span className="inline-flex items-center gap-1">
                        <Power size={14} />
                        {telemetry.ignition === null ||
                        telemetry.ignition === undefined
                            ? "N/A"
                            : telemetry.ignition
                              ? "ON"
                              : "OFF"}
                    </span>

                    <span>{timeAgo(telemetry.receivedAt)}</span>
                </div>
            ) : (
                <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {status === GPS_STATUS.WAITING
                        ? "Tracker assigned - waiting for a GPS position."
                        : noTrackerMessage}
                </p>
            )}
        </motion.button>
    );
};

// Most vehicles' rows are unaffected by any single vehicle's telemetry
// tick - skip re-rendering them.
const isSameTelemetry = (a, b) => {
    if (a === b) {
        return true;
    }

    if (!a || !b) {
        return false;
    }

    return (
        a.speed === b.speed &&
        a.ignition === b.ignition &&
        a.receivedAt === b.receivedAt &&
        a.source === b.source
    );
};

const VehicleTrackingRow = memo(
    VehicleTrackingRowBase,
    (prev, next) =>
        prev.entry.vehicle === next.entry.vehicle &&
        prev.entry.status === next.entry.status &&
        prev.selected === next.selected &&
        prev.onSelect === next.onSelect &&
        prev.noTrackerMessage === next.noTrackerMessage &&
        isSameTelemetry(prev.entry.telemetry, next.entry.telemetry)
);

const VehicleTrackingList = ({
    entries,
    selectedVehicleId,
    onSelectVehicle,
    // When the page owns the search box (admin GPS search pill), pass its
    // text here and the list's own search bar is hidden.
    search: controlledSearch,
    // Partners have a handful of vehicles and want to see all of them
    // first; admins open on the ones out with a renter.
    defaultScope = SCOPE.ON_THE_ROAD,
    noTrackerMessage = "No GPS tracker is assigned to this vehicle.",
    emptyDescription = "There are no vehicles in the fleet yet.",
}) => {
    const [ownSearch, setOwnSearch] = useState("");
    const [scope, setScope] = useState(defaultScope);
    const isControlled = controlledSearch !== undefined;
    const search = isControlled ? controlledSearch : ownSearch;

    const onTheRoadCount = useMemo(
        () =>
            entries.filter((entry) => isOnTheRoad(entry.vehicle)).length,
        [entries]
    );

    const filteredEntries = useMemo(
        () =>
            entries.filter(
                (entry) =>
                    (scope === SCOPE.ALL || isOnTheRoad(entry.vehicle)) &&
                    matchesSearch(entry.vehicle, search)
            ),
        [entries, search, scope]
    );

    if (entries.length === 0) {
        return (
            <EmptyState
                title="No Vehicles"
                description={emptyDescription}
            />
        );
    }

    return (
        <div className="flex h-full flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white/80 p-3 shadow-sm backdrop-blur-xl dark:border-gray-800 dark:bg-gray-900/80">
            <div className="flex justify-center">
                <PillTabs
                    label="Vehicles shown"
                    size="sm"
                    layoutId="gps-vehicle-scope"
                    value={scope}
                    onChange={setScope}
                    countTone="muted"
                    options={[
                        {
                            value: SCOPE.ON_THE_ROAD,
                            label: "On the road",
                            count: onTheRoadCount,
                        },
                        {
                            value: SCOPE.ALL,
                            label: "All vehicles",
                            count: entries.length,
                        },
                    ]}
                />
            </div>

            {!isControlled && (
                <SearchBar
                    value={search}
                    onChange={(event) => setOwnSearch(event.target.value)}
                    placeholder="Search by name or plate..."
                />
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {filteredEntries.length === 0 ? (
                    <p className="px-1 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        {search.trim()
                            ? "No vehicles match your search."
                            : "No vehicles are on the road right now."}
                    </p>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {filteredEntries.map((entry, index) => (
                            <VehicleTrackingRow
                                key={entry.vehicle._id}
                                entry={entry}
                                index={index}
                                selected={
                                    entry.vehicle._id === selectedVehicleId
                                }
                                onSelect={onSelectVehicle}
                                noTrackerMessage={noTrackerMessage}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default VehicleTrackingList;
