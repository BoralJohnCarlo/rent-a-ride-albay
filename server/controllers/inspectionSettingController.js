import InspectionSetting from '../models/InspectionSetting.js';
import { getBookedInspectionCounts } from '../services/inspectionSlotService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { validationResult } from 'express-validator';
import { inspectionInstant } from '../utils/inspectionTime.js';
import { withInspectionBookingLock } from '../services/inspectionBookingLock.js';
import createError from '../utils/createError.js';

/*
 * Inspection slots with live booking capacity — used by operators to pick an
 * appointment and by the admin calendar to show utilisation. Only future,
 * enabled, non-disabled slots with remaining capacity are returned as bookable.
 */
export const getInspectionAvailability = async (req, res) => {
    try {
        const setting = await InspectionSetting.getInstance();

        // Consignments plus partner registrations/vehicles awaiting inspection.
        const bookedMap = await getBookedInspectionCounts();

        const now = new Date();

        const disabled = new Set(setting.disabledDates || []);

        const slots = (setting.inspectionSlots || [])
            .filter((slot) => slot.enabled !== false && !disabled.has(slot.date))
            .map((slot) => ({
                date: slot.date,
                timeSlots: (slot.timeSlots || []).filter(ts => inspectionInstant(slot.date, ts.time) > now).map((ts) => {
                    const booked = bookedMap.get(`${slot.date}|${ts.time}`) || 0;
                    const max = ts.maxAppointments || 1;
                    return {
                        time: ts.time,
                        endTime: ts.endTime || "",
                        period: ts.period,
                        maxAppointments: max,
                        booked,
                        remaining: Math.max(0, max - booked),
                    };
                }),
            }))
            .filter(slot => slot.timeSlots.length > 0)
            .sort((a, b) => a.date.localeCompare(b.date));

        return successResponse(
            res,
            'Inspection availability retrieved successfully.',
            { slots, disabledDates: setting.disabledDates || [] }
        );
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const getInspectionSetting = async (req, res) => {
    try {
        const setting = await InspectionSetting.getInstance();
        return successResponse(res, 'Inspection setting retrieved successfully.', setting);
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};

export const updateInspectionSetting = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return errorResponse(
                res,
                'Validation failed.',
                400,
                errors.array()
            );
        }

        const { inspectionSlots, disabledDates } = req.body;
        return await withInspectionBookingLock(async () => {
            const setting = await InspectionSetting.getInstance();
            const nextSlots = inspectionSlots ?? setting.inspectionSlots;
            const nextDisabled = disabledDates ?? setting.disabledDates;
            const dates = new Set();
            for (const day of nextSlots) {
                if (dates.has(day.date) || Number.isNaN(inspectionInstant(day.date, '00:00').getTime())) throw createError('Each inspection date must be valid and unique.', 400);
                dates.add(day.date);
                const times = new Set();
                for (const slot of day.timeSlots || []) {
                    if (times.has(slot.time) || Number.isNaN(inspectionInstant(day.date, slot.time).getTime())) throw createError('Each inspection time must be valid and unique.', 400);
                    if (slot.endTime && (Number.isNaN(inspectionInstant(day.date, slot.endTime).getTime()) || slot.endTime <= slot.time)) throw createError('Inspection end time must be after the start time.', 400);
                    times.add(slot.time);
                }
            }
            const booked = await getBookedInspectionCounts();
            for (const [key, count] of booked) {
                const [date, time] = key.split('|');
                if (!(inspectionInstant(date, time) > new Date())) continue;
                const day = nextSlots.find(slot => slot.date === date && slot.enabled !== false);
                const slot = day?.timeSlots?.find(slot => slot.time === time);
                if (nextDisabled.includes(date) || !slot || (slot.maxAppointments || 1) < count) throw createError('Move existing appointments before removing, disabling, or reducing a booked slot.', 409);
            }
            setting.inspectionSlots = nextSlots;
            setting.disabledDates = nextDisabled;

            await setting.save();

            return successResponse(
                res,
                'Inspection setting updated successfully.',
                setting
            );
        });
    } catch (error) {
        return errorResponse(res, error.message, error.statusCode || 500);
    }
};
