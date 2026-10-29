import { AnimatePresence, motion } from "framer-motion";
import { Play, Pause, RotateCcw } from "lucide-react";

import DateTimePicker from "../common/DateTimePicker";
import Button from "../common/Button";
import {
    computeRouteSummary,
    GPS_HISTORY_MAX_RANGE_MS,
} from "../../constants/gpsConstants";

const MAX_RANGE_HOURS = GPS_HISTORY_MAX_RANGE_MS / (60 * 60 * 1000);

const formatDuration = (ms) => {
    if (!ms || ms <= 0) {
        return "N/A";
    }

    const totalSeconds = Math.round(ms / 1000);

    if (totalSeconds < 60) {
        return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
    }

    const totalMinutes = Math.round(totalSeconds / 60);

    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    return remainingMinutes > 0
        ? `${hours} hr ${remainingMinutes} min`
        : `${hours} hr`;
};

const vehicleLabel = (vehicle) => {
    const name = [vehicle?.brand, vehicle?.model]
        .filter(Boolean)
        .join(" ");

    return name || vehicle?.vehicleCode || "Vehicle";
};

const HistoryControls = ({
    selectedVehicle,
    range,
    onRangeChange,
    onLoad,
    loading,
    error,
    data,
    playback,
    onPlaybackToggle,
    onPlaybackReset,
    // Earliest selectable start (datetime-local string) - set for partners,
    // whose history only goes back GPS_OPERATOR_HISTORY_WINDOW_MS.
    minStart,
    windowNote,
}) => {
    if (!selectedVehicle) {
        return (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                Select a vehicle from the list to view its route history.
            </div>
        );
    }

    const summary = data ? computeRouteSummary(data.points) : null;

    return (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-40">
                    <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                        Vehicle
                    </p>
                    <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                        {vehicleLabel(selectedVehicle)}
                    </p>
                </div>

                <div className="w-60">
                    <DateTimePicker
                        label="Start"
                        value={range.start}
                        min={minStart || undefined}
                        max={range.end || undefined}
                        onChange={(start) =>
                            onRangeChange({ ...range, start })
                        }
                    />
                </div>

                <div className="w-60">
                    <DateTimePicker
                        label="End"
                        value={range.end}
                        min={range.start || undefined}
                        onChange={(end) =>
                            onRangeChange({ ...range, end })
                        }
                    />
                </div>

                <Button
                    onClick={onLoad}
                    loading={loading}
                    disabled={loading}
                >
                    Load Route
                </Button>

                {data && summary?.pointCount > 0 && (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onPlaybackToggle}
                            aria-label={
                                playback.playing
                                    ? "Pause playback"
                                    : "Play route history"
                            }
                            title={
                                playback.playing
                                    ? "Pause playback"
                                    : "Play route history"
                            }
                        >
                            {playback.playing ? (
                                <Pause size={16} />
                            ) : (
                                <Play size={16} />
                            )}
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onPlaybackReset}
                            aria-label="Reset playback to the start"
                            title="Reset playback to the start"
                        >
                            <RotateCcw size={16} />
                        </Button>
                    </div>
                )}
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500">
                Maximum range: {MAX_RANGE_HOURS} hours.
                {windowNote ? ` ${windowNote}` : ""}
            </p>

            <AnimatePresence>
                {error && (
                    <motion.p
                        key="history-error"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="text-sm text-red-600 dark:text-red-400"
                    >
                        {error}
                    </motion.p>
                )}

                {summary && summary.pointCount > 0 && (
                    <motion.div
                        key="history-summary"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 sm:grid-cols-4 dark:text-gray-300"
                    >
                        <span>
                            Points: <strong>{summary.pointCount}</strong>
                        </span>

                        <span>
                            Duration:{" "}
                            <strong>
                                {formatDuration(summary.durationMs)}
                            </strong>
                        </span>

                        <span>
                            Distance:{" "}
                            <strong>
                                {summary.distanceKm.toFixed(1)} km
                            </strong>
                        </span>

                        <span>
                            Max speed:{" "}
                            <strong>
                                {summary.maxSpeedKmh ?? "N/A"} km/h
                            </strong>
                        </span>
                    </motion.div>
                )}

                {data && summary?.pointCount === 0 && (
                    <motion.p
                        key="history-empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="text-sm text-gray-500 dark:text-gray-400"
                    >
                        No GPS points with a valid fix were found in this
                        range.
                    </motion.p>
                )}
            </AnimatePresence>
        </div>
    );
};

export default HistoryControls;
