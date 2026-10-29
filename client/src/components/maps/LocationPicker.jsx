import { useMemo } from "react";

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";

import "leaflet/dist/leaflet.css";

import LoadingSpinner from "../common/LoadingSpinner";

const DEFAULT_CENTER = {
    lat: 13.1483,
    lng: 123.7128,
};

const DEFAULT_ZOOM = 13;

const MapClickHandler = ({ onLocationChange }) => {
    useMapEvents({
        click(e) {
            onLocationChange({
                latitude: e.latlng.lat,
                longitude: e.latlng.lng,
            });
        },
    });

    return null;
};

const LocationPicker = ({
    latitude = null,
    longitude = null,
    onLocationChange,
    disabled = false,
    loading = false,
    label = "Location",
    helperText = "Click on the map to select a location.",
}) => {
    const hasCoordinates =
        latitude !== null &&
        latitude !== undefined &&
        longitude !== null &&
        longitude !== undefined;

    const center = useMemo(() => {
        if (hasCoordinates) {
            return {
                lat: Number(latitude),
                lng: Number(longitude),
            };
        }

        return DEFAULT_CENTER;
    }, [latitude, longitude, hasCoordinates]);

    const markerPosition = useMemo(() => {
        if (!hasCoordinates) {
            return null;
        }

        return {
            lat: Number(latitude),
            lng: Number(longitude),
        };
    }, [latitude, longitude, hasCoordinates]);

    return (
        <div className="space-y-2">
            {label && (
                <label
                    className="
                        block
                        text-sm
                        font-semibold
                        tracking-tight
                        text-gray-800
                        dark:text-gray-200
                    "
                >
                    {label}
                </label>
            )}

            <div
                className="
                    overflow-hidden
                    rounded-xl
                    border
                    border-gray-200
                    dark:border-gray-700
                "
                style={{ height: 260 }}
            >
                <div
                    className="
                        relative
                        h-full
                        w-full
                    "
                >
                    <MapContainer
                        center={[center.lat, center.lng]}
                        zoom={DEFAULT_ZOOM}
                        style={{
                            height: "100%",
                            width: "100%",
                        }}
                        zoomControl={true}
                        dragging={!disabled && !loading}
                        scrollWheelZoom={!disabled && !loading}
                        doubleClickZoom={!disabled && !loading}
                        touchZoom={!disabled && !loading}
                    >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    <MapClickHandler
                        onLocationChange={
                            onLocationChange
                        }
                    />

                    {markerPosition && (
                        <Marker
                            position={[
                                markerPosition.lat,
                                markerPosition.lng,
                            ]}
                        />
                    )}
                </MapContainer>

                {loading && (
                    <div
                        className="
                            absolute
                            inset-0
                            flex
                            items-center
                            justify-center
                            bg-white/60
                            dark:bg-gray-900/60
                        "
                    >
                        <LoadingSpinner
                            fullScreen={false}
                            size={24}
                            message=""
                        />
                    </div>
                )}
            </div>
            </div>

            {helperText && (
                <p
                    className="
                        text-sm
                        text-gray-500
                        dark:text-gray-400
                    "
                >
                    {helperText}
                </p>
            )}
        </div>
    );
};

export default LocationPicker;
