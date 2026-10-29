import { getEffectiveDailyRate } from "./vehicleDiscount";

const getPrimaryImage = (images = []) => {
    if (!Array.isArray(images) || images.length === 0) {
        return null;
    }

    return (
        images.find((image) => image?.isPrimary)?.url ??
        images[0]?.url ??
        images[0] ??
        null
    );
};

const getVehicleCardData = (vehicle = {}) => {
    return {
        id: vehicle._id ?? vehicle.id,

        image: getPrimaryImage(vehicle.images),

        name: [
            vehicle.brand,
            vehicle.model,
        ]
            .filter(Boolean)
            .join(" "),

        brand: vehicle.brand ?? "",

        model: vehicle.model ?? "",

        year: vehicle.year ?? "",

        vehicleCode:
            vehicle.vehicleCode ?? "—",

        plateNumber:
            vehicle.plateNumber ?? "—",

        category:
            vehicle.category?.name ??
            vehicle.category ??
            "Uncategorized",

        vehicleType:
            vehicle.vehicleType ?? "",

        status:
            vehicle.status ??
            "Unknown",

        condition:
            vehicle.condition ?? "",

        featured:
            vehicle.isFeatured ?? false,

        approved:
            vehicle.isApproved ?? false,

        bookingEnabled:
            vehicle.availability
                ?.bookingEnabled ?? false,

        // The vehicle's own rate (admin views).
        dailyRate:
            vehicle.pricing
                ?.dailyRate ?? 0,

        // What a customer pays per day today, after a running discount
        // (Promotions → Discounts); same as dailyRate when there's none.
        effectiveDailyRate:
            getEffectiveDailyRate(vehicle),

        activeDiscount:
            vehicle.activeDiscount ?? null,

        reservationFee:
            vehicle.pricing
                ?.reservationFee ?? 0,

        commission:
            vehicle.commission ?? null,

        transmission:
            vehicle.specifications
                ?.transmission ??
            "—",

        fuelType:
            vehicle.specifications
                ?.fuelType ??
            "—",

        seats:
            vehicle.specifications
                ?.seatingCapacity ??
            "—",

        color:
            vehicle.specifications
                ?.color ??
            "—",

        engine:
            vehicle.specifications
                ?.engine ??
            "—",

        mileage:
            vehicle.metrics
                ?.mileage ??
            0,

        owner:
            [
                vehicle.operator?.firstName,
                vehicle.operator?.lastName,
            ]
                .filter(Boolean)
                .join(" ") || "",

        raw: vehicle,
    };
};

export default getVehicleCardData;