// Count existing bookings during the requested interval. End events sort
// before starts at the same instant: back-to-back rentals do not overlap.
export const getPeakConcurrentBookings = (bookings, startDate, endDate) => {
    const rangeStart = new Date(startDate).getTime();
    const rangeEnd = new Date(endDate).getTime();
    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) {
        throw new RangeError("A valid booking date range is required.");
    }

    const events = [];
    for (const booking of bookings) {
        const start = Math.max(rangeStart, new Date(booking.startDate).getTime());
        const end = Math.min(rangeEnd, new Date(booking.endDate).getTime());
        if (start < end) events.push([start, 1], [end, -1]);
    }
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    let concurrent = 0;
    let peak = 0;
    for (const [, change] of events) {
        concurrent += change;
        peak = Math.max(peak, concurrent);
    }
    return peak;
};
