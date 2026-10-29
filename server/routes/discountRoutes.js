import express from "express";

import {
    getAll,
    getById,
    create,
    update,
    remove,
} from "../controllers/discountController.js";

import {
    protect,
    authorize,
} from "../middleware/authMiddleware.js";

import {
    createDiscountValidator,
    updateDiscountValidator,
    discountIdValidator,
    discountFiltersValidator,
} from "../validators/discountValidator.js";

/*
 * Admin-only management. Customers never call these: a running discount
 * reaches them on the vehicle itself (`activeDiscount` on the vehicle
 * endpoints) and is applied by the server when a booking is priced.
 */
const router = express.Router();

router.use(protect, authorize("admin"));

router.get("/", discountFiltersValidator, getAll);

router.post("/", createDiscountValidator, create);

router.get("/:discountId", discountIdValidator, getById);

router.patch("/:discountId", updateDiscountValidator, update);

router.delete("/:discountId", discountIdValidator, remove);

export default router;
