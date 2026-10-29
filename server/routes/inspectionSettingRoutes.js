import { Router } from 'express';
import { protect, authorize } from '../middleware/authMiddleware.js';
import {
    getInspectionSetting,
    updateInspectionSetting,
    getInspectionAvailability,
} from '../controllers/inspectionSettingController.js';
import { updateInspectionSettingValidator } from '../validators/inspectionSettingValidator.js';

const router = Router();

/*
 * Public: contains no sensitive data (just open dates/times/remaining
 * capacity), and a brand-new operator picks their inspection appointment
 * from this same calendar during registration, before an account exists.
 * Logged-in operators/admins use it too (rescheduling, the admin calendar).
 */
router.get('/availability', getInspectionAvailability);

router.use(protect, authorize('admin'));

router.get('/', getInspectionSetting);
router.put('/', updateInspectionSettingValidator, updateInspectionSetting);

export default router;