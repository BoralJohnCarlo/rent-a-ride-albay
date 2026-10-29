import InspectionSetting from '../models/InspectionSetting.js';
import { getBookedInspectionCounts } from '../services/inspectionSlotService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { validationResult } from 'express-validator';

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const disabled = new Set(setting.disabledDates || []);

        const slots = (setting.inspectionSlots || [])
            .filter((slot) => slot.enabled !== false && !disabled.has(slot.date))
            .filter((slot) => new Date(`${slot.date}T00:00:00`) >= today)
            .map((slot) => ({
                date: slot.date,
                timeSlots: (slot.timeSlots || []).map((ts) => {
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
        const setting = await InspectionSetting.getInstance();

        setting.inspectionSlots = inspectionSlots || [];
        setting.disabledDates = disabledDates || [];

        await setting.save();

        return successResponse(
            res,
            'Inspection setting updated successfully.',
            setting
        );
    } catch (error) {
        return errorResponse(res, error.message, 500);
    }
};