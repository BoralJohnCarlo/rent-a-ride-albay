import { useEffect, useMemo, useState } from "react";

import { getVehicleTelemetryHistory } from "../../api/telemetryApi";
import {
    filterValidRoutePoints,
    defaultHistoryRange,
    GPS_MODE,
    GPS_HISTORY_MAX_RANGE_MS,
} from "../../constants/gpsConstants";

const PLAYBACK_STEP_MS = 500;

const EMPTY_HISTORY = { loading: false, error: null, data: null };
const STOPPED_PLAYBACK = { playing: false, index: 0 };

/*
 * Route history + playback for the selected vehicle on a GPS map page
 * (admin and partner). `earliestStartMs` (optional) is the oldest start the
 * caller may request - only pre-validated here; the backend enforces it.
 */
const useRouteHistory = (
    vehicleId,
    mode,
    { earliestStartMs = null, earliestStartMessage = null } = {}
) => {
    const [range, setRange] = useState(defaultHistoryRange);
    const [history, setHistory] = useState(EMPTY_HISTORY);
    const [playback, setPlayback] = useState(STOPPED_PLAYBACK);

    // Switching vehicles invalidates any previously loaded route/playback -
    // a stale route for a different vehicle must never linger on screen.
    useEffect(() => {
        setHistory(EMPTY_HISTORY);
        setPlayback(STOPPED_PLAYBACK);
    }, [vehicleId]);

    // Leaving History mode stops playback rather than letting its interval
    // keep silently ticking in the background while Live is shown.
    useEffect(() => {
        if (mode !== GPS_MODE.HISTORY) {
            setPlayback(STOPPED_PLAYBACK);
        }
    }, [mode]);

    const validPoints = useMemo(
        () => filterValidRoutePoints(history.data?.points),
        [history.data]
    );

    // Simple chronological playback - no scrubber/timeline, just
    // play/pause/reset stepping through the already-loaded route.
    useEffect(() => {
        if (!playback.playing || validPoints.length === 0) {
            return undefined;
        }

        const interval = setInterval(() => {
            setPlayback((current) => {
                if (current.index >= validPoints.length - 1) {
                    return { ...current, playing: false };
                }

                return { ...current, index: current.index + 1 };
            });
        }, PLAYBACK_STEP_MS);

        return () => clearInterval(interval);
    }, [playback.playing, validPoints]);

    const fail = (error) => setHistory({ loading: false, error, data: null });

    const load = async () => {
        if (!vehicleId) {
            return;
        }

        // Catch obviously-invalid ranges before spending a round-trip on
        // them - the backend still re-validates and remains authoritative.
        if (range.start && range.end) {
            const startDate = new Date(range.start);
            const endDate = new Date(range.end);

            if (startDate >= endDate) {
                fail("Start must be before end.");
                return;
            }

            if (
                endDate.getTime() - startDate.getTime() >
                GPS_HISTORY_MAX_RANGE_MS
            ) {
                fail(
                    `Date range cannot exceed ${GPS_HISTORY_MAX_RANGE_MS / (60 * 60 * 1000)} hours.`
                );
                return;
            }
        }

        if (
            earliestStartMs &&
            range.start &&
            new Date(range.start).getTime() < earliestStartMs
        ) {
            fail(earliestStartMessage || "Start is too far in the past.");
            return;
        }

        setHistory({ loading: true, error: null, data: null });
        setPlayback(STOPPED_PLAYBACK);

        try {
            const response = await getVehicleTelemetryHistory(vehicleId, {
                start: range.start
                    ? new Date(range.start).toISOString()
                    : undefined,
                end: range.end ? new Date(range.end).toISOString() : undefined,
            });

            setHistory({ loading: false, error: null, data: response.data });
        } catch (error) {
            fail(
                error.response?.data?.message ||
                    "Unable to load route history."
            );
        }
    };

    const togglePlayback = () => {
        setPlayback((current) => {
            if (!current.playing && current.index >= validPoints.length - 1) {
                return { playing: true, index: 0 };
            }

            return { ...current, playing: !current.playing };
        });
    };

    const resetPlayback = () => setPlayback(STOPPED_PLAYBACK);

    return {
        range,
        setRange,
        history,
        playback,
        load,
        togglePlayback,
        resetPlayback,
    };
};

export default useRouteHistory;
