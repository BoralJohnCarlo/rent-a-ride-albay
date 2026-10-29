const VEHICLE_TYPE_TO_LICENSE_CODE = {
    Car: "B",
    Motorcycle: "A",
};

const canDriveTransmission = (
    declaredTransmissions,
    vehicleTransmission
) => {
    if (
        !Array.isArray(declaredTransmissions) ||
        declaredTransmissions.length === 0
    ) {
        return true;
    }

    const normalized = declaredTransmissions.map(
        (value) => String(value).toLowerCase()
    );

    if (normalized.includes("manual")) {
        return true;
    }

    const transmission = String(
        vehicleTransmission || ""
    ).toLowerCase();

    return (
        transmission === "automatic" ||
        transmission === "cvt"
    );
};

/*
 * Whether a customer's declared license codes / transmission capabilities
 * cover this vehicle. Missing declarations (no licenseCodes, or a code
 * selected without its transmission array populated) are treated as
 * unrestricted rather than blocked - that's a profile-completeness gap,
 * not something this feature should punish, mirroring how the
 * license-expiration gate treats customers with no license on file.
 */
/*
 * Only an explicit "no license" (hasDriversLicense === false) restricts a
 * customer to with-driver bookings. `null`/`undefined` (never answered -
 * every account that predates this field) is not restricted, matching the
 * same profile-completeness carve-out used everywhere else in this file.
 */
export const customerRequiresDriver = (user) =>
    user?.role === "customer" &&
    user?.hasDriversLicense === false;

export const isVehicleDrivableByCustomer = (
    vehicle,
    user
) => {
    if (!user || user.role !== "customer") {
        return true;
    }

    const licenseCodes = user.licenseCodes;

    if (
        !Array.isArray(licenseCodes) ||
        licenseCodes.length === 0
    ) {
        return true;
    }

    const requiredCode =
        VEHICLE_TYPE_TO_LICENSE_CODE[
            vehicle?.vehicleType
        ];

    if (!requiredCode) {
        return true;
    }

    if (!licenseCodes.includes(requiredCode)) {
        return false;
    }

    const declaredTransmissions =
        vehicle.vehicleType === "Car"
            ? user.carTransmission
            : user.motorcycleTransmission;

    return canDriveTransmission(
        declaredTransmissions,
        vehicle?.specifications?.transmission
    );
};

export default isVehicleDrivableByCustomer;
