import { isVehicleBookable } from "../constants/vehicleConstants";

/*
 * Vehicles closest to `vehicle`, best match first. Only the same vehicle
 * type (a car never suggests a motorcycle) and only bookable ones. Points:
 *   category           4    same category
 *   seats              0–3  3 for the same count, 1 less per seat apart
 *   daily price        0–3  falls off linearly, 0 once twice as far apart
 *   transmission       1.5  matters for who can drive it
 *   fuel / brand       0.5  each, tie-breakers
 * Ties go to the better-rated vehicle.
 */
const WEIGHTS = {
    category: 4,
    seats: 3,
    price: 3,
    transmission: 1.5,
    fuelType: 0.5,
    brand: 0.5,
};

const getId = (vehicle) => String(vehicle?._id ?? vehicle?.id ?? "");

const getCategoryKey = (vehicle) => {
    const category = vehicle?.category;

    return String(category?._id ?? category?.name ?? category ?? "");
};

const getRating = (vehicle) => Number(vehicle?.rating?.averageRating) || 0;

const getDailyTotal = (vehicle) =>
    (Number(vehicle?.pricing?.dailyRate) || 0) +
    (Number(vehicle?.pricing?.reservationFee) || 0);

const sameText = (a, b) =>
    Boolean(a) &&
    Boolean(b) &&
    String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

export const scoreVehicleSimilarity = (vehicle, candidate) => {
    let score = 0;

    const categoryKey = getCategoryKey(vehicle);

    if (categoryKey && categoryKey === getCategoryKey(candidate)) {
        score += WEIGHTS.category;
    }

    const seats = Number(vehicle?.specifications?.seatingCapacity);
    const candidateSeats = Number(candidate?.specifications?.seatingCapacity);

    if (seats > 0 && candidateSeats > 0) {
        score += Math.max(0, WEIGHTS.seats - Math.abs(seats - candidateSeats));
    }

    const price = getDailyTotal(vehicle);

    if (price > 0) {
        const gap = Math.abs(price - getDailyTotal(candidate)) / price;

        score += WEIGHTS.price * Math.max(0, 1 - gap);
    }

    const specs = vehicle?.specifications ?? {};
    const candidateSpecs = candidate?.specifications ?? {};

    if (sameText(specs.transmission, candidateSpecs.transmission)) {
        score += WEIGHTS.transmission;
    }

    if (sameText(specs.fuelType, candidateSpecs.fuelType)) {
        score += WEIGHTS.fuelType;
    }

    if (sameText(vehicle?.brand, candidate?.brand)) {
        score += WEIGHTS.brand;
    }

    return score;
};

const getSimilarVehicles = (vehicle, candidates = [], limit = 3) => {
    if (!vehicle) {
        return [];
    }

    const vehicleId = getId(vehicle);

    return candidates
        .filter(
            (candidate) =>
                getId(candidate) !== vehicleId &&
                candidate?.vehicleType === vehicle.vehicleType &&
                isVehicleBookable(candidate)
        )
        .map((candidate) => ({
            candidate,
            score: scoreVehicleSimilarity(vehicle, candidate),
        }))
        .sort(
            (a, b) =>
                b.score - a.score ||
                getRating(b.candidate) - getRating(a.candidate)
        )
        .slice(0, limit)
        .map(({ candidate }) => candidate);
};

export default getSimilarVehicles;
