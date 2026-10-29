import express from "express";

import {
    getAllRules,
    getSingleRule,
    createRule,
    updateRule,
    disableRule,
    enableRule,
    deleteRule,
} from "../controllers/distanceFeeRuleController.js";

import {
    distanceFeeRuleIdValidator,
    createDistanceFeeRuleValidator,
    updateDistanceFeeRuleValidator,
} from "../validators/distanceFeeRuleValidator.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authorize("admin"));

router.get("/", getAllRules);

router.get(
    "/:id",
    distanceFeeRuleIdValidator,
    getSingleRule
);

router.post(
    "/",
    createDistanceFeeRuleValidator,
    createRule
);

router.put(
    "/:id",
    updateDistanceFeeRuleValidator,
    updateRule
);

router.patch(
    "/:id/disable",
    distanceFeeRuleIdValidator,
    disableRule
);

router.patch(
    "/:id/enable",
    distanceFeeRuleIdValidator,
    enableRule
);

router.delete(
    "/:id",
    distanceFeeRuleIdValidator,
    deleteRule
);

export default router;
