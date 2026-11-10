// Inspection appointments are always Albay local time, independent of the host timezone.
export const inspectionInstant = (date, time) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return new Date(NaN);
    const instant = new Date(`${date}T${time}:00+08:00`);
    if (Number.isNaN(instant.getTime()) || new Date(instant.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== date) return new Date(NaN);
    return instant;
};
