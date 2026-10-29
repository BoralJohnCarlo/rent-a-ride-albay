import {
    param,
} from "express-validator";

import mongoose from "mongoose";

const isValidObjectId = (value) =>
    mongoose.Types.ObjectId.isValid(value);

export const favoriteVehicleIdValidator = [
    param("vehicleId")
        .custom(isValidObjectId)
        .withMessage("Invalid vehicle ID."),
];
