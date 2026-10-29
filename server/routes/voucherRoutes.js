import express from "express";

import {
    create,
    getAll,
    getById,
    update,
    remove,
    getAvailable,
    apply,
    recordUsage,
} from "../controllers/voucherController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createVoucherValidator,
    updateVoucherValidator,
    voucherIdValidator,
    applyVoucherValidator,
    voucherFiltersValidator,
} from "../validators/voucherValidator.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Public Routes (available to authenticated customers)
|--------------------------------------------------------------------------
*/

router.get(
    "/available",
    protect,
    authorize("customer"),
    getAvailable
);

router.post(
    "/apply",
    protect,
    authorize("customer"),
    applyVoucherValidator,
    apply
);

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
*/

router.use(
    protect,
    authorize("admin")
);

router.get(
    "/",
    voucherFiltersValidator,
    getAll
);

router.post(
    "/",
    createVoucherValidator,
    create
);

router.get(
    "/:voucherId",
    voucherIdValidator,
    getById
);

router.patch(
    "/:voucherId",
    voucherIdValidator,
    updateVoucherValidator,
    update
);

router.delete(
    "/:voucherId",
    voucherIdValidator,
    remove
);

router.post(
    "/:voucherId/usage",
    voucherIdValidator,
    recordUsage
);

export default router;
