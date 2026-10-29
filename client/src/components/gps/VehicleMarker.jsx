import { memo, useMemo } from "react";
import { Marker, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import {
    BatteryMedium,
    Car,
    Clock,
    Gauge,
    Power,
    Satellite,
} from "lucide-react";

import Badge from "../common/Badge";
import timeAgo from "../../utils/timeAgo";
import {
    GPS_STATUS,
    GPS_STATUS_COLORS,
    GPS_STATUS_LABELS,
    GPS_STATUS_BADGE_VARIANT,
} from "../../constants/gpsConstants";
import {
    TELEMETRY_SOURCE_LABELS,
    isSimulatedSource,
} from "../../constants/trackerConstants";

// Icon box is larger than the badge itself to leave room for the heading
// arrow, the live ping ring and the selected halo.
const ICON_BOX = 60;
const BADGE_SIZE = 36;
const SELECTED_BADGE_SIZE = 42;
const ARROW_WIDTH = 14;
const ARROW_HEIGHT = 10;

const statusColor = (status) =>
    GPS_STATUS_COLORS[status] || GPS_STATUS_COLORS[GPS_STATUS.NO_TRACKER];

const buildVehicleIcon = (status, heading, selected) => {
    const color = statusColor(status);
    const isLive = status === GPS_STATUS.LIVE;
    const isOffline = status === GPS_STATUS.OFFLINE;
    const size = selected ? SELECTED_BADGE_SIZE : BADGE_SIZE;
    const badgeTop = (ICON_BOX - size) / 2;

    // Only a live position's heading means anything - a stale one would
    // point the arrow somewhere the vehicle may no longer be facing.
    const showHeading = isLive && typeof heading === "number";

    // The car glyph stays upright; only the arrow orbiting the badge turns
    // with the heading. The ping ring is Tailwind's shared status-ping
    // keyframe baked into this static HTML - it keeps animating on its own,
    // since Leaflet owns this DOM node directly via divIcon.
    const html = renderToStaticMarkup(
        <div
            style={{
                position: "relative",
                width: ICON_BOX,
                height: ICON_BOX,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isOffline ? 0.8 : 1,
            }}
        >
            {isLive && (
                <span
                    className="animate-status-ping"
                    style={{
                        position: "absolute",
                        width: size,
                        height: size,
                        borderRadius: "9999px",
                        background: color,
                    }}
                />
            )}

            {showHeading && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        transform: `rotate(${heading}deg)`,
                    }}
                >
                    <svg
                        width={ARROW_WIDTH}
                        height={ARROW_HEIGHT}
                        viewBox="0 0 14 10"
                        style={{
                            position: "absolute",
                            top: badgeTop - ARROW_HEIGHT + 2,
                            left: (ICON_BOX - ARROW_WIDTH) / 2,
                            overflow: "visible",
                        }}
                    >
                        <path
                            d="M7 0 L13 9 L7 6.5 L1 9 Z"
                            fill={color}
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
            )}

            <div
                style={{
                    position: "relative",
                    width: size,
                    height: size,
                    borderRadius: "9999px",
                    background: `linear-gradient(145deg, color-mix(in srgb, ${color} 70%, white), ${color})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2.5px solid white",
                    boxShadow: selected
                        ? "0 0 0 4px rgba(37, 99, 235, 0.45), 0 8px 18px rgba(15, 23, 42, 0.4)"
                        : "0 4px 10px rgba(15, 23, 42, 0.32)",
                }}
            >
                <Car
                    size={selected ? 20 : 17}
                    color="white"
                    strokeWidth={2.4}
                />
            </div>
        </div>
    );

    return L.divIcon({
        html,
        className: "",
        iconSize: [ICON_BOX, ICON_BOX],
        iconAnchor: [ICON_BOX / 2, ICON_BOX / 2],
        popupAnchor: [0, -(size / 2 + 6)],
        tooltipAnchor: [0, size / 2 + 2],
    });
};

const vehicleLabel = (vehicle) => {
    const name = [vehicle?.brand, vehicle?.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle?.vehicleCode || "Vehicle";
};

const formatValue = (value, suffix = "") => {
    if (value === null || value === undefined) {
        return "N/A";
    }

    return `${value}${suffix}`;
};

const formatIgnition = (ignition) => {
    if (ignition === null || ignition === undefined) {
        return "N/A";
    }

    return ignition ? "On" : "Off";
};

const formatGpsFix = (gpsFix) => {
    if (gpsFix === true) {
        return "Connected";
    }

    return gpsFix === false ? "Unavailable" : "Unknown";
};

const PopupStat = ({ icon: Icon, label, value, highlight = false }) => (
    <div className="rounded-lg bg-gray-50 px-2.5 py-1.5 dark:bg-gray-800/70">
        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <Icon size={11} />
            {label}
        </div>

        <div
            className={`text-[13px] font-semibold ${
                highlight
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-900 dark:text-gray-100"
            }`}
        >
            {value}
        </div>
    </div>
);

const VehicleMarker = ({
    vehicle,
    telemetry,
    status,
    selected = false,
    onSelect,
}) => {
    const hasPosition = Boolean(
        telemetry &&
            telemetry.latitude !== null &&
            telemetry.latitude !== undefined &&
            telemetry.longitude !== null &&
            telemetry.longitude !== undefined
    );

    // Rebuilding a divIcon does real DOM/string work (renderToStaticMarkup)
    // and forces Leaflet to swap the marker's icon element - only worth
    // doing when this vehicle's own status/heading/selection actually
    // changed, not on every fleet-wide telemetry tick.
    const icon = useMemo(
        () => buildVehicleIcon(status, telemetry?.heading, selected),
        [status, telemetry?.heading, selected]
    );

    if (!hasPosition) {
        return null;
    }

    const color = statusColor(status);
    const label = vehicleLabel(vehicle);

    return (
        <Marker
            position={[telemetry.latitude, telemetry.longitude]}
            icon={icon}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{
                click: () => onSelect?.(vehicle._id),
            }}
        >
            {/* Leaflet reads `permanent` only at creation - the key remounts
                the label when selection pins/unpins it. */}
            <Tooltip
                key={selected ? "pinned" : "hover"}
                direction="bottom"
                permanent={selected}
                opacity={1}
                className="gps-map-tooltip"
            >
                {label}
                {vehicle?.plateNumber && (
                    <span className="gps-map-tooltip-sub">
                        {vehicle.plateNumber}
                    </span>
                )}
            </Tooltip>

            {/* Kept compact so it fits short maps; the padding pans it clear
                of GPSMap's style toggle (top) and buttons (right). */}
            <Popup
                className="gps-map-popup"
                minWidth={240}
                maxWidth={240}
                autoPanPaddingTopLeft={[12, 48]}
                autoPanPaddingBottomRight={[60, 12]}
            >
                <div className="w-60">
                    <div className="flex items-center gap-2.5 px-3.5 pt-3.5 pr-9">
                        <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                                backgroundColor: `${color}1f`,
                                color,
                            }}
                        >
                            <Car size={18} strokeWidth={2.2} />
                        </span>

                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {label}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {vehicle?.plateNumber && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {vehicle.plateNumber}
                                    </span>
                                )}

                                <Badge
                                    variant={
                                        GPS_STATUS_BADGE_VARIANT[status] ||
                                        "default"
                                    }
                                    size="sm"
                                    dot
                                    pulse={status === GPS_STATUS.LIVE}
                                >
                                    {GPS_STATUS_LABELS[status] || "Unknown"}
                                </Badge>

                                {isSimulatedSource(telemetry.source) && (
                                    <Badge variant="purple" size="sm">
                                        {
                                            TELEMETRY_SOURCE_LABELS[
                                                telemetry.source
                                            ]
                                        }
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 px-3.5 pt-3 pb-3">
                        <PopupStat
                            icon={Gauge}
                            label="Speed"
                            value={formatValue(telemetry.speed, " km/h")}
                        />
                        <PopupStat
                            icon={Power}
                            label="Ignition"
                            value={formatIgnition(telemetry.ignition)}
                            highlight={telemetry.ignition === true}
                        />
                        <PopupStat
                            icon={Satellite}
                            label="GPS"
                            value={formatGpsFix(telemetry.gpsFix)}
                        />
                        <PopupStat
                            icon={BatteryMedium}
                            label="Battery"
                            value={formatValue(telemetry.batteryLevel, "%")}
                        />
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/60 px-3.5 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                        <span className="inline-flex items-center gap-1">
                            <Clock size={12} />
                            {timeAgo(telemetry.receivedAt)}
                        </span>

                        <span className="font-mono tabular-nums">
                            {Number(telemetry.latitude).toFixed(5)},{" "}
                            {Number(telemetry.longitude).toFixed(5)}
                        </span>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
};

// A fleet-wide telemetry tick updates the `entries` array reference for
// every vehicle's parent, but most vehicles' own data hasn't changed - skip
// re-rendering (and rebuilding the Leaflet icon) unless it actually has.
const isSameTelemetry = (a, b) => {
    if (a === b) {
        return true;
    }

    if (!a || !b) {
        return false;
    }

    return (
        a.latitude === b.latitude &&
        a.longitude === b.longitude &&
        a.speed === b.speed &&
        a.heading === b.heading &&
        a.ignition === b.ignition &&
        a.batteryLevel === b.batteryLevel &&
        a.gpsFix === b.gpsFix &&
        a.receivedAt === b.receivedAt &&
        a.source === b.source
    );
};

const arePropsEqual = (prev, next) =>
    prev.vehicle === next.vehicle &&
    prev.status === next.status &&
    prev.selected === next.selected &&
    prev.onSelect === next.onSelect &&
    isSameTelemetry(prev.telemetry, next.telemetry);

export default memo(VehicleMarker, arePropsEqual);
