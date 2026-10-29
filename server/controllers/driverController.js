import {
    createDriver,
    getDrivers,
    getAvailableDrivers,
    getDriver,
    getPublicDriverProfile,
    getUpcomingDriverBookings,
    updateDriver,
    updateDriverStatus,
    updateDriverAvailability,
    archiveDriver,
    restoreDriver,
} from "../services/driverService.js";

import handleValidation from "../utils/handleValidation.js";

import {
    DRIVER_STATUS,
    DRIVER_AVAILABILITY,
} from "../constants/driverConstants.js";

/*
 * A list filter as the stored value: clients send either the value
 * ("Active") or the key ("ACTIVE"). Unknown or missing → no filter.
 */
const toEnumValue = (input, enumObject) => {
    if (!input) {
        return undefined;
    }

    const wanted = String(input).trim().toUpperCase();

    return Object.entries(enumObject).find(
        ([key, value]) =>
            key === wanted || value.toUpperCase() === wanted
    )?.[1];
};

export const createDriverAccount =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await createDriver(
                    req.body,
                    req.user._id
                );

            res.status(201).json({
                success: true,
                message:
                    "Driver created successfully.",
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const getAvailableDriversController =
    async (req, res, next) => {
        try {
            // Optional trip dates mark drivers already booked then (busy).
            const drivers =
                await getAvailableDrivers({
                    startDate: req.query.startDate,
                    endDate: req.query.endDate,
                });

            res.status(200).json({
                success: true,
                data: drivers,
            });
        } catch (error) {
            next(error);
        }
    };

export const getAllDrivers =
    async (req, res, next) => {
        try {
            const includeArchived =
                req.query.includeArchived ===
                "true";

            const drivers =
                await getDrivers({
                    includeArchived,
                    // Optional filters; availability "BOOKABLE" = free for
                    // a future booking (see driverService).
                    status: toEnumValue(
                        req.query.status,
                        DRIVER_STATUS
                    ),
                    availability:
                        String(req.query.availability).toUpperCase() ===
                        "BOOKABLE"
                            ? "BOOKABLE"
                            : toEnumValue(
                                  req.query.availability,
                                  DRIVER_AVAILABILITY
                              ),
                    startDate: req.query.startDate,
                    endDate: req.query.endDate,
                });

            res.status(200).json({
                success: true,
                data: drivers,
            });
        } catch (error) {
            next(error);
        }
    };

export const getSingleDriver =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await getDriver(
                    req.params.id
                );

            res.status(200).json({
                success: true,
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const getDriverUpcomingBookings =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const bookings =
                await getUpcomingDriverBookings(
                    req.params.id
                );

            res.status(200).json({
                success: true,
                data: bookings,
            });
        } catch (error) {
            next(error);
        }
    };

export const getPublicDriverProfileController =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await getPublicDriverProfile(
                    req.params.id
                );

            res.status(200).json({
                success: true,
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const editDriver =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await updateDriver(
                    req.params.id,
                    req.body,
                    req.user._id
                );

            res.status(200).json({
                success: true,
                message:
                    "Driver updated successfully.",
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const changeDriverStatus =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await updateDriverStatus(
                    req.params.id,
                    req.body.status,
                    req.user._id
                );

            res.status(200).json({
                success: true,
                message:
                    "Driver status updated successfully.",
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const changeDriverAvailability =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await updateDriverAvailability(
                    req.params.id,
                    req.body.availability,
                    req.user._id
                );

            res.status(200).json({
                success: true,
                message:
                    "Driver availability updated successfully.",
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const archiveDriverAccount =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await archiveDriver(
                    req.params.id,
                    req.body.reason,
                    req.user._id
                );

            res.status(200).json({
                success: true,
                message:
                    "Driver archived successfully.",
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };

export const restoreDriverAccount =
    async (req, res, next) => {
        if (!handleValidation(req, res)) {
            return;
        }

        try {
            const driver =
                await restoreDriver(
                    req.params.id,
                    req.user._id
                );

            res.status(200).json({
                success: true,
                message:
                    "Driver restored successfully.",
                data: driver,
            });
        } catch (error) {
            next(error);
        }
    };