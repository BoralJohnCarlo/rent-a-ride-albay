import { readFileSync } from "node:fs";

const feature = JSON.parse(readFileSync(new URL("../data/boundaries/albay.geojson", import.meta.url), "utf8").replace(/^\uFEFF/, ""));
export const BOUNDARY_VERSION = "albay-" + JSON.parse(readFileSync(new URL("../data/boundaries/source.json", import.meta.url), "utf8").replace(/^\uFEFF/, "")).commit;
const polygons = feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates : [feature.geometry.coordinates];

const inRing = (x, y, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
};

// Local equirectangular projection around the fix; distances here are small
// (warning/border tolerance), and no external geocoding is needed at runtime.
export const classifyAlbayPosition = (latitude, longitude, policy) => {
    if (typeof latitude !== "number" || typeof longitude !== "number" ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    const inside = polygons.some(rings => inRing(longitude, latitude, rings[0]) && !rings.slice(1).some(ring => inRing(longitude, latitude, ring)));
    const scaleX = 111195 * Math.cos(latitude * Math.PI / 180), scaleY = 111195;
    let distance = Infinity;
    for (const rings of polygons) for (const ring of rings) for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i - 1][0] - longitude) * scaleX, ay = (ring[i - 1][1] - latitude) * scaleY;
        const bx = (ring[i][0] - longitude) * scaleX, by = (ring[i][1] - latitude) * scaleY;
        const dx = bx - ax, dy = by - ay;
        const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
        distance = Math.min(distance, Math.hypot(ax + t * dx, ay + t * dy));
    }
    return { inside, distanceMeters: distance,
        zone: distance <= policy.bufferMeters ? "border" : !inside ? "outside" :
            distance <= policy.warningDistanceKm * 1000 ? "near" : "inside" };
};
