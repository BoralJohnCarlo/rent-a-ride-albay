import createError from "../utils/createError.js";

import ServiceLocation from "../models/ServiceLocation.js";

const unsetPreviousDefault = async () => {
    await ServiceLocation.updateMany(
        { isDefault: true },
        { isDefault: false }
    );
};

export const getAllServiceLocations =
    async () => {
        return ServiceLocation.find()
            .sort({
                isDefault: -1,
                name: 1,
            })
            .lean();
    };

export const getServiceLocationById =
    async (locationId) => {
        const location =
            await ServiceLocation.findById(
                locationId
            ).lean();

        if (!location) {
            throw createError(
                "Service location not found.",
                404
            );
        }

        return location;
    };

export const getEnabledServiceLocations =
    async () => {
        return ServiceLocation.find({
            enabled: true,
        })
            .sort({
                isDefault: -1,
                name: 1,
            })
            .lean();
    };

export const createServiceLocation =
    async (locationData) => {
        if (locationData.isDefault) {
            await unsetPreviousDefault();
        }

        const location =
            await ServiceLocation.create(
                locationData
            );

        return location.toObject();
    };

export const updateServiceLocation =
    async (locationId, locationData) => {
        const location =
            await ServiceLocation.findById(
                locationId
            );

        if (!location) {
            throw createError(
                "Service location not found.",
                404
            );
        }

        if (
            locationData.isDefault &&
            !location.isDefault
        ) {
            await unsetPreviousDefault();
        }

        Object.assign(
            location,
            locationData
        );

        await location.save();

        return location.toObject();
    };

export const disableServiceLocation =
    async (locationId) => {
        const location =
            await ServiceLocation.findById(
                locationId
            );

        if (!location) {
            throw createError(
                "Service location not found.",
                404
            );
        }

        location.enabled = false;
        location.isDefault = false;

        await location.save();

        return location.toObject();
    };

export const enableServiceLocation =
    async (locationId) => {
        const location =
            await ServiceLocation.findById(
                locationId
            );

        if (!location) {
            throw createError(
                "Service location not found.",
                404
            );
        }

        location.enabled = true;

        await location.save();

        return location.toObject();
    };

export const deleteServiceLocation =
    async (locationId) => {
        const location =
            await ServiceLocation.findById(
                locationId
            );

        if (!location) {
            throw createError(
                "Service location not found.",
                404
            );
        }

        location.enabled = false;
        location.isDefault = false;

        await location.save();

        return location.toObject();
    };
