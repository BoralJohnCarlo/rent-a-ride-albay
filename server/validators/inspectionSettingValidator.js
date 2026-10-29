import { body } from 'express-validator';

export const updateInspectionSettingValidator = [
    body('inspectionSlots')
        .optional()
        .isArray()
        .withMessage('Inspection slots must be an array.'),
    body('inspectionSlots.*.date')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1 })
        .withMessage('Each inspection slot must have a date.'),
    body('inspectionSlots.*.timeSlots')
        .optional()
        .isArray()
        .withMessage('Each inspection slot\'s timeSlots must be an array.'),
    body('inspectionSlots.*.timeSlots.*.time')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1 })
        .withMessage('Each time slot must have a time.'),
    body('inspectionSlots.*.timeSlots.*.endTime')
        .optional()
        .isString()
        .trim(),
    body('inspectionSlots.*.timeSlots.*.period')
        .optional()
        .isIn(['AM', 'PM', 'Custom'])
        .withMessage('Each time slot\'s period must be AM, PM, or Custom.'),
    body('inspectionSlots.*.timeSlots.*.maxAppointments')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Each time slot\'s maxAppointments must be an integer between 1 and 50.'),
    body('inspectionSlots.*.enabled')
        .optional()
        .isBoolean()
        .withMessage('Each inspection slot\'s enabled flag must be a boolean.'),
    body('inspectionSlots.*.weekdays')
        .optional()
        .isArray()
        .withMessage('Each inspection slot\'s weekdays must be an array.'),
    body('disabledDates')
        .optional()
        .isArray()
        .withMessage('Disabled dates must be an array.'),
    body('disabledDates.*')
        .optional()
        .isString()
        .trim()
        .isLength({ min: 1 })
        .withMessage('Each disabled date must be a non-empty string.'),
];