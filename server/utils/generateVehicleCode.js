import Vehicle from "../models/Vehicle.js";

import { VEHICLE_CODE_PREFIX } from "../constants/vehicleConstants.js";

const generateVehicleCode = async () => {
    const latestVehicle = await Vehicle.findOne(
        {},
        { vehicleCode: 1 }
    ).sort({
        createdAt: -1,
    });

    if (!latestVehicle) {
        return `${VEHICLE_CODE_PREFIX}000001`;
    }

    const latestNumber = Number(
        latestVehicle.vehicleCode.replace(
            VEHICLE_CODE_PREFIX,
            ""
        )
    );

    const nextNumber = latestNumber + 1;

    return `${VEHICLE_CODE_PREFIX}${String(nextNumber).padStart(6, "0")}`;
};

export default generateVehicleCode;