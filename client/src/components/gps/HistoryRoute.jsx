import { useMemo } from "react";
import { Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Flag, MapPin } from "lucide-react";

import {
    buildRouteSegments,
    filterValidRoutePoints,
    GPS_ROUTE_COLORS as ROUTE_COLORS,
} from "../../constants/gpsConstants";

// The route's outline - light over light/satellite tiles, dark over the dark
// basemap - so the line reads on any background.
const CASING_COLORS = {
    light: "#ffffff",
    dark: "#020617",
};

const buildEndpointIcon = (color, IconComponent) =>
    L.divIcon({
        html: renderToStaticMarkup(
            <div
                style={{
                    width: 30,
                    height: 30,
                    borderRadius: "9999px",
                    background: color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "3px solid white",
                    boxShadow: "0 4px 10px rgba(15, 23, 42, 0.35)",
                }}
            >
                <IconComponent size={14} color="white" strokeWidth={2.6} />
            </div>
        ),
        className: "",
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -17],
    });

// Built once - the icons themselves never change, unlike VehicleMarker's
// per-vehicle color/heading.
const startIcon = buildEndpointIcon(ROUTE_COLORS.start, MapPin);
const endIcon = buildEndpointIcon(ROUTE_COLORS.end, Flag);

const playbackIcon = L.divIcon({
    html: renderToStaticMarkup(
        <div
            style={{
                position: "relative",
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <span
                className="animate-status-ping"
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "9999px",
                    background: ROUTE_COLORS.played,
                }}
            />
            <div
                style={{
                    position: "relative",
                    width: 20,
                    height: 20,
                    borderRadius: "9999px",
                    background: ROUTE_COLORS.played,
                    border: "3px solid white",
                    boxShadow: "0 0 0 3px rgba(124, 58, 237, 0.3), 0 4px 10px rgba(15, 23, 42, 0.35)",
                }}
            />
        </div>
    ),
    className: "",
    iconSize: [20, 20],
    iconAnchor: [10, 10],
});

const toLatLngs = (points) =>
    points.map((point) => [point.latitude, point.longitude]);

const formatTimestamp = (value) =>
    new Date(value).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
    });

const EndpointPopup = ({ title, color, point }) => (
    <Popup className="gps-map-popup">
        <div className="flex items-center gap-2.5 py-3 pr-10 pl-4">
            <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
            />
            <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTimestamp(point.recordedAt)}
                </div>
            </div>
        </div>
    </Popup>
);

/*
 * Renders a historical route as one Polyline per gap-free segment (see
 * buildRouteSegments), plus START/END markers and an optional playback
 * marker - visually distinct from the live vehicle markers in
 * VehicleMarker.jsx. During playback the part already replayed is drawn
 * over the route in the playback colour. Never invents coordinates: points
 * without a GPS fix are excluded, not interpolated, and no line is drawn
 * across an outage.
 */
const HistoryRoute = ({ points, playbackIndex = null, darkBasemap = false }) => {
    const segments = useMemo(() => buildRouteSegments(points), [points]);
    const validPoints = useMemo(() => filterValidRoutePoints(points), [points]);

    // The replayed prefix of each segment. Segments are consecutive slices
    // of validPoints, so a running offset maps playbackIndex onto them.
    const playedSegments = useMemo(() => {
        if (playbackIndex === null || playbackIndex <= 0) {
            return [];
        }

        const played = [];
        let offset = 0;

        segments.forEach((segment) => {
            const take = Math.min(segment.length, playbackIndex - offset + 1);

            if (take >= 2) {
                played.push(segment.slice(0, take));
            }

            offset += segment.length;
        });

        return played;
    }, [segments, playbackIndex]);

    if (segments.length === 0) {
        return null;
    }

    const firstPoint = validPoints[0];
    const lastPoint = validPoints[validPoints.length - 1];
    const playbackPoint =
        playbackIndex !== null && validPoints[playbackIndex]
            ? validPoints[playbackIndex]
            : null;
    const casing = darkBasemap ? CASING_COLORS.dark : CASING_COLORS.light;

    return (
        <>
            {segments.map((segment, index) => (
                <Polyline
                    key={`casing-${index}`}
                    positions={toLatLngs(segment)}
                    interactive={false}
                    pathOptions={{
                        color: casing,
                        weight: 9,
                        opacity: 0.9,
                        lineCap: "round",
                        lineJoin: "round",
                    }}
                />
            ))}

            {segments.map((segment, index) => (
                <Polyline
                    key={`route-${index}`}
                    positions={toLatLngs(segment)}
                    interactive={false}
                    pathOptions={{
                        color: ROUTE_COLORS.route,
                        weight: 5,
                        opacity: 0.9,
                        lineCap: "round",
                        lineJoin: "round",
                    }}
                />
            ))}

            {playedSegments.map((segment, index) => (
                <Polyline
                    key={`played-${index}`}
                    positions={toLatLngs(segment)}
                    interactive={false}
                    pathOptions={{
                        color: ROUTE_COLORS.played,
                        weight: 5,
                        opacity: 1,
                        lineCap: "round",
                        lineJoin: "round",
                    }}
                />
            ))}

            <Marker
                position={[firstPoint.latitude, firstPoint.longitude]}
                icon={startIcon}
            >
                <EndpointPopup
                    title="Start"
                    color={ROUTE_COLORS.start}
                    point={firstPoint}
                />
            </Marker>

            {lastPoint !== firstPoint && (
                <Marker
                    position={[lastPoint.latitude, lastPoint.longitude]}
                    icon={endIcon}
                >
                    <EndpointPopup
                        title="End"
                        color={ROUTE_COLORS.end}
                        point={lastPoint}
                    />
                </Marker>
            )}

            {playbackPoint && (
                <Marker
                    position={[
                        playbackPoint.latitude,
                        playbackPoint.longitude,
                    ]}
                    icon={playbackIcon}
                    zIndexOffset={1000}
                    interactive={false}
                />
            )}
        </>
    );
};

export default HistoryRoute;
