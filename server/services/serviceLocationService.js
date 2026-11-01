import createError from "../utils/createError.js";

import ServiceLocation from "../models/ServiceLocation.js";
import Settings from "../models/Settings.js";
import { withBookingCreationTransaction } from "./bookingCreationTransaction.js";
import { assertDefaultLocationPolicy, SERVICE_LOCATION_POLICY_RESOURCE } from "../utils/defaultLocationPolicy.js";

const unsetPreviousDefault = async (locationId, session) => {
    await ServiceLocation.updateMany(
        { isDefault: true, _id: { $ne: locationId } },
        { isDefault: false },
        { session }
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
        return withBookingCreationTransaction([SERVICE_LOCATION_POLICY_RESOURCE], async (session) => {
            const location = new ServiceLocation(locationData);
            if (location.isDefault) {
                const settings = await Settings.findOne().session(session).lean();
                assertDefaultLocationPolicy(settings, location);
            }
            await location.save({ session });
            if (location.isDefault) await unsetPreviousDefault(location._id, session);
            return location.toObject();
        });
    };

export const updateServiceLocation =
    async (locationId, locationData) => {
        return withBookingCreationTransaction([SERVICE_LOCATION_POLICY_RESOURCE], async (session) => {
            const location =
                await ServiceLocation.findById(
                    locationId
                ).session(session);

            if (!location) {
                throw createError(
                    "Service location not found.",
                    404
                );
            }

            const next = { ...location.toObject(), ...locationData };
            if (location.isDefault || next.isDefault) {
                const settings = await Settings.findOne().session(session).lean();
                assertDefaultLocationPolicy(settings, next);
            }

            Object.assign(
                location,
                locationData
            );

            await location.save({ session });
            if (location.isDefault) await unsetPreviousDefault(location._id, session);

            return location.toObject();
        });
    };

export const disableServiceLocation =
    (locationId) => updateServiceLocation(locationId, { enabled: false, isDefault: false });

export const enableServiceLocation =
    (locationId) => updateServiceLocation(locationId, { enabled: true });

export const deleteServiceLocation =
    (locationId) => updateServiceLocation(locationId, { enabled: false, isDefault: false });
